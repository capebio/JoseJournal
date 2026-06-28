/**
 * Typed endpoint functions — the @jose/core API surface (IS §7). Screens call
 * these; no hand-rolled request shapes elsewhere. One function per backend route.
 */
import { api, apiStatus } from './client';
import type { LensState } from '../lens/lens-url';
import type {
  AccessGrant, AiDeclaration, CiteResult, CoauthorConsent, DeskView, KnowledgeObjectContent, KnowledgeObjectEntity,
  MediaObjectMeta, NomName, ObservationPublic, ProvenanceEvent, ReadModel, ReviewThread, ReviewerDisposition,
  SearchDoc, SnippetAnchor, SnippetResolution, TaxonConcept, Tier, VersionDoc, Visibility,
} from './types';

const enc = encodeURIComponent;

function lensQuery(lens?: Partial<LensState>): string {
  if (!lens) return '';
  const p = new URLSearchParams();
  if (lens.version) p.set('version', lens.version);
  if (lens.depth) p.set('depth', lens.depth);
  if (lens.register) p.set('register', lens.register);
  if (lens.lang) p.set('language', lens.lang);
  const s = p.toString();
  return s ? `?${s}` : '';
}

// ── Knowledge objects & versioning ──────────────────────────────────────────
export const getReadModel = (koId: string, lens?: Partial<LensState>) =>
  api<ReadModel>(`/ko/${enc(koId)}${lensQuery(lens)}`);
export const getVersion = (koId: string, verId: string, lens?: Partial<LensState>) =>
  api<ReadModel>(`/ko/${enc(koId)}/v/${enc(verId)}${lensQuery({ ...lens, version: undefined })}`);
export const getHistory = (koId: string) =>
  api<Array<Pick<VersionDoc, '_id' | 'parent' | 'branch' | 'status' | 'createdAt' | 'doi' | 'authors'>>>(`/ko/${enc(koId)}/history`);
export const createKo = (body: { koType: string; tier?: Tier; content: KnowledgeObjectContent; visibility?: Visibility; authors?: string[]; conceptRef?: string }) =>
  api<{ entity: KnowledgeObjectEntity; version: VersionDoc }>(`/ko`, { method: 'POST', body });
export const saveDraft = (koId: string, content: KnowledgeObjectContent) =>
  api<VersionDoc>(`/ko/${enc(koId)}/draft`, { method: 'PUT', body: { content } });
export const amend = (koId: string, body: { baseVersionId: string; content: KnowledgeObjectContent; amendClass: 'trivial' | 'substantive' | 'structural'; status?: string }) =>
  api<VersionDoc>(`/ko/${enc(koId)}/amend`, { method: 'POST', body });
export const fork = (koId: string, fromVersionId: string) =>
  api<{ entity: KnowledgeObjectEntity; version: VersionDoc }>(`/ko/${enc(koId)}/fork`, { method: 'POST', body: { fromVersionId } });
/** Release — returns {release,doi,version} for journal, {release} for commons. 409 if review-gated. */
export const release = (koId: string, tier: Tier = 'journal', versionId?: string) =>
  apiStatus<{ release?: unknown; doi?: string; version?: VersionDoc; message?: string; blockers?: unknown[] }>(`/ko/${enc(koId)}/release`, { method: 'POST', body: { tier, versionId } });
export const exportKo = (koId: string, format: 'md' | 'docx' | 'jats' | 'json', version?: string) =>
  apiStatus<string>(`/ko/${enc(koId)}/export?format=${format}${version ? `&version=${enc(version)}` : ''}`);

// ── Provenance ──────────────────────────────────────────────────────────────
export const getProvenance = (koId: string) => api<ProvenanceEvent[]>(`/ko/${enc(koId)}/provenance`);

// ── Review & co-authors ─────────────────────────────────────────────────────
export const getReviews = (koId: string) => api<ReviewThread[]>(`/ko/${enc(koId)}/reviews`);
export const getCoauthors = (koId: string) => api<CoauthorConsent[]>(`/ko/${enc(koId)}/coauthors`);
export const nominateReviewer = (koId: string, reviewer: string) => api<ReviewThread>(`/ko/${enc(koId)}/reviewers`, { method: 'POST', body: { reviewer } });
export const submitReview = (koId: string, body: { threadId?: string; disposition: ReviewerDisposition; comment: string }) => api<ReviewThread>(`/ko/${enc(koId)}/review`, { method: 'POST', body });
export const replyReview = (koId: string, threadId: string, reply: string) => api<ReviewThread>(`/ko/${enc(koId)}/review/${enc(threadId)}/reply`, { method: 'POST', body: { reply } });
export const addCoauthor = (koId: string, candidate: string) => api<CoauthorConsent>(`/ko/${enc(koId)}/coauthors`, { method: 'POST', body: { candidate } });
export const respondCoauthor = (koId: string, id: string, response: 'confirmed' | 'declined' | 'negotiating') => api<CoauthorConsent>(`/ko/${enc(koId)}/coauthors/${enc(id)}/respond`, { method: 'POST', body: { response } });

// ── Citation ────────────────────────────────────────────────────────────────
export const cite = (koId: string, as: 'entity' | 'version' | 'doi' = 'version') => api<CiteResult>(`/cite/${enc(koId)}?as=${as}`);
export const createSnippet = (body: { versionId: string; sectionPath: string; blockId: string; quotedText?: string }) => api<SnippetAnchor>(`/snippets`, { method: 'POST', body });
export const resolveSnippet = (id: string) => api<SnippetResolution>(`/snippets/${enc(id)}`);

// ── Observations & localities ───────────────────────────────────────────────
export const createObservation = (body: { taxonConcept: string; lat: number; lon: number; sensitivity: 'normal' | 'sensitive' | 'highly-sensitive'; source: { system: string; id: string }; media?: string[]; note?: string; attachKo?: string }) =>
  api<{ koId: string; obsId: string; public: ObservationPublic }>(`/observations`, { method: 'POST', body });
export const decideObservation = (obsId: string, decision: 'accept' | 'reject', comment?: string) =>
  api<ObservationPublic>(`/observations/${enc(obsId)}/decision`, { method: 'POST', body: { decision, comment } });
export const getMap = (koId: string) => api<ObservationPublic[]>(`/map/${enc(koId)}`);
/** Request precise — 403 without an active grant (the policy-engine "access required" state, AC 11.5). */
export const getPrecise = (obsId: string, purpose: string, offline = false) =>
  apiStatus<{ lat: number; lon: number; uncertaintyM: number | null; offlinePackage?: unknown } | { message: string }>(`/localities/${enc(obsId)}/precise?purpose=${enc(purpose)}&offline=${offline}`);
export const issueGrant = (obsId: string, body: { grantee: string; purpose: string; ttlMs: number; offlinePkg?: boolean }) =>
  api<AccessGrant>(`/localities/${enc(obsId)}/access`, { method: 'POST', body });

// ── Authoring (AI declaration) ──────────────────────────────────────────────
export const putAiDeclaration = (koId: string, body: { coverage: 'recorded' | 'attested' | 'estimated'; role: string; model?: string; accountableHuman?: string; percentage?: number }) =>
  api<AiDeclaration>(`/ko/${enc(koId)}/ai-declaration`, { method: 'POST', body });
export const getAiDeclaration = (koId: string) => apiStatus<AiDeclaration>(`/ko/${enc(koId)}/ai-declaration`);

// ── Taxonomy ────────────────────────────────────────────────────────────────
export const createName = (body: { nameString: string; authorship?: string; rank?: string; code?: string }) => api<NomName>(`/names`, { method: 'POST', body });
export const createConcept = (body: { nameId: string; secVersion: string; circumscription?: Record<string, unknown> }) => api<TaxonConcept>(`/concepts`, { method: 'POST', body });
export const getConcept = (id: string) => api<TaxonConcept>(`/concepts/${enc(id)}`);
export const listConceptsForName = (nameId: string) => api<TaxonConcept[]>(`/names/${enc(nameId)}/concepts`);

// ── Identity / certification ────────────────────────────────────────────────
export const createIdentityRecord = (body: { displayName: string; externalIds?: Record<string, string> }) => api(`/identity/records`, { method: 'POST', body });
export const applyCertification = () => api(`/certification/apply`, { method: 'POST', body: {} });
export const vouchCertification = (id: string) => api(`/certification/${enc(id)}/vouch`, { method: 'POST', body: {} });

// ── Media ───────────────────────────────────────────────────────────────────
export const uploadMedia = (body: { mime: string; dataBase64: string; verificationMaxEdge?: number }) => api<MediaObjectMeta>(`/media`, { method: 'POST', body });
export const getMedia = (id: string, res?: number | 'verification') => api<{ free: boolean; watermark: boolean; address: string; mime: string; maxEdge?: number; tierNote?: string }>(`/media/${enc(id)}${res !== undefined ? `?res=${res}` : ''}`);

// ── Search ──────────────────────────────────────────────────────────────────
export const search = (q: { text?: string; koType?: string; status?: string; index?: 'public' | 'restricted' }) => {
  const p = new URLSearchParams();
  if (q.text) p.set('text', q.text);
  if (q.koType) p.set('koType', q.koType);
  if (q.status) p.set('status', q.status);
  p.set('index', q.index ?? 'public');
  return api<SearchDoc[]>(`/search?${p.toString()}`);
};

// ── Federation (read connectors) ────────────────────────────────────────────
export const federationTaxon = (name: string) => api(`/federation/taxon?name=${enc(name)}`);

// ── Desk (M7 per-user aggregation) ──────────────────────────────────────────
export const getDesk = () => api<DeskView>(`/desk`);
