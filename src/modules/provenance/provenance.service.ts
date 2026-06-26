import { Inject, Injectable } from '@nestjs/common';
import { PORTS, type ProvenanceRepo } from '@core/ports';
import type { ActorRole, Disclosure, ProvenanceAction, ProvenanceEvent } from '@core/types';
import { mintId } from '@core/ids';

export interface RecordProvenanceInput {
  subjectRef: string; // ver:… | blk:… | claim:… | ko:…
  actorRef: string; // acct:… | idrec:… | ai:<model>
  actorRole: ActorRole;
  action: ProvenanceAction | string;
  disclosure?: Disclosure; // default 'public'
  detail?: Record<string, unknown>;
}

/**
 * The spine of total provenance (§8 guiding doc, §3.4). Every content-mutating
 * path in every module calls record(); provenance is ALWAYS written in full, and
 * the `disclosure` field — not omission — governs whether it surfaces publicly.
 * Shared so no module re-implements the ledger write.
 */
@Injectable()
export class ProvenanceService {
  constructor(@Inject(PORTS.ProvenanceRepo) private readonly repo: ProvenanceRepo) {}

  async record(input: RecordProvenanceInput): Promise<ProvenanceEvent> {
    const event: ProvenanceEvent = {
      id: mintId('prov'),
      subjectRef: input.subjectRef,
      actorRef: input.actorRef,
      actorRole: input.actorRole,
      action: input.action,
      ts: new Date().toISOString(),
      disclosure: input.disclosure ?? 'public',
      detail: input.detail ?? {},
    };
    return this.repo.append(event);
  }

  /** Public events only — what the public Couch projection exposes. */
  publicForSubject(subjectRef: string): Promise<ProvenanceEvent[]> {
    return this.repo.listPublicForSubject(subjectRef);
  }

  /** Full record incl. non-public — only via audited/authorised endpoint. */
  allForSubject(subjectRef: string): Promise<ProvenanceEvent[]> {
    return this.repo.listAllForSubject(subjectRef);
  }
}
