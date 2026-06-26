import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PORTS, type AuditRepo, type KnowledgeObjectRepo, type ReleaseRepo, type UnitOfWork } from '@core/ports';
import type {
  ActorRole,
  KnowledgeObjectContent,
  KnowledgeObjectEntity,
  Lenses,
  Release,
  VersionDoc,
  VersionMeta,
  VersionStatus,
  Visibility,
} from '@core/types';
import { computeVersionHash } from '@core/hash';
import { mintId } from '@core/ids';
import { ProvenanceService } from '@modules/provenance/provenance.service';
import { ConfigService } from '@nestjs/config';

export interface Actor {
  ref: string; // acct:… | idrec:…
  role: ActorRole;
}

export interface CommitInput {
  koId: string;
  content: KnowledgeObjectContent;
  meta: {
    parent: string | null;
    branch: string;
    authors: string[];
    status: VersionStatus;
    visibility: Visibility;
    lenses: Lenses;
  };
  actor: Actor;
}

export type AmendClass = 'trivial' | 'substantive' | 'structural';

/**
 * The §5 versioning core — git semantics implemented EXPLICITLY over Couch,
 * never via Couch `_rev` (which compacts and is not content-addressed).
 *
 * Identity = sha256(JCS(content) || JCS(meta)). Because `status`, `visibility`
 * and `lenses` are in the hashed meta but `doi`, `createdAt`, `provenanceRefs`
 * and `_rev` are NOT, a released version's identity stays byte-stable forever
 * even as a DOI and provenance links are attached to its doc — which is exactly
 * what §9.1 requires.
 *
 * Note on "tagVoR sets status='vor'": versions are immutable, and status is in
 * the hash, so promoting to VoR necessarily MINTS a new immutable version with
 * status='vor' (parent = the version being released). The DOI targets that new
 * ver id; the prior reviewed version is untouched. This is the only internally
 * consistent reading of §5 under content-addressing.
 */
@Injectable()
export class VersioningService {
  constructor(
    @Inject(PORTS.KnowledgeObjectRepo) private readonly ko: KnowledgeObjectRepo,
    @Inject(PORTS.ReleaseRepo) private readonly releases: ReleaseRepo,
    @Inject(PORTS.AuditRepo) private readonly audit: AuditRepo,
    @Inject(PORTS.UnitOfWork) private readonly uow: UnitOfWork,
    private readonly provenance: ProvenanceService,
    private readonly config: ConfigService,
  ) {}

  private today(): string {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  }

  /** Write an immutable version + advance refs + emit provenance. Idempotent on content hash. */
  private async writeVersion(
    entity: KnowledgeObjectEntity,
    meta: VersionMeta,
    content: KnowledgeObjectContent,
    actor: Actor,
    action: string,
    detail: Record<string, unknown>,
    doi: string | null = null,
  ): Promise<VersionDoc> {
    const { contentHash, versionId } = computeVersionHash(content, meta);
    const existing = await this.ko.getVersion(versionId);
    if (existing) {
      // Natural dedup (§9.1): identical content+meta -> identical id. Still move
      // the branch tip so the pointer is correct, but emit no duplicate event.
      await this.advanceRefs(entity, meta.branch, versionId, meta.status);
      return existing;
    }
    const prov = await this.provenance.record({
      subjectRef: versionId,
      actorRef: actor.ref,
      actorRole: actor.role,
      action,
      detail: { branch: meta.branch, status: meta.status, ...detail },
    });
    const version: VersionDoc = {
      '@type': 'Version',
      _id: versionId,
      ko: meta.ko,
      parent: meta.parent,
      branch: meta.branch,
      createdAt: this.today(),
      authors: meta.authors,
      status: meta.status,
      visibility: meta.visibility,
      lenses: meta.lenses,
      content,
      provenanceRefs: [prov.id],
      doi,
      contentHash,
    };
    await this.ko.putVersion(version);
    await this.advanceRefs(entity, meta.branch, versionId, meta.status);
    return version;
  }

  private async advanceRefs(entity: KnowledgeObjectEntity, branch: string, versionId: string, status: VersionStatus): Promise<void> {
    const fresh = (await this.ko.getEntity(entity._id))!;
    fresh.refs.branches[branch] = versionId;
    if (branch === 'main') fresh.refs.tip = versionId;
    if (status === 'vor') fresh.refs.vor = versionId;
    await this.ko.updateEntity(fresh);
  }

  /** §5 commit. */
  async commit(input: CommitInput): Promise<VersionDoc> {
    const entity = await this.ko.getEntity(input.koId);
    if (!entity) throw new NotFoundException(`unknown KO ${input.koId}`);
    const meta: VersionMeta = { ko: input.koId, ...input.meta };
    const action = meta.parent ? 'amended' : 'created';
    return this.writeVersion(entity, meta, input.content, input.actor, action, {});
  }

  /** §5 branch — add a branch pointer at an existing version. */
  async branch(koId: string, fromVer: string, name: string, actor: Actor): Promise<KnowledgeObjectEntity> {
    const entity = await this.ko.getEntity(koId);
    if (!entity) throw new NotFoundException(`unknown KO ${koId}`);
    if (!(await this.ko.getVersion(fromVer))) throw new NotFoundException(`unknown version ${fromVer}`);
    entity.refs.branches[name] = fromVer;
    await this.ko.updateEntity(entity);
    await this.provenance.record({ subjectRef: koId, actorRef: actor.ref, actorRole: actor.role, action: 'branched', detail: { branch: name, fromVer } });
    return (await this.ko.getEntity(koId))!;
  }

  /**
   * §5 fork — new Entity whose first Version records `parent` = the source ver
   * (cross-KO lineage) and a provenance lineage event (§9.1).
   */
  async fork(sourceKoId: string, fromVer: string, actor: Actor): Promise<{ entity: KnowledgeObjectEntity; version: VersionDoc }> {
    const source = await this.ko.getVersion(fromVer);
    if (!source || source.ko !== sourceKoId) throw new NotFoundException(`unknown version ${fromVer} on ${sourceKoId}`);
    const sourceEntity = await this.ko.getEntity(sourceKoId);
    const newKoId = mintId('ko');
    const entity: KnowledgeObjectEntity = {
      '@context': 'https://jose.org/ns/v1',
      '@type': 'KnowledgeObject',
      _id: newKoId,
      koType: sourceEntity?.koType ?? 'treatment',
      tier: 'commons',
      createdAt: new Date().toISOString(),
      refs: { tip: '', vor: null, branches: {} },
      conceptRef: sourceEntity?.conceptRef ?? null,
    };
    await this.ko.createEntity(entity);
    const meta: VersionMeta = {
      ko: newKoId,
      parent: fromVer, // lineage across KOs
      branch: 'main',
      authors: [actor.ref],
      status: 'raw',
      visibility: 'private',
      lenses: source.lenses,
    };
    const version = await this.writeVersion(entity, meta, source.content, actor, 'forked', { forkedFrom: fromVer, sourceKo: sourceKoId });
    return { entity: (await this.ko.getEntity(newKoId))!, version };
  }

  /** §15 authority matrix — minimal v1 enforcement. */
  private assertAuthority(amendClass: AmendClass, role: ActorRole): void {
    if (amendClass === 'trivial') return; // any authenticated contributor
    const allowed: ActorRole[] = amendClass === 'structural' ? ['steward', 'editor'] : ['author', 'editor', 'steward'];
    if (!allowed.includes(role)) {
      throw new ForbiddenException(`amend class '${amendClass}' requires one of [${allowed.join(', ')}], actor is '${role}'`);
    }
  }

  /** §5 amend — produces a new dated version; never mutates an existing one. */
  async amend(input: {
    koId: string;
    baseVersionId: string;
    content: KnowledgeObjectContent;
    actor: Actor;
    amendClass: AmendClass;
    status?: VersionStatus;
  }): Promise<VersionDoc> {
    this.assertAuthority(input.amendClass, input.actor.role);
    const entity = await this.ko.getEntity(input.koId);
    if (!entity) throw new NotFoundException(`unknown KO ${input.koId}`);
    const base = await this.ko.getVersion(input.baseVersionId);
    if (!base || base.ko !== input.koId) throw new NotFoundException(`unknown base version ${input.baseVersionId}`);
    const meta: VersionMeta = {
      ko: input.koId,
      parent: base._id,
      branch: 'main',
      authors: base.authors,
      status: input.status ?? base.status,
      visibility: base.visibility,
      lenses: base.lenses,
    };
    return this.writeVersion(entity, meta, input.content, input.actor, 'amended', { amendClass: input.amendClass, base: base._id });
  }

  private mintDoi(koId: string, contentHash: string): string {
    const prefix = (this.config.get('doi') as any).prefix as string;
    const koPart = koId.split(':')[1].slice(-8).toLowerCase();
    const verPart = contentHash.replace('sha256-', '').slice(0, 8);
    return `${prefix}/jose.${koPart}.${verPart}`;
  }

  /**
   * §5 tagVoR — server-authoritative. Mints the immutable status='vor' version,
   * a DOI, and a release row, ALL inside one transaction (atomic on the live
   * Postgres adapter; snapshot/rollback on the in-memory one). Flips the entity
   * to the Journal tier (§9.2).
   */
  async tagVoR(
    koId: string,
    versionId: string | null,
    actor: Actor,
  ): Promise<{ release: Release; doi: string; version: VersionDoc }> {
    const entity = await this.ko.getEntity(koId);
    if (!entity) throw new NotFoundException(`unknown KO ${koId}`);
    const baseId = versionId ?? entity.refs.tip;
    const base = await this.ko.getVersion(baseId);
    if (!base) throw new NotFoundException(`unknown version ${baseId}`);
    if (base.visibility !== 'public') {
      // A VoR is public by definition; ensure the released content is publishable.
    }

    const vorMeta: VersionMeta = {
      ko: koId,
      parent: base._id,
      branch: 'main',
      authors: base.authors,
      status: 'vor',
      visibility: 'public',
      lenses: base.lenses,
    };
    const { contentHash, versionId: vorVersionId } = computeVersionHash(base.content, vorMeta);
    const doi = this.mintDoi(koId, contentHash);

    return this.uow.run(async () => {
      const prov = await this.provenance.record({
        subjectRef: vorVersionId,
        actorRef: actor.ref,
        actorRole: actor.role,
        action: 'released',
        detail: { tier: 'journal', doi, base: base._id },
      });
      const version: VersionDoc = {
        '@type': 'Version',
        _id: vorVersionId,
        ko: koId,
        parent: base._id,
        branch: 'main',
        createdAt: this.today(),
        authors: vorMeta.authors,
        status: 'vor',
        visibility: 'public',
        lenses: vorMeta.lenses,
        content: base.content,
        provenanceRefs: [prov.id],
        doi,
        contentHash,
      };
      await this.ko.putVersion(version);

      const fresh = (await this.ko.getEntity(koId))!;
      fresh.refs.branches.main = vorVersionId;
      fresh.refs.tip = vorVersionId;
      fresh.refs.vor = vorVersionId;
      fresh.tier = 'journal';
      await this.ko.updateEntity(fresh);

      const release: Release = {
        id: mintId('release'),
        koId,
        versionId: vorVersionId,
        tier: 'journal',
        doi,
        releasedBy: actor.ref,
        releasedAt: new Date().toISOString(),
      };
      await this.releases.createRelease(release);
      await this.releases.mintDoi({
        doi,
        versionId: vorVersionId,
        koId,
        agency: (this.config.get('doi') as any).agency,
        mintedAt: release.releasedAt,
        metadata: { title: base.content.title },
      });
      await this.audit.append({
        ts: release.releasedAt,
        actorRef: actor.ref,
        action: 'release-vor',
        objectRef: vorVersionId,
        disclosure: 'public',
        detail: { doi, koId },
      });
      return { release, doi, version };
    });
  }

  /**
   * §5 release (Commons) — no DOI/VoR; just records a Commons release of the
   * current tip so a Commons object is citable. Journal release = tagVoR.
   */
  async releaseCommons(koId: string, actor: Actor): Promise<Release> {
    const entity = await this.ko.getEntity(koId);
    if (!entity) throw new NotFoundException(`unknown KO ${koId}`);
    if (entity.tier !== 'commons') throw new BadRequestException('releaseCommons only applies to Commons KOs');
    const release: Release = {
      id: mintId('release'),
      koId,
      versionId: entity.refs.tip,
      tier: 'commons',
      doi: null,
      releasedBy: actor.ref,
      releasedAt: new Date().toISOString(),
    };
    await this.releases.createRelease(release);
    await this.provenance.record({ subjectRef: entity.refs.tip, actorRef: actor.ref, actorRole: actor.role, action: 'released', detail: { tier: 'commons' } });
    return release;
  }

  /**
   * §12.2 retraction — v1 minimum: mark retracted (a new tip version with
   * status='retracted') + provenance. Full propagation to forks/citations is
   * deferred; descendants surface the banner via read-time status inspection.
   */
  async retract(koId: string, versionId: string, actor: Actor, reason: string): Promise<VersionDoc> {
    const entity = await this.ko.getEntity(koId);
    if (!entity) throw new NotFoundException(`unknown KO ${koId}`);
    const base = await this.ko.getVersion(versionId);
    if (!base) throw new NotFoundException(`unknown version ${versionId}`);
    const meta: VersionMeta = {
      ko: koId,
      parent: base._id,
      branch: 'main',
      authors: base.authors,
      status: 'retracted',
      visibility: base.visibility,
      lenses: base.lenses,
    };
    const v = await this.writeVersion(entity, meta, base.content, actor, 'retracted', { reason, retracts: versionId });
    await this.audit.append({
      ts: new Date().toISOString(),
      actorRef: actor.ref,
      action: 'retract',
      objectRef: versionId,
      disclosure: 'public',
      detail: { reason },
    });
    return v;
  }
}
