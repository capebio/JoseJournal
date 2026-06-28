/**
 * Domain DTOs mirrored from the backend shared types (IS §3). The backend
 * OpenAPI omits response schemas (controllers lack @ApiResponse models), so these
 * hand-curated types are the typed contract; `openapi.d.ts` (generated) carries
 * the path/param inventory. Keep field names identical to the backend.
 */
export type KoType = 'treatment' | 'micro-observation' | 'dataset' | 'report' | 'article' | 'review' | 'method' | 'comment' | 'synthesis';
export type Tier = 'commons' | 'journal';
export type VersionStatus = 'raw' | 'verified' | 'reviewed' | 'vor' | 'superseded' | 'retracted';
export type Visibility = 'private' | 'collaborators' | 'public';
export type Assurance = 'unverified' | 'verified' | 'certified';
export type Register = 'academic' | 'popular';
export type DepthVariant = 'surface' | 'verbose';
export type ReviewerDisposition = 'green' | 'yellow' | 'orange' | 'red';
export type ActorRole = 'author' | 'contributor' | 'reviewer' | 'steward' | 'editor' | 'ai' | 'system';

export interface Lenses { language: string; depthVariants: DepthVariant[]; register: Register }

export interface Claim { statement: string; evidence: string[]; confidence: string }
export interface ContentBlock {
  blockId: string;
  type: string;
  text?: string;
  claims?: string[];
  captions?: Partial<Record<DepthVariant, string>>;
  media?: string[];
  origin?: 'human' | 'ai' | 'ai-human';
  restricted?: boolean;
}
export interface ContentSection { path: string; title?: string; blocks: ContentBlock[] }
/** A manuscript bibliography reference (§5.3). `jose` pins a living object at a version. */
export interface Reference {
  id: string;
  key: string;
  type: 'article' | 'book' | 'web' | 'jose';
  short: string;
  authors: string;
  year: string;
  title: string;
  source?: string;
  doi?: string | null;
  jose?: {
    concept: string;
    version: string;
    isVoR: boolean;
    tip?: string | null;
    section?: string | null;
    hash?: string | null;
  } | null;
}
export interface KnowledgeObjectContent {
  title: string;
  abstract?: string;
  sections: ContentSection[];
  claims: Record<string, Claim>;
  references?: Reference[];
}

export interface KnowledgeObjectEntity {
  _id: string;
  koType: KoType;
  tier: Tier;
  createdAt: string;
  refs: { tip: string; vor: string | null; branches: Record<string, string> };
  conceptRef?: string | null;
  subjectRefs?: string[];
}
export interface VersionDoc {
  _id: string;
  ko: string;
  parent: string | null;
  branch: string;
  createdAt: string;
  authors: string[];
  status: VersionStatus;
  visibility: Visibility;
  lenses: Lenses;
  content: KnowledgeObjectContent;
  provenanceRefs: string[];
  doi: string | null;
  contentHash: string;
}
export interface ReadModel {
  entity: KnowledgeObjectEntity;
  version: VersionDoc;
  relation: { isLatest: boolean; tip: string; vor: string | null; newerVersionExists: boolean };
}

export interface ProvenanceEvent {
  id: string; subjectRef: string; actorRef: string; actorRole: ActorRole;
  action: string; ts: string; disclosure: string; detail: Record<string, unknown>;
}
export interface ReviewThread {
  id: string; koId: string; reviewer: string; relevanceScore?: number;
  disposition: ReviewerDisposition; comment: string; authorReply?: string | null; ts: string;
}
export interface CoauthorConsent {
  id: string; koId: string; candidate: string;
  state: 'named-unconfirmed' | 'confirmed' | 'declined' | 'negotiating';
  requestedAt: string; deadline?: string | null; resolvedAt?: string | null;
}
export interface ObservationPublic {
  _id: string; ko: string; taxon: string; localityQDS: string;
  geometryGeneralised: { type: 'Polygon'; coordinates: number[][][] };
  source: { system: string; id: string }; media: string[];
  verification: 'raw' | 'verified' | 'rejected';
}
export interface SnippetAnchor {
  id: string; versionId: string; sectionPath: string; blockId: string; quotedText: string; contentHash: string;
}
export interface SnippetResolution {
  drift: boolean; koId: string; snippet: SnippetAnchor; block?: ContentBlock; citedText?: string; currentBlock?: ContentBlock; note?: string;
}
export interface CiteResult {
  koId: string; mode: 'entity' | 'version' | 'doi'; asOf: string; authors: string[]; title: string;
  entityUrl?: string; versionUrl?: string; doi?: string; note?: string;
}
export interface AiDeclaration {
  koId: string; coverage: 'recorded' | 'attested' | 'estimated'; role: string;
  model?: string | null; accountableHuman: string; percentage?: number | null; recordedAt: string;
  inferred?: boolean; authoritative?: boolean; note?: string;
}
export interface MediaObjectMeta {
  id: string; contentAddress: string; mime: string; bytes: number;
  derivatives: Record<string, { contentAddress: string; mime: string; maxEdge?: number }>;
  verificationMaxEdge?: number; exifStripped: boolean;
}
export interface SearchDoc {
  id: string; koId: string; koType: string; status: string; tier: string;
  visibility: string; title: string; text: string; taxon?: string; localityQDS?: string; index: 'public' | 'restricted';
}
export interface Account { id: string; keycloakSub: string; orcid?: string | null; displayName: string; assurance: Assurance; createdAt: string }
export interface Principal { sub: string; accountId: string; assurance: Assurance; roles: ActorRole[]; orcid?: string | null }
export interface AccessGrant {
  id: string; grantee: string; objectRef: string; purpose: string; grantedBy: string;
  grantedAt: string; expiresAt: string; revokedAt?: string | null; offlinePkg: boolean;
}
export interface NomName { id: string; nameString: string; authorship?: string | null; rank?: string | null; code?: string | null }

// ── M7 Desk (read-only per-user aggregation) ─────────────────────────────────
export type DeskLifecycle = 'draft' | 'under-review' | 'published';
export interface DeskObject { koId: string; title: string; lifecycle: DeskLifecycle; tier: string; status: string }
export interface DeskAttention { kind: 'review-reply' | 'coauthor-confirm' | 'verify-obs'; koId: string; title: string; detail: string; route: string }
export interface DeskFeedItem { id: number; ts: string; action: string; objectRef: string | null }
export interface DeskView {
  account: string;
  objects: DeskObject[];
  attention: DeskAttention[];
  feed: DeskFeedItem[];
  stats: { objects: number; published: number; underReview: number; attention: number };
}
export interface TaxonConcept { id: string; nameId: string; secVersion: string; circumscription?: Record<string, unknown> | null; createdAt: string }
