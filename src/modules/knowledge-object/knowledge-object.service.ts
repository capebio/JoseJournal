import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PORTS, type KnowledgeObjectRepo, type SearchPort } from '@core/ports';
import type {
  KnowledgeObjectContent,
  KnowledgeObjectEntity,
  KoType,
  Lenses,
  Tier,
  VersionDoc,
  Visibility,
} from '@core/types';
import { mintId } from '@core/ids';
import { ProvenanceService } from '@modules/provenance/provenance.service';
import { VersioningService, type Actor } from '@modules/versioning/versioning.service';
import { applyLens, type LensRequest } from './lens.util';

const DEFAULT_LENSES: Lenses = { language: 'en', depthVariants: ['surface'], register: 'academic' };

export interface CreateKoInput {
  koType: KoType;
  tier?: Tier;
  content: KnowledgeObjectContent;
  actor: Actor;
  authors?: string[];
  visibility?: Visibility;
  conceptRef?: string | null;
  subjectRefs?: string[];
  lenses?: Lenses;
}

export interface ReadModel {
  entity: KnowledgeObjectEntity;
  version: VersionDoc & { content: KnowledgeObjectContent };
  relation: { isLatest: boolean; tip: string; vor: string | null; newerVersionExists: boolean };
}

@Injectable()
export class KnowledgeObjectService {
  constructor(
    @Inject(PORTS.KnowledgeObjectRepo) private readonly ko: KnowledgeObjectRepo,
    @Inject(PORTS.SearchPort) private readonly search: SearchPort,
    private readonly versioning: VersioningService,
    private readonly provenance: ProvenanceService,
  ) {}

  async createKo(input: CreateKoInput): Promise<{ entity: KnowledgeObjectEntity; version: VersionDoc }> {
    const koId = mintId('ko');
    const entity: KnowledgeObjectEntity = {
      '@context': 'https://jose.org/ns/v1',
      '@type': 'KnowledgeObject',
      _id: koId,
      koType: input.koType,
      tier: input.tier ?? 'commons',
      createdAt: new Date().toISOString(),
      refs: { tip: '', vor: null, branches: {} },
      conceptRef: input.conceptRef ?? null,
      subjectRefs: input.subjectRefs,
    };
    await this.ko.createEntity(entity);
    const version = await this.versioning.commit({
      koId,
      content: input.content,
      meta: {
        parent: null,
        branch: 'main',
        authors: input.authors ?? [input.actor.ref],
        status: 'raw',
        visibility: input.visibility ?? 'private',
        lenses: input.lenses ?? DEFAULT_LENSES,
      },
      actor: input.actor,
    });
    await this.indexVersion(entity, version);
    return { entity: (await this.ko.getEntity(koId))!, version };
  }

  /** §7 PUT /ko/:id/draft — autosave produces a new private 'raw' version (every state citable). */
  async autosaveDraft(koId: string, content: KnowledgeObjectContent, actor: Actor): Promise<VersionDoc> {
    const entity = await this.ko.getEntity(koId);
    if (!entity) throw new NotFoundException(`unknown KO ${koId}`);
    const tip = entity.refs.tip ? await this.ko.getVersion(entity.refs.tip) : null;
    return this.versioning.commit({
      koId,
      content,
      meta: {
        parent: entity.refs.tip || null,
        branch: 'main',
        authors: tip?.authors ?? [actor.ref],
        status: 'raw',
        visibility: tip?.visibility ?? 'private',
        lenses: tip?.lenses ?? DEFAULT_LENSES,
      },
      actor,
    });
  }

  getEntity(koId: string): Promise<KnowledgeObjectEntity | null> {
    return this.ko.getEntity(koId);
  }

  getVersion(versionId: string): Promise<VersionDoc | null> {
    return this.ko.getVersion(versionId);
  }

  async history(koId: string): Promise<VersionDoc[]> {
    const versions = await this.ko.listVersions(koId);
    return versions.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a._id < b._id ? -1 : 1));
  }

  /** §7 GET /ko/:id and /ko/:id/v/:verId — read model with the §9.4 "newer version exists" banner. */
  async read(koId: string, versionId: string | null, lens: LensRequest): Promise<ReadModel> {
    const entity = await this.ko.getEntity(koId);
    if (!entity) throw new NotFoundException(`unknown KO ${koId}`);
    const targetId = versionId ?? entity.refs.tip;
    const version = await this.ko.getVersion(targetId);
    if (!version) throw new NotFoundException(`unknown version ${targetId}`);
    const isLatest = entity.refs.tip === version._id;
    const projected = applyLens(version, lens);
    return {
      entity,
      version: { ...version, content: projected },
      relation: { isLatest, tip: entity.refs.tip, vor: entity.refs.vor, newerVersionExists: !isLatest },
    };
  }

  /** Index a version into Elastic. Private/collaborator drafts NEVER enter the public index (§9.2). */
  private async indexVersion(entity: KnowledgeObjectEntity, version: VersionDoc): Promise<void> {
    const text = version.content.sections
      .flatMap((s) => s.blocks)
      .filter((b) => !b.restricted)
      .map((b) => b.text ?? '')
      .join(' ');
    const index = version.visibility === 'public' ? 'public' : 'restricted';
    await this.search.index({
      id: version._id,
      koId: entity._id,
      koType: entity.koType,
      status: version.status,
      tier: entity.tier,
      visibility: version.visibility,
      title: version.content.title,
      text,
      taxon: entity.conceptRef ?? undefined,
      index,
    });
  }

  /** Re-index after a release/amend so search reflects current public state. */
  async reindex(koId: string, versionId: string): Promise<void> {
    const entity = await this.ko.getEntity(koId);
    const version = await this.ko.getVersion(versionId);
    if (entity && version) await this.indexVersion(entity, version);
  }
}
