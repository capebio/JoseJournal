/**
 * Persistence ports (hexagonal). Modules depend ONLY on these interfaces via DI
 * tokens; the spine provides both in-memory (deterministic, §9 CI) and live
 * (Couch/Postgres/Elastic/Redis/MinIO) adapters. This is what lets §9 acceptance
 * criteria pass in CI without services while the same code runs the live stack.
 *
 * Authority map (§2 data-plane): Couch owns content/versions/public projections;
 * Postgres owns every scholarly/legal state transition; Elastic is index-only.
 */
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
  KnowledgeObjectEntity,
  LocalityPrecise,
  NomName,
  NomenclaturalAct,
  ObservationPublic,
  ProvenanceEvent,
  Release,
  ReviewThread,
  SnippetAnchor,
  TaxonConcept,
  TrustEvent,
  VersionDoc,
} from './types';

// ── DI tokens ────────────────────────────────────────────────────────────────
export const PORTS = {
  KnowledgeObjectRepo: 'KnowledgeObjectRepo',
  ProvenanceRepo: 'ProvenanceRepo',
  TaxonomyRepo: 'TaxonomyRepo',
  IdentityRepo: 'IdentityRepo',
  LocalityRepo: 'LocalityRepo',
  ReleaseRepo: 'ReleaseRepo',
  ConsentRepo: 'ConsentRepo',
  ReviewRepo: 'ReviewRepo',
  CitationRepo: 'CitationRepo',
  MediaRepo: 'MediaRepo',
  AuditRepo: 'AuditRepo',
  AiDeclarationRepo: 'AiDeclarationRepo',
  SearchPort: 'SearchPort',
  UnitOfWork: 'UnitOfWork',
} as const;

/**
 * Transaction boundary for control-plane writes that must be atomic
 * (e.g. tagVoR: release + doi_registry + provenance in one commit, §5).
 * In-memory implementation runs the body and rolls back its staged ops on throw.
 */
export interface UnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T>;
}

// ── Couch: knowledge objects (entity + immutable versions) ───────────────────
export interface KnowledgeObjectRepo {
  createEntity(entity: KnowledgeObjectEntity): Promise<KnowledgeObjectEntity>;
  getEntity(koId: string): Promise<KnowledgeObjectEntity | null>;
  updateEntity(entity: KnowledgeObjectEntity): Promise<KnowledgeObjectEntity>;
  /** Idempotent: writing a version whose _id (content hash) already exists is a no-op. */
  putVersion(version: VersionDoc): Promise<VersionDoc>;
  getVersion(versionId: string): Promise<VersionDoc | null>;
  /** All versions of a KO, for history/DAG (§7 /history). */
  listVersions(koId: string): Promise<VersionDoc[]>;
  /** Public projection store (the only DB an untrusted client replicates). */
  putPublicProjection(id: string, doc: Record<string, unknown>): Promise<void>;
  getPublicProjection(id: string): Promise<Record<string, unknown> | null>;
  /** Everything currently in the public DB (for leakage tests / replication sim). */
  dumpPublic(): Promise<Record<string, Record<string, unknown>>>;
}

// ── Postgres: provenance ledger (+ public projection) ────────────────────────
export interface ProvenanceRepo {
  append(event: ProvenanceEvent): Promise<ProvenanceEvent>;
  /** Public events only (disclosure='public') — what the public projection exposes. */
  listPublicForSubject(subjectRef: string): Promise<ProvenanceEvent[]>;
  /** Full record incl. non-public — only reachable via audited/authorised endpoint. */
  listAllForSubject(subjectRef: string): Promise<ProvenanceEvent[]>;
}

// ── Postgres: TDWG concept model ─────────────────────────────────────────────
export interface TaxonomyRepo {
  createName(name: NomName): Promise<NomName>;
  getName(id: string): Promise<NomName | null>;
  createConcept(concept: TaxonConcept): Promise<TaxonConcept>;
  getConcept(id: string): Promise<TaxonConcept | null>;
  /** All competing concepts on one name — they coexist, none overwrites (§9.7). */
  listConceptsForName(nameId: string): Promise<TaxonConcept[]>;
  createAssertion(a: Assertion): Promise<Assertion>;
  listAssertionsForConcept(conceptId: string): Promise<Assertion[]>;
  createAct(act: NomenclaturalAct): Promise<NomenclaturalAct>;
}

// ── Postgres: identity / assurance / trust ───────────────────────────────────
export interface IdentityRepo {
  createAccount(a: Account): Promise<Account>;
  getAccount(id: string): Promise<Account | null>;
  getAccountByKeycloakSub(sub: string): Promise<Account | null>;
  updateAccount(a: Account): Promise<Account>;
  createIdentityRecord(r: IdentityRecord): Promise<IdentityRecord>;
  getIdentityRecord(id: string): Promise<IdentityRecord | null>;
  createCertification(c: Certification): Promise<Certification>;
  getCertification(id: string): Promise<Certification | null>;
  updateCertification(c: Certification): Promise<Certification>;
  addTrustEvent(e: Omit<TrustEvent, 'id'>): Promise<TrustEvent>;
  computeTrustScore(accountId: string): Promise<number>;
}

// ── Postgres + Couch: localities (the anti-poaching split, §6) ───────────────
export interface LocalityRepo {
  putPrecise(p: LocalityPrecise): Promise<void>;
  getPrecise(obsId: string): Promise<LocalityPrecise | null>;
  createGrant(g: AccessGrant): Promise<AccessGrant>;
  getGrant(id: string): Promise<AccessGrant | null>;
  /** Active (unexpired, unrevoked) grants for grantee+object at instant `now`. */
  activeGrants(grantee: string, objectRef: string, now: Date): Promise<AccessGrant[]>;
  revokeGrant(id: string, at: string): Promise<void>;
}

// ── Postgres: releases + DOI registry ────────────────────────────────────────
export interface ReleaseRepo {
  createRelease(r: Release): Promise<Release>;
  getReleaseForVersion(versionId: string): Promise<Release | null>;
  listReleasesForKo(koId: string): Promise<Release[]>;
  mintDoi(entry: DoiRegistryEntry): Promise<DoiRegistryEntry>;
  getDoi(doi: string): Promise<DoiRegistryEntry | null>;
  getDoiForVersion(versionId: string): Promise<DoiRegistryEntry | null>;
}

// ── Postgres: co-author consent ──────────────────────────────────────────────
export interface ConsentRepo {
  create(c: CoauthorConsent): Promise<CoauthorConsent>;
  get(id: string): Promise<CoauthorConsent | null>;
  listForKo(koId: string): Promise<CoauthorConsent[]>;
  update(c: CoauthorConsent): Promise<CoauthorConsent>;
}

// ── Postgres: review threads ─────────────────────────────────────────────────
export interface ReviewRepo {
  create(t: ReviewThread): Promise<ReviewThread>;
  get(id: string): Promise<ReviewThread | null>;
  listForKo(koId: string): Promise<ReviewThread[]>;
  update(t: ReviewThread): Promise<ReviewThread>;
}

// ── Postgres: snippet anchors ────────────────────────────────────────────────
export interface CitationRepo {
  createSnippet(s: SnippetAnchor): Promise<SnippetAnchor>;
  getSnippet(id: string): Promise<SnippetAnchor | null>;
}

// ── Swift/MinIO: content-addressed media ─────────────────────────────────────
export interface MediaObjectMeta {
  id: string; // media:…
  contentAddress: string; // sha256-… (the master's address; never a path)
  mime: string;
  bytes: number;
  /** Derivative descriptors (jxl, iiif) keyed by kind. */
  derivatives: Record<string, { contentAddress: string; mime: string; maxEdge?: number }>;
  /** The maximum edge (px) needed to verify the diagnostic characters this media supports. */
  verificationMaxEdge?: number;
  exifStripped: boolean;
}

export interface MediaRepo {
  putMaster(meta: MediaObjectMeta, bytes: Buffer): Promise<MediaObjectMeta>;
  getMeta(id: string): Promise<MediaObjectMeta | null>;
  getBytes(contentAddress: string): Promise<Buffer | null>;
  putDerivative(id: string, kind: string, meta: { contentAddress: string; mime: string; maxEdge?: number }, bytes: Buffer): Promise<void>;
}

// ── Postgres: append-only audit ledger ───────────────────────────────────────
export interface AuditRepo {
  append(entry: Omit<AuditLedgerEntry, 'id'>): Promise<AuditLedgerEntry>;
  list(filter?: { objectRef?: string; action?: string }): Promise<AuditLedgerEntry[]>;
}

// ── Postgres: AI provenance declarations ─────────────────────────────────────
export interface AiDeclarationRepo {
  put(d: AiDeclaration): Promise<AiDeclaration>;
  getForKo(koId: string): Promise<AiDeclaration | null>;
}

// ── Elastic: index only (rebuildable, never authority) ───────────────────────
export interface SearchDoc {
  id: string;
  koId: string;
  koType: string;
  status: string;
  tier: string;
  visibility: string;
  title: string;
  text: string;
  taxon?: string;
  localityQDS?: string;
  /** 'public' | 'restricted' — separate indices are kept (§8 SearchModule). */
  index: 'public' | 'restricted';
}

export interface SearchPort {
  index(doc: SearchDoc): Promise<void>;
  search(q: { text?: string; koType?: string; status?: string; index: 'public' | 'restricted' }): Promise<SearchDoc[]>;
}
