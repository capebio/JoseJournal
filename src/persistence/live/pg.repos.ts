import { Injectable } from '@nestjs/common';
import type {
  AiDeclarationRepo,
  AuditRepo,
  CitationRepo,
  ConsentRepo,
  IdentityRepo,
  LocalityRepo,
  ProvenanceRepo,
  ReleaseRepo,
  ReviewRepo,
  TaxonomyRepo,
} from '@core/ports';
import type {
  AccessGrant,
  Account,
  AiDeclaration,
  Assertion,
  AuditLedgerEntry,
  Certification,
  CoauthorConsent,
  DoiRegistryEntry,
  IdentityRecord,
  LocalityPrecise,
  NomName,
  NomenclaturalAct,
  ProvenanceEvent,
  Release,
  ReviewThread,
  SnippetAnchor,
  TaxonConcept,
  TrustEvent,
} from '@core/types';
import { PgPool } from './pg-pool';

// ── row mappers (snake_case columns -> camelCase domain types) ───────────────
const prov = (r: any): ProvenanceEvent => ({
  id: r.id, subjectRef: r.subject_ref, actorRef: r.actor_ref, actorRole: r.actor_role,
  action: r.action, ts: r.ts.toISOString?.() ?? r.ts, disclosure: r.disclosure, detail: r.detail,
});
const name = (r: any): NomName => ({
  id: r.id, nameString: r.name_string, authorship: r.authorship, rank: r.rank,
  code: r.code, nomStatus: r.nom_status, registration: r.registration,
});
const concept = (r: any): TaxonConcept => ({
  id: r.id, nameId: r.name_id, secVersion: r.sec_version, circumscription: r.circumscription,
  createdAt: r.created_at?.toISOString?.() ?? r.created_at,
});
const assertion = (r: any): Assertion => ({
  id: r.id, conceptId: r.concept_id, subjectRef: r.subject_ref, evidenceRefs: r.evidence_refs,
  assertedBy: r.asserted_by, ts: r.ts?.toISOString?.() ?? r.ts,
});
const act = (r: any): NomenclaturalAct => ({
  id: r.id, nameId: r.name_id, actType: r.act_type, code: r.code,
  governingDecision: r.governing_decision, vorVersion: r.vor_version, ts: r.ts?.toISOString?.() ?? r.ts,
});
const account = (r: any): Account => ({
  id: r.id, keycloakSub: r.keycloak_sub, orcid: r.orcid, displayName: r.display_name,
  assurance: r.assurance, createdAt: r.created_at?.toISOString?.() ?? r.created_at,
});
const idrec = (r: any): IdentityRecord => ({
  id: r.id, displayName: r.display_name, externalIds: r.external_ids, curatedBy: r.curated_by, claimedBy: r.claimed_by,
});
const cert = (r: any): Certification => ({
  id: r.id, accountId: r.account_id, vouchedBy: r.vouched_by, status: r.status,
  scope: r.scope, ts: r.ts?.toISOString?.() ?? r.ts,
});
const grantRow = (r: any): AccessGrant => ({
  id: r.id, grantee: r.grantee, objectRef: r.object_ref, purpose: r.purpose, grantedBy: r.granted_by,
  grantedAt: r.granted_at?.toISOString?.() ?? r.granted_at, expiresAt: r.expires_at?.toISOString?.() ?? r.expires_at,
  revokedAt: r.revoked_at ? (r.revoked_at.toISOString?.() ?? r.revoked_at) : null, offlinePkg: r.offline_pkg,
});
const precise = (r: any): LocalityPrecise => ({
  obsId: r.obs_id, lat: Number(r.lat), lon: Number(r.lon), uncertaintyM: r.uncertainty_m, sensitivity: r.sensitivity, source: r.source,
});
const release = (r: any): Release => ({
  id: r.id, koId: r.ko_id, versionId: r.version_id, tier: r.tier, doi: r.doi,
  releasedBy: r.released_by, releasedAt: r.released_at?.toISOString?.() ?? r.released_at,
});
const doi = (r: any): DoiRegistryEntry => ({
  doi: r.doi, versionId: r.version_id, koId: r.ko_id, agency: r.agency,
  mintedAt: r.minted_at?.toISOString?.() ?? r.minted_at, metadata: r.metadata,
});
const consent = (r: any): CoauthorConsent => ({
  id: r.id, koId: r.ko_id, candidate: r.candidate, state: r.state,
  requestedAt: r.requested_at?.toISOString?.() ?? r.requested_at,
  deadline: r.deadline ? (r.deadline.toISOString?.() ?? r.deadline) : null,
  resolvedAt: r.resolved_at ? (r.resolved_at.toISOString?.() ?? r.resolved_at) : null,
});
const review = (r: any): ReviewThread => ({
  id: r.id, koId: r.ko_id, reviewer: r.reviewer, relevanceScore: r.relevance_score == null ? undefined : Number(r.relevance_score),
  disposition: r.disposition, comment: r.comment, authorReply: r.author_reply, ts: r.ts?.toISOString?.() ?? r.ts,
});
const snippet = (r: any): SnippetAnchor => ({
  id: r.id, versionId: r.version_id, sectionPath: r.section_path, blockId: r.block_id,
  quotedText: r.quoted_text, contentHash: r.content_hash,
});
const aidecl = (r: any): AiDeclaration => ({
  koId: r.ko_id, coverage: r.coverage, role: r.role, model: r.model, accountableHuman: r.accountable_human,
  percentage: r.percentage == null ? null : Number(r.percentage), recordedAt: r.recorded_at?.toISOString?.() ?? r.recorded_at,
});

@Injectable()
export class PgProvenanceRepo implements ProvenanceRepo {
  constructor(private readonly pg: PgPool) {}
  async append(e: ProvenanceEvent) {
    await this.pg.query(
      `INSERT INTO provenance_event (id, subject_ref, actor_ref, actor_role, action, ts, disclosure, detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
      [e.id, e.subjectRef, e.actorRef, e.actorRole, e.action, e.ts, e.disclosure, e.detail],
    );
    return e;
  }
  async listPublicForSubject(subjectRef: string) {
    return (await this.pg.query(`SELECT * FROM provenance_event WHERE subject_ref=$1 AND disclosure='public' ORDER BY ts`, [subjectRef])).map(prov);
  }
  async listAllForSubject(subjectRef: string) {
    return (await this.pg.query(`SELECT * FROM provenance_event WHERE subject_ref=$1 ORDER BY ts`, [subjectRef])).map(prov);
  }
}

@Injectable()
export class PgTaxonomyRepo implements TaxonomyRepo {
  constructor(private readonly pg: PgPool) {}
  async createName(n: NomName) {
    await this.pg.query(
      `INSERT INTO nom_name (id, name_string, authorship, rank, code, nom_status, registration) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [n.id, n.nameString, n.authorship, n.rank, n.code, n.nomStatus, n.registration],
    );
    return n;
  }
  async getName(id: string) {
    const r = await this.pg.query(`SELECT * FROM nom_name WHERE id=$1`, [id]);
    return r[0] ? name(r[0]) : null;
  }
  async createConcept(c: TaxonConcept) {
    await this.pg.query(
      `INSERT INTO taxon_concept (id, name_id, sec_version, circumscription, created_at) VALUES ($1,$2,$3,$4,$5)`,
      [c.id, c.nameId, c.secVersion, c.circumscription, c.createdAt],
    );
    return c;
  }
  async getConcept(id: string) {
    const r = await this.pg.query(`SELECT * FROM taxon_concept WHERE id=$1`, [id]);
    return r[0] ? concept(r[0]) : null;
  }
  async listConceptsForName(nameId: string) {
    return (await this.pg.query(`SELECT * FROM taxon_concept WHERE name_id=$1 ORDER BY created_at`, [nameId])).map(concept);
  }
  async createAssertion(a: Assertion) {
    await this.pg.query(
      `INSERT INTO assertion (id, concept_id, subject_ref, evidence_refs, asserted_by, ts) VALUES ($1,$2,$3,$4,$5,$6)`,
      [a.id, a.conceptId, a.subjectRef, a.evidenceRefs, a.assertedBy, a.ts],
    );
    return a;
  }
  async listAssertionsForConcept(conceptId: string) {
    return (await this.pg.query(`SELECT * FROM assertion WHERE concept_id=$1 ORDER BY ts`, [conceptId])).map(assertion);
  }
  async createAct(a: NomenclaturalAct) {
    await this.pg.query(
      `INSERT INTO nomenclatural_act (id, name_id, act_type, code, governing_decision, vor_version, ts) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [a.id, a.nameId, a.actType, a.code, a.governingDecision, a.vorVersion, a.ts],
    );
    return a;
  }
}

@Injectable()
export class PgIdentityRepo implements IdentityRepo {
  constructor(private readonly pg: PgPool) {}
  async createAccount(a: Account) {
    await this.pg.query(
      `INSERT INTO account (id, keycloak_sub, orcid, display_name, assurance, created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
      [a.id, a.keycloakSub, a.orcid, a.displayName, a.assurance, a.createdAt],
    );
    return a;
  }
  async getAccount(id: string) {
    const r = await this.pg.query(`SELECT * FROM account WHERE id=$1`, [id]);
    return r[0] ? account(r[0]) : null;
  }
  async getAccountByKeycloakSub(sub: string) {
    const r = await this.pg.query(`SELECT * FROM account WHERE keycloak_sub=$1`, [sub]);
    return r[0] ? account(r[0]) : null;
  }
  async updateAccount(a: Account) {
    await this.pg.query(`UPDATE account SET orcid=$2, display_name=$3, assurance=$4 WHERE id=$1`, [a.id, a.orcid, a.displayName, a.assurance]);
    return a;
  }
  async createIdentityRecord(r: IdentityRecord) {
    await this.pg.query(
      `INSERT INTO identity_record (id, display_name, external_ids, curated_by, claimed_by) VALUES ($1,$2,$3,$4,$5)`,
      [r.id, r.displayName, r.externalIds, r.curatedBy, r.claimedBy],
    );
    return r;
  }
  async getIdentityRecord(id: string) {
    const r = await this.pg.query(`SELECT * FROM identity_record WHERE id=$1`, [id]);
    return r[0] ? idrec(r[0]) : null;
  }
  async createCertification(c: Certification) {
    await this.pg.query(
      `INSERT INTO certification (id, account_id, vouched_by, status, scope, ts) VALUES ($1,$2,$3,$4,$5,$6)`,
      [c.id, c.accountId, c.vouchedBy, c.status, c.scope, c.ts],
    );
    return c;
  }
  async getCertification(id: string) {
    const r = await this.pg.query(`SELECT * FROM certification WHERE id=$1`, [id]);
    return r[0] ? cert(r[0]) : null;
  }
  async updateCertification(c: Certification) {
    await this.pg.query(`UPDATE certification SET vouched_by=$2, status=$3, scope=$4 WHERE id=$1`, [c.id, c.vouchedBy, c.status, c.scope]);
    return c;
  }
  async addTrustEvent(e: Omit<TrustEvent, 'id'>) {
    const r = await this.pg.query(
      `INSERT INTO trust_event (account_id, kind, weight, basis_ref, ts) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [e.accountId, e.kind, e.weight, e.basisRef, e.ts],
    );
    return { ...e, id: r[0].id } as TrustEvent;
  }
  async computeTrustScore(accountId: string) {
    const r = await this.pg.query(`SELECT COALESCE(SUM(weight),0) AS score FROM trust_event WHERE account_id=$1`, [accountId]);
    return Number(r[0].score);
  }
}

@Injectable()
export class PgLocalityRepo implements LocalityRepo {
  constructor(private readonly pg: PgPool) {}
  async putPrecise(p: LocalityPrecise) {
    await this.pg.query(
      `INSERT INTO locality_precise (obs_id, lat, lon, uncertainty_m, sensitivity, source) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (obs_id) DO UPDATE SET lat=$2, lon=$3, uncertainty_m=$4, sensitivity=$5, source=$6`,
      [p.obsId, p.lat, p.lon, p.uncertaintyM, p.sensitivity, p.source],
    );
  }
  async getPrecise(obsId: string) {
    const r = await this.pg.query(`SELECT * FROM locality_precise WHERE obs_id=$1`, [obsId]);
    return r[0] ? precise(r[0]) : null;
  }
  async createGrant(g: AccessGrant) {
    await this.pg.query(
      `INSERT INTO access_grant (id, grantee, object_ref, purpose, granted_by, granted_at, expires_at, revoked_at, offline_pkg)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [g.id, g.grantee, g.objectRef, g.purpose, g.grantedBy, g.grantedAt, g.expiresAt, g.revokedAt, g.offlinePkg],
    );
    return g;
  }
  async getGrant(id: string) {
    const r = await this.pg.query(`SELECT * FROM access_grant WHERE id=$1`, [id]);
    return r[0] ? grantRow(r[0]) : null;
  }
  async activeGrants(grantee: string, objectRef: string, now: Date) {
    return (
      await this.pg.query(
        `SELECT * FROM access_grant WHERE grantee=$1 AND object_ref=$2 AND revoked_at IS NULL AND expires_at > $3`,
        [grantee, objectRef, now.toISOString()],
      )
    ).map(grantRow);
  }
  async revokeGrant(id: string, at: string) {
    await this.pg.query(`UPDATE access_grant SET revoked_at=$2 WHERE id=$1`, [id, at]);
  }
}

@Injectable()
export class PgReleaseRepo implements ReleaseRepo {
  constructor(private readonly pg: PgPool) {}
  async createRelease(r: Release) {
    await this.pg.query(
      `INSERT INTO release (id, ko_id, version_id, tier, doi, released_by, released_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [r.id, r.koId, r.versionId, r.tier, r.doi, r.releasedBy, r.releasedAt],
    );
    return r;
  }
  async getReleaseForVersion(versionId: string) {
    const r = await this.pg.query(`SELECT * FROM release WHERE version_id=$1 LIMIT 1`, [versionId]);
    return r[0] ? release(r[0]) : null;
  }
  async listReleasesForKo(koId: string) {
    return (await this.pg.query(`SELECT * FROM release WHERE ko_id=$1 ORDER BY released_at`, [koId])).map(release);
  }
  async mintDoi(e: DoiRegistryEntry) {
    await this.pg.query(
      `INSERT INTO doi_registry (doi, version_id, ko_id, agency, minted_at, metadata) VALUES ($1,$2,$3,$4,$5,$6)`,
      [e.doi, e.versionId, e.koId, e.agency, e.mintedAt, e.metadata],
    );
    return e;
  }
  async getDoi(d: string) {
    const r = await this.pg.query(`SELECT * FROM doi_registry WHERE doi=$1`, [d]);
    return r[0] ? doi(r[0]) : null;
  }
  async getDoiForVersion(versionId: string) {
    const r = await this.pg.query(`SELECT * FROM doi_registry WHERE version_id=$1 LIMIT 1`, [versionId]);
    return r[0] ? doi(r[0]) : null;
  }
}

@Injectable()
export class PgConsentRepo implements ConsentRepo {
  constructor(private readonly pg: PgPool) {}
  async create(c: CoauthorConsent) {
    await this.pg.query(
      `INSERT INTO coauthor_consent (id, ko_id, candidate, state, requested_at, deadline, resolved_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [c.id, c.koId, c.candidate, c.state, c.requestedAt, c.deadline, c.resolvedAt],
    );
    return c;
  }
  async get(id: string) {
    const r = await this.pg.query(`SELECT * FROM coauthor_consent WHERE id=$1`, [id]);
    return r[0] ? consent(r[0]) : null;
  }
  async listForKo(koId: string) {
    return (await this.pg.query(`SELECT * FROM coauthor_consent WHERE ko_id=$1 ORDER BY requested_at`, [koId])).map(consent);
  }
  async update(c: CoauthorConsent) {
    await this.pg.query(`UPDATE coauthor_consent SET state=$2, resolved_at=$3, deadline=$4 WHERE id=$1`, [c.id, c.state, c.resolvedAt, c.deadline]);
    return c;
  }
}

@Injectable()
export class PgReviewRepo implements ReviewRepo {
  constructor(private readonly pg: PgPool) {}
  async create(t: ReviewThread) {
    await this.pg.query(
      `INSERT INTO review_thread (id, ko_id, reviewer, relevance_score, disposition, comment, author_reply, ts) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [t.id, t.koId, t.reviewer, t.relevanceScore, t.disposition, t.comment, t.authorReply, t.ts],
    );
    return t;
  }
  async get(id: string) {
    const r = await this.pg.query(`SELECT * FROM review_thread WHERE id=$1`, [id]);
    return r[0] ? review(r[0]) : null;
  }
  async listForKo(koId: string) {
    return (await this.pg.query(`SELECT * FROM review_thread WHERE ko_id=$1 ORDER BY ts`, [koId])).map(review);
  }
  async update(t: ReviewThread) {
    await this.pg.query(`UPDATE review_thread SET disposition=$2, comment=$3, author_reply=$4, relevance_score=$5 WHERE id=$1`,
      [t.id, t.disposition, t.comment, t.authorReply, t.relevanceScore]);
    return t;
  }
}

@Injectable()
export class PgCitationRepo implements CitationRepo {
  constructor(private readonly pg: PgPool) {}
  async createSnippet(s: SnippetAnchor) {
    await this.pg.query(
      `INSERT INTO snippet_anchor (id, version_id, section_path, block_id, quoted_text, content_hash) VALUES ($1,$2,$3,$4,$5,$6)`,
      [s.id, s.versionId, s.sectionPath, s.blockId, s.quotedText, s.contentHash],
    );
    return s;
  }
  async getSnippet(id: string) {
    const r = await this.pg.query(`SELECT * FROM snippet_anchor WHERE id=$1`, [id]);
    return r[0] ? snippet(r[0]) : null;
  }
}

@Injectable()
export class PgAuditRepo implements AuditRepo {
  constructor(private readonly pg: PgPool) {}
  async append(entry: Omit<AuditLedgerEntry, 'id'>) {
    const r = await this.pg.query(
      `INSERT INTO audit_ledger (ts, actor_ref, action, object_ref, disclosure, detail) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [entry.ts, entry.actorRef, entry.action, entry.objectRef, entry.disclosure, entry.detail],
    );
    return { ...entry, id: r[0].id } as AuditLedgerEntry;
  }
  async list(filter?: { objectRef?: string; action?: string; actorRef?: string }) {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filter?.objectRef) { params.push(filter.objectRef); clauses.push(`object_ref=$${params.length}`); }
    if (filter?.action) { params.push(filter.action); clauses.push(`action=$${params.length}`); }
    if (filter?.actorRef) { params.push(filter.actorRef); clauses.push(`actor_ref=$${params.length}`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await this.pg.query(`SELECT * FROM audit_ledger ${where} ORDER BY id`, params);
    return rows.map((r: any) => ({ id: r.id, ts: r.ts?.toISOString?.() ?? r.ts, actorRef: r.actor_ref, action: r.action, objectRef: r.object_ref, disclosure: r.disclosure, detail: r.detail }));
  }
}

@Injectable()
export class PgAiDeclarationRepo implements AiDeclarationRepo {
  constructor(private readonly pg: PgPool) {}
  async put(d: AiDeclaration) {
    await this.pg.query(
      `INSERT INTO ai_declaration (ko_id, coverage, role, model, accountable_human, percentage, recorded_at) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (ko_id) DO UPDATE SET coverage=$2, role=$3, model=$4, accountable_human=$5, percentage=$6, recorded_at=$7`,
      [d.koId, d.coverage, d.role, d.model, d.accountableHuman, d.percentage, d.recordedAt],
    );
    return d;
  }
  async getForKo(koId: string) {
    const r = await this.pg.query(`SELECT * FROM ai_declaration WHERE ko_id=$1`, [koId]);
    return r[0] ? aidecl(r[0]) : null;
  }
}
