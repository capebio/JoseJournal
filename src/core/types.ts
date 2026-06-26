/**
 * JOSE v1 shared domain types (§3). These are the contract the whole monolith
 * codes against. Field names mirror the spec exactly so Couch docs, Postgres
 * rows, and TypeScript stay aligned.
 */

// ── Enumerations (§3.1) ──────────────────────────────────────────────────────
export type KoType =
  | 'treatment'
  | 'micro-observation'
  | 'dataset'
  | 'report'
  | 'article'
  | 'review'
  | 'method'
  | 'comment'
  | 'synthesis';

export type Tier = 'commons' | 'journal';

export type VersionStatus = 'raw' | 'verified' | 'reviewed' | 'vor' | 'superseded' | 'retracted';

export type Visibility = 'private' | 'collaborators' | 'public';

export type Disclosure =
  | 'public'
  | 'embargoed'
  | 'restricted'
  | 'sealed'
  | 'legally-suppressed'
  | 'anonymised-but-auditable';

export type ActorRole = 'author' | 'contributor' | 'reviewer' | 'steward' | 'editor' | 'ai' | 'system';

export type Assurance = 'unverified' | 'verified' | 'certified';

export type Register = 'academic' | 'popular';

export type DepthVariant = 'surface' | 'verbose';

// ── Lenses (§3.1 / §4) ───────────────────────────────────────────────────────
export interface Lenses {
  language: string; // ISO code; 'en' only in v1, but the axis is live
  depthVariants: DepthVariant[];
  register: Register;
}

// ── Knowledge Object: Entity / Version / Content (§3.1, §3.2) ────────────────
export interface VersionMeta {
  ko: string;
  parent: string | null;
  branch: string;
  authors: string[];
  status: VersionStatus;
  visibility: Visibility;
  lenses: Lenses;
}

export interface Claim {
  statement: string;
  /** obs:… | ver:…#blk:… | seq:GenBank:… — heterogeneous evidence refs. */
  evidence: string[];
  /** NOT a numeric truth score — JOSE is "not a truth machine". */
  confidence: 'author-asserted' | 'reviewed' | 'contested';
}

export type BlockType = 'paragraph' | 'figure' | 'table' | 'caption' | 'verbose' | 'claim-block';

export interface ContentBlock {
  blockId: string; // blk:… stable across amendments; new block = new id
  type: BlockType;
  text?: string;
  claims?: string[]; // claim:…
  captions?: Partial<Record<DepthVariant, string>>;
  /** media:… for figure blocks. */
  media?: string[];
  /**
   * Marks a block whose text encodes precise locality and must NEVER appear in
   * a public projection or be quotable via a snippet (§6 leakage checklist).
   */
  restricted?: boolean;
}

export interface ContentSection {
  path: string; // stable section slug, e.g. "description"
  title?: string;
  blocks: ContentBlock[];
}

export interface KnowledgeObjectContent {
  title: string;
  sections: ContentSection[];
  claims: Record<string, Claim>; // keyed by claim:…
}

export interface KnowledgeObjectEntity {
  '@context': string;
  '@type': 'KnowledgeObject';
  _id: string; // ko:…
  _rev?: string;
  koType: KoType;
  tier: Tier;
  createdAt: string; // ISO timestamp
  refs: {
    tip: string; // ver:…
    vor: string | null; // ver:…
    branches: Record<string, string>; // branchName -> ver:…
  };
  conceptRef?: string | null; // concept:… for treatments
  subjectRefs?: string[]; // obs:… for micro-observations
}

export interface VersionDoc {
  '@type': 'Version';
  _id: string; // ver:sha256-… (IS the content hash address)
  _rev?: string;
  ko: string;
  parent: string | null;
  branch: string;
  createdAt: string; // YYYY-MM-DD (mandatory, human-legible)
  authors: string[];
  status: VersionStatus;
  visibility: Visibility;
  lenses: Lenses;
  content: KnowledgeObjectContent;
  provenanceRefs: string[]; // prov:…
  doi: string | null; // set only when status='vor'
  contentHash: string; // sha256-… (redundant copy for integrity checks)
}

// ── Provenance (§3.4) ────────────────────────────────────────────────────────
export type ProvenanceAction =
  | 'created'
  | 'amended'
  | 'reviewed'
  | 'translated'
  | 'ai-generated'
  | 'ai-edited'
  | 'released'
  | 'retracted'
  | 'disclosed'
  | 'forked'
  | 'branched'
  | 'consent-requested'
  | 'consent-resolved';

export interface ProvenanceEvent {
  id: string; // prov:…
  subjectRef: string; // ver:… | blk:… | claim:… | ko:…
  actorRef: string; // acct:… | idrec:… | ai:<model>
  actorRole: ActorRole;
  action: ProvenanceAction | string;
  ts: string; // ISO
  disclosure: Disclosure;
  detail: Record<string, unknown>;
}

// ── TDWG concept model (§3.5) ────────────────────────────────────────────────
export interface NomName {
  id: string; // name:…
  nameString: string;
  authorship?: string | null;
  rank?: string | null;
  code?: 'ICN' | 'ICZN' | 'ICNP' | 'other' | null;
  nomStatus?: string | null;
  registration?: Record<string, string> | null; // {zoobank|ipni: id}
}

export interface TaxonConcept {
  id: string; // concept:…
  nameId: string; // name:…
  secVersion: string; // ver:… of the asserting Treatment ("sec.")
  circumscription?: Record<string, unknown> | null;
  createdAt: string;
}

export interface Assertion {
  id: string; // assert:…
  conceptId: string;
  subjectRef: string; // obs:… | specimen:… | ver:…
  evidenceRefs: string[];
  assertedBy: string; // acct:… | idrec:…
  ts: string;
}

export interface NomenclaturalAct {
  id: string; // act:…
  nameId: string;
  actType: string; // new_combination|synonymy|lectotypification|…
  code: string;
  governingDecision?: string | null;
  vorVersion?: string | null; // ver:… the valid protologue
  ts: string;
}

// ── Identity, assurance, trust (§3.6) ────────────────────────────────────────
export interface Account {
  id: string; // acct:…
  keycloakSub: string;
  orcid?: string | null;
  displayName: string;
  assurance: Assurance;
  createdAt: string;
}

export interface IdentityRecord {
  id: string; // idrec:…
  displayName: string;
  externalIds?: Record<string, string> | null; // {ipni, botanistAbbrev, bionomia, viaf, isni, wikidata}
  curatedBy?: string | null; // acct:…
  claimedBy?: string | null; // acct:…
}

export interface Certification {
  id: string; // cert:…
  accountId: string;
  vouchedBy: string[]; // acct:… (diverse, weighted by voucher trust)
  status: 'pending' | 'granted' | 'revoked';
  scope?: Record<string, unknown> | null;
  ts: string;
}

export interface TrustEvent {
  id: number;
  accountId: string;
  kind: 'contribution' | 'review' | 'correction' | 'endorsement' | 'integrity_breach';
  weight: number;
  basisRef?: string | null;
  ts: string;
}

// ── Observations & localities (§3.7) ─────────────────────────────────────────
export interface ObservationPublic {
  _id: string; // obs:…:public
  '@type': 'ObservationPublic';
  ko: string;
  taxon: string; // concept:…
  localityQDS: string; // QDS code only (~20x20km) — NEVER finer here
  geometryGeneralised: { type: 'Polygon'; coordinates: number[][][] };
  source: { system: string; id: string };
  media: string[]; // derivatives are EXIF-stripped
  verification: 'raw' | 'verified' | 'rejected';
}

export interface LocalityPrecise {
  obsId: string; // obs:…
  lat: number;
  lon: number;
  uncertaintyM?: number | null;
  sensitivity: 'normal' | 'sensitive' | 'highly-sensitive';
  source?: Record<string, unknown> | null;
}

// ── Control plane (§3.8) ─────────────────────────────────────────────────────
export interface Release {
  id: string; // release:…
  koId: string;
  versionId: string;
  tier: Tier;
  doi: string | null;
  releasedBy: string; // acct:…
  releasedAt: string;
}

export interface DoiRegistryEntry {
  doi: string;
  versionId: string;
  koId: string;
  agency: string;
  mintedAt: string;
  metadata?: Record<string, unknown> | null;
}

export interface CoauthorConsent {
  id: string; // consent:…
  koId: string;
  candidate: string; // acct:… | idrec:…
  state: 'named-unconfirmed' | 'confirmed' | 'declined' | 'negotiating';
  requestedAt: string;
  deadline?: string | null;
  resolvedAt?: string | null;
}

export interface AccessGrant {
  id: string; // grant:…
  grantee: string; // acct:…
  objectRef: string; // obs:… (object-specific)
  purpose: string; // purpose-bound
  grantedBy: string;
  grantedAt: string;
  expiresAt: string; // time-limited (mandatory)
  revokedAt?: string | null;
  offlinePkg: boolean; // exceptional
}

export interface AuditLedgerEntry {
  id: number;
  ts: string;
  actorRef: string;
  action: string;
  objectRef?: string | null;
  disclosure: Disclosure;
  detail: Record<string, unknown>;
}

// ── Citation — three identifiers + snippet anchor (§3.9) ─────────────────────
export interface SnippetAnchor {
  id: string; // snippet:…
  versionId: string; // ver:… (immutable — anchors NEVER point at an entity)
  sectionPath: string;
  blockId: string; // blk:…
  quotedText: string; // stored verbatim
  contentHash: string; // sha256 of the block at cite time (detects later drift)
}

// ── Review (§3.10) ───────────────────────────────────────────────────────────
export type ReviewerDisposition = 'green' | 'yellow' | 'orange' | 'red';

export interface ReviewThread {
  id: string; // review:…
  koId: string;
  reviewer: string; // acct:… (open identity)
  relevanceScore?: number; // AI-assessed reviewer↔subject relevance (advisory)
  disposition: ReviewerDisposition;
  comment: string;
  authorReply?: string | null; // required to exist for orange/red before release
  ts: string;
}

// ── Authoring / AI provenance declaration (§13 guiding doc, §7 authoring) ─────
export type AiCoverage = 'recorded' | 'attested' | 'estimated';

export interface AiDeclaration {
  koId: string;
  coverage: AiCoverage;
  role: string; // e.g. "drafting", "translation", "none"
  model?: string | null; // model/version
  accountableHuman: string; // acct:…
  percentage?: number | null; // only where instrumentation truly supports it
  recordedAt: string;
}

// ── Auth principal (resolved from the Keycloak JWT) ──────────────────────────
export interface Principal {
  sub: string; // keycloak subject
  accountId: string; // acct:…
  assurance: Assurance;
  roles: ActorRole[];
  orcid?: string | null;
}
