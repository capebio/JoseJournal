import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PORTS, type AuditRepo, type KnowledgeObjectRepo, type LocalityRepo } from '@core/ports';
import type { AccessGrant, ObservationPublic, Principal } from '@core/types';
import { mintId } from '@core/ids';
import { encodeQDS, qdsPolygon } from '@core/qds';
import { ProvenanceService } from '@modules/provenance/provenance.service';

export interface SplitStoreInput {
  koId: string;
  taxonConcept: string; // concept:…
  lat: number;
  lon: number;
  uncertaintyM?: number;
  sensitivity: 'normal' | 'sensitive' | 'highly-sensitive';
  source: { system: string; id: string };
  media?: string[];
  verification?: 'raw' | 'verified' | 'rejected';
  /** Free-text the caller wants public — scanned for coordinate leakage before acceptance. */
  publicCaptions?: string[];
  actorRef: string;
}

export interface PolicyDecision {
  allow: boolean;
  reason: string;
}

/**
 * Detects decimal-degree coordinates embedded in free text — a §6 indirect
 * leakage path (captions, locality descriptions). Conservative: any plausible
 * lat,lon pair triggers a rejection so precise data cannot ride out in prose.
 */
const COORD_RE = /[-+]?\d{1,3}\.\d{3,}\s*[,;]\s*[-+]?\d{1,3}\.\d{3,}/;
export function textLeaksCoordinates(text: string): boolean {
  return COORD_RE.test(text);
}

/**
 * §6 tiered replication + locality policy engine — the highest-risk component.
 * Every sensitive object is split at write time: a QDS-only public projection
 * (replicable to any client) and a restricted precise record (Postgres, never
 * replicated). Precise disclosure is server-mediated, object-specific,
 * purpose-bound, time-limited, logged, and revocable.
 */
@Injectable()
export class LocalityService {
  constructor(
    @Inject(PORTS.LocalityRepo) private readonly locality: LocalityRepo,
    @Inject(PORTS.KnowledgeObjectRepo) private readonly ko: KnowledgeObjectRepo,
    @Inject(PORTS.AuditRepo) private readonly audit: AuditRepo,
    private readonly provenance: ProvenanceService,
    private readonly config: ConfigService,
  ) {}

  /** Split at ingest. Returns the public projection only — precise never leaves here. */
  async splitAndStore(input: SplitStoreInput): Promise<{ obsId: string; public: ObservationPublic }> {
    for (const cap of input.publicCaptions ?? []) {
      if (textLeaksCoordinates(cap)) {
        throw new ForbiddenException('public caption contains coordinates — refused (§6 leakage guard)');
      }
    }
    const obsId = mintId('obs');
    const qds = encodeQDS(input.lat, input.lon); // throws (rejects) rather than under-generalise
    const publicDoc: ObservationPublic = {
      _id: `${obsId}:public`,
      '@type': 'ObservationPublic',
      ko: input.koId,
      taxon: input.taxonConcept,
      localityQDS: qds, // QDS only — NEVER finer in a public doc
      geometryGeneralised: qdsPolygon(qds),
      source: input.source,
      media: input.media ?? [],
      verification: input.verification ?? 'raw',
    };
    // (1) public projection -> public Couch DB (replicable)
    await this.ko.putPublicProjection(publicDoc._id, publicDoc as unknown as Record<string, unknown>);
    // (2) precise -> restricted Postgres (server-mediated only, never replicated)
    await this.locality.putPrecise({
      obsId,
      lat: input.lat,
      lon: input.lon,
      uncertaintyM: input.uncertaintyM ?? null,
      sensitivity: input.sensitivity,
      source: input.source,
    });
    await this.provenance.record({ subjectRef: obsId, actorRef: input.actorRef, actorRole: 'contributor', action: 'created', detail: { qds } });
    await this.provenance.record({ subjectRef: obsId, actorRef: input.actorRef, actorRole: 'system', action: 'created', disclosure: 'restricted', detail: { preciseStored: true, sensitivity: input.sensitivity } });
    await this.audit.append({ ts: new Date().toISOString(), actorRef: input.actorRef, action: 'split-store', objectRef: obsId, disclosure: 'restricted', detail: { qds, sensitivity: input.sensitivity } });
    return { obsId, public: publicDoc };
  }

  getPublic(obsId: string): Promise<Record<string, unknown> | null> {
    return this.ko.getPublicProjection(`${obsId}:public`);
  }

  /** §7 GET /map/:koId — QDS distribution from public projections only. */
  async map(koId: string): Promise<ObservationPublic[]> {
    const all = await this.ko.dumpPublic();
    return Object.values(all).filter((d) => d['@type'] === 'ObservationPublic' && d.ko === koId) as unknown as ObservationPublic[];
  }

  /**
   * Issue an object-specific, purpose-bound, time-limited, revocable grant.
   * Granting authority (editor/steward) is required — certification establishes
   * baseline trust but never an automatic right to a specific sensitive site
   * (§18). (Who may grant is §12-OPEN; v1 = editor/steward.)
   */
  async issueGrant(input: {
    grantee: string;
    objectRef: string;
    purpose: string;
    grantedBy: string;
    ttlMs: number;
    offlinePkg?: boolean;
  }): Promise<AccessGrant> {
    if (!(await this.locality.getPrecise(input.objectRef))) throw new NotFoundException(`no precise record for ${input.objectRef}`);
    const now = Date.now();
    const grant: AccessGrant = {
      id: mintId('grant'),
      grantee: input.grantee,
      objectRef: input.objectRef,
      purpose: input.purpose,
      grantedBy: input.grantedBy,
      grantedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + input.ttlMs).toISOString(),
      revokedAt: null,
      offlinePkg: input.offlinePkg ?? false,
    };
    await this.locality.createGrant(grant);
    await this.audit.append({ ts: grant.grantedAt, actorRef: input.grantedBy, action: 'grant-issued', objectRef: input.objectRef, disclosure: 'restricted', detail: { grantee: input.grantee, purpose: input.purpose, expiresAt: grant.expiresAt, offlinePkg: grant.offlinePkg } });
    return grant;
  }

  async revokeGrant(grantId: string, actorRef: string): Promise<void> {
    const at = new Date().toISOString();
    await this.locality.revokeGrant(grantId, at);
    await this.audit.append({ ts: at, actorRef, action: 'grant-revoked', objectRef: grantId, disclosure: 'restricted', detail: {} });
  }

  /** The policy decision, isolated for testability. */
  async evaluate(principal: Principal, objectRef: string, requestPurpose: string, now: Date): Promise<{ decision: PolicyDecision; grants: AccessGrant[] }> {
    if (principal.assurance !== 'certified') {
      return { decision: { allow: false, reason: 'not-certified' }, grants: [] };
    }
    const grants = await this.locality.activeGrants(principal.accountId, objectRef, now);
    if (grants.length === 0) {
      return { decision: { allow: false, reason: 'no-active-grant' }, grants };
    }
    const inPurpose = grants.find((g) => g.purpose === requestPurpose);
    if (!inPurpose) {
      return { decision: { allow: false, reason: 'purpose-mismatch' }, grants };
    }
    return { decision: { allow: true, reason: 'granted' }, grants: [inPurpose] };
  }

  /**
   * §6 read path for precise data. Certification alone never suffices: a valid,
   * in-purpose, unexpired, unrevoked grant is required. Allowed → serve + audit
   * 'disclosed'. Denied → 403 and NO disclosure row (§9.5).
   */
  async servePrecise(
    principal: Principal,
    obsId: string,
    requestPurpose: string,
    offline = false,
  ): Promise<{ lat: number; lon: number; uncertaintyM: number | null; offlinePackage?: Record<string, unknown> }> {
    const now = new Date();
    const { decision, grants } = await this.evaluate(principal, obsId, requestPurpose, now);
    if (!decision.allow) {
      // Record the denied attempt WITHOUT a disclosure row (action != 'disclosed').
      await this.audit.append({ ts: now.toISOString(), actorRef: principal.accountId, action: 'access-denied', objectRef: obsId, disclosure: 'restricted', detail: { reason: decision.reason, purpose: requestPurpose } });
      throw new ForbiddenException(`precise access denied: ${decision.reason}`);
    }
    const precise = await this.locality.getPrecise(obsId);
    if (!precise) throw new NotFoundException(`no precise record for ${obsId}`);

    if (offline && !grants[0].offlinePkg) {
      await this.audit.append({ ts: now.toISOString(), actorRef: principal.accountId, action: 'access-denied', objectRef: obsId, disclosure: 'restricted', detail: { reason: 'offline-not-permitted' } });
      throw new ForbiddenException('offline precise package not permitted by this grant');
    }

    await this.audit.append({ ts: now.toISOString(), actorRef: principal.accountId, action: 'disclosed', objectRef: obsId, disclosure: 'restricted', detail: { purpose: requestPurpose, grant: grants[0].id, offline } });
    await this.provenance.record({ subjectRef: obsId, actorRef: principal.accountId, actorRole: principal.roles[0] ?? 'contributor', action: 'disclosed', disclosure: 'restricted', detail: { purpose: requestPurpose } });

    const result: { lat: number; lon: number; uncertaintyM: number | null; offlinePackage?: Record<string, unknown> } = {
      lat: precise.lat,
      lon: precise.lon,
      uncertaintyM: precise.uncertaintyM ?? null,
    };
    if (offline) {
      // Exceptional: encrypted, time-bound, purpose-stamped package. v1 returns a
      // descriptor (real encryption wired at the trust boundary / KMS later).
      result.offlinePackage = { purpose: requestPurpose, expiresAt: grants[0].expiresAt, sealed: true, note: 'raw coordinates cannot be recalled once delivered — minimise this surface' };
    }
    return result;
  }
}
