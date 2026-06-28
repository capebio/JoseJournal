import { Injectable } from '@nestjs/common';
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
  ProvenanceEvent,
  Release,
  ReviewThread,
  SnippetAnchor,
  TaxonConcept,
  TrustEvent,
  VersionDoc,
} from '@core/types';
import type {
  AiDeclarationRepo,
  AuditRepo,
  CitationRepo,
  ConsentRepo,
  IdentityRepo,
  KnowledgeObjectRepo,
  LocalityRepo,
  MediaObjectMeta,
  MediaRepo,
  ProvenanceRepo,
  ReleaseRepo,
  ReviewRepo,
  SearchDoc,
  SearchPort,
  TaxonomyRepo,
} from '@core/ports';
import { clone, MemoryDb } from './memory-db';

@Injectable()
export class MemoryKnowledgeObjectRepo implements KnowledgeObjectRepo {
  constructor(private readonly db: MemoryDb) {}
  async createEntity(e: KnowledgeObjectEntity) {
    this.db.entities.set(e._id, clone(e));
    return clone(e);
  }
  async getEntity(id: string) {
    const e = this.db.entities.get(id);
    return e ? clone(e) : null;
  }
  async updateEntity(e: KnowledgeObjectEntity) {
    this.db.entities.set(e._id, clone(e));
    return clone(e);
  }
  async putVersion(v: VersionDoc) {
    // Idempotent: the _id IS the content hash; identical content is a natural no-op.
    if (!this.db.versions.has(v._id)) this.db.versions.set(v._id, clone(v));
    return clone(this.db.versions.get(v._id)!);
  }
  async getVersion(id: string) {
    const v = this.db.versions.get(id);
    return v ? clone(v) : null;
  }
  async listVersions(koId: string) {
    return [...this.db.versions.values()].filter((v) => v.ko === koId).map(clone);
  }
  async putPublicProjection(id: string, doc: Record<string, unknown>) {
    this.db.publicProjections.set(id, clone(doc));
  }
  async getPublicProjection(id: string) {
    const d = this.db.publicProjections.get(id);
    return d ? clone(d) : null;
  }
  async dumpPublic() {
    const out: Record<string, Record<string, unknown>> = {};
    for (const [k, v] of this.db.publicProjections) out[k] = clone(v);
    return out;
  }
}

@Injectable()
export class MemoryProvenanceRepo implements ProvenanceRepo {
  constructor(private readonly db: MemoryDb) {}
  async append(e: ProvenanceEvent) {
    this.db.provenance.push(clone(e));
    return clone(e);
  }
  async listPublicForSubject(subjectRef: string) {
    return this.db.provenance.filter((p) => p.subjectRef === subjectRef && p.disclosure === 'public').map(clone);
  }
  async listAllForSubject(subjectRef: string) {
    return this.db.provenance.filter((p) => p.subjectRef === subjectRef).map(clone);
  }
}

@Injectable()
export class MemoryTaxonomyRepo implements TaxonomyRepo {
  constructor(private readonly db: MemoryDb) {}
  async createName(n: NomName) {
    this.db.names.set(n.id, clone(n));
    return clone(n);
  }
  async getName(id: string) {
    const n = this.db.names.get(id);
    return n ? clone(n) : null;
  }
  async createConcept(c: TaxonConcept) {
    this.db.concepts.set(c.id, clone(c));
    return clone(c);
  }
  async getConcept(id: string) {
    const c = this.db.concepts.get(id);
    return c ? clone(c) : null;
  }
  async listConceptsForName(nameId: string) {
    return [...this.db.concepts.values()].filter((c) => c.nameId === nameId).map(clone);
  }
  async createAssertion(a: Assertion) {
    this.db.assertions.set(a.id, clone(a));
    return clone(a);
  }
  async listAssertionsForConcept(conceptId: string) {
    return [...this.db.assertions.values()].filter((a) => a.conceptId === conceptId).map(clone);
  }
  async createAct(act: NomenclaturalAct) {
    this.db.acts.set(act.id, clone(act));
    return clone(act);
  }
}

@Injectable()
export class MemoryIdentityRepo implements IdentityRepo {
  constructor(private readonly db: MemoryDb) {}
  async createAccount(a: Account) {
    this.db.accounts.set(a.id, clone(a));
    this.db.accountsBySub.set(a.keycloakSub, a.id);
    return clone(a);
  }
  async getAccount(id: string) {
    const a = this.db.accounts.get(id);
    return a ? clone(a) : null;
  }
  async getAccountByKeycloakSub(sub: string) {
    const id = this.db.accountsBySub.get(sub);
    return id ? clone(this.db.accounts.get(id)!) : null;
  }
  async updateAccount(a: Account) {
    this.db.accounts.set(a.id, clone(a));
    this.db.accountsBySub.set(a.keycloakSub, a.id);
    return clone(a);
  }
  async createIdentityRecord(r: IdentityRecord) {
    this.db.identityRecords.set(r.id, clone(r));
    return clone(r);
  }
  async getIdentityRecord(id: string) {
    const r = this.db.identityRecords.get(id);
    return r ? clone(r) : null;
  }
  async createCertification(c: Certification) {
    this.db.certifications.set(c.id, clone(c));
    return clone(c);
  }
  async getCertification(id: string) {
    const c = this.db.certifications.get(id);
    return c ? clone(c) : null;
  }
  async updateCertification(c: Certification) {
    this.db.certifications.set(c.id, clone(c));
    return clone(c);
  }
  async addTrustEvent(e: Omit<TrustEvent, 'id'>) {
    const ev: TrustEvent = { ...clone(e), id: ++this.db.trustSeq };
    this.db.trustEvents.push(ev);
    return clone(ev);
  }
  async computeTrustScore(accountId: string) {
    // Deeds weighted over connections; integrity breaches subtract. (§17, v1 private.)
    return this.db.trustEvents.filter((e) => e.accountId === accountId).reduce((sum, e) => sum + e.weight, 0);
  }
}

@Injectable()
export class MemoryLocalityRepo implements LocalityRepo {
  constructor(private readonly db: MemoryDb) {}
  async putPrecise(p: LocalityPrecise) {
    this.db.localityPrecise.set(p.obsId, clone(p));
  }
  async getPrecise(obsId: string) {
    const p = this.db.localityPrecise.get(obsId);
    return p ? clone(p) : null;
  }
  async createGrant(g: AccessGrant) {
    this.db.grants.set(g.id, clone(g));
    return clone(g);
  }
  async getGrant(id: string) {
    const g = this.db.grants.get(id);
    return g ? clone(g) : null;
  }
  async activeGrants(grantee: string, objectRef: string, now: Date) {
    return [...this.db.grants.values()]
      .filter(
        (g) =>
          g.grantee === grantee &&
          g.objectRef === objectRef &&
          !g.revokedAt &&
          new Date(g.expiresAt).getTime() > now.getTime(),
      )
      .map(clone);
  }
  async revokeGrant(id: string, at: string) {
    const g = this.db.grants.get(id);
    if (g) g.revokedAt = at;
  }
}

@Injectable()
export class MemoryReleaseRepo implements ReleaseRepo {
  constructor(private readonly db: MemoryDb) {}
  async createRelease(r: Release) {
    this.db.releases.set(r.id, clone(r));
    return clone(r);
  }
  async getReleaseForVersion(versionId: string) {
    const r = [...this.db.releases.values()].find((x) => x.versionId === versionId);
    return r ? clone(r) : null;
  }
  async listReleasesForKo(koId: string) {
    return [...this.db.releases.values()].filter((r) => r.koId === koId).map(clone);
  }
  async mintDoi(entry: DoiRegistryEntry) {
    this.db.dois.set(entry.doi, clone(entry));
    return clone(entry);
  }
  async getDoi(doi: string) {
    const d = this.db.dois.get(doi);
    return d ? clone(d) : null;
  }
  async getDoiForVersion(versionId: string) {
    const d = [...this.db.dois.values()].find((x) => x.versionId === versionId);
    return d ? clone(d) : null;
  }
}

@Injectable()
export class MemoryConsentRepo implements ConsentRepo {
  constructor(private readonly db: MemoryDb) {}
  async create(c: CoauthorConsent) {
    this.db.consents.set(c.id, clone(c));
    return clone(c);
  }
  async get(id: string) {
    const c = this.db.consents.get(id);
    return c ? clone(c) : null;
  }
  async listForKo(koId: string) {
    return [...this.db.consents.values()].filter((c) => c.koId === koId).map(clone);
  }
  async update(c: CoauthorConsent) {
    this.db.consents.set(c.id, clone(c));
    return clone(c);
  }
}

@Injectable()
export class MemoryReviewRepo implements ReviewRepo {
  constructor(private readonly db: MemoryDb) {}
  async create(t: ReviewThread) {
    this.db.reviews.set(t.id, clone(t));
    return clone(t);
  }
  async get(id: string) {
    const t = this.db.reviews.get(id);
    return t ? clone(t) : null;
  }
  async listForKo(koId: string) {
    return [...this.db.reviews.values()].filter((t) => t.koId === koId).map(clone);
  }
  async update(t: ReviewThread) {
    this.db.reviews.set(t.id, clone(t));
    return clone(t);
  }
}

@Injectable()
export class MemoryCitationRepo implements CitationRepo {
  constructor(private readonly db: MemoryDb) {}
  async createSnippet(s: SnippetAnchor) {
    this.db.snippets.set(s.id, clone(s));
    return clone(s);
  }
  async getSnippet(id: string) {
    const s = this.db.snippets.get(id);
    return s ? clone(s) : null;
  }
}

@Injectable()
export class MemoryMediaRepo implements MediaRepo {
  constructor(private readonly db: MemoryDb) {}
  async putMaster(meta: MediaObjectMeta, bytes: Buffer) {
    this.db.mediaMeta.set(meta.id, clone(meta));
    this.db.mediaBytes.set(meta.contentAddress, Buffer.from(bytes));
    return clone(meta);
  }
  async getMeta(id: string) {
    const m = this.db.mediaMeta.get(id);
    return m ? clone(m) : null;
  }
  async getBytes(contentAddress: string) {
    const b = this.db.mediaBytes.get(contentAddress);
    return b ? Buffer.from(b) : null;
  }
  async putDerivative(id: string, kind: string, meta: { contentAddress: string; mime: string; maxEdge?: number }, bytes: Buffer) {
    const m = this.db.mediaMeta.get(id);
    if (!m) throw new Error(`media ${id} not found`);
    m.derivatives[kind] = clone(meta);
    this.db.mediaBytes.set(meta.contentAddress, Buffer.from(bytes));
  }
}

@Injectable()
export class MemoryAuditRepo implements AuditRepo {
  constructor(private readonly db: MemoryDb) {}
  async append(entry: Omit<AuditLedgerEntry, 'id'>) {
    const e: AuditLedgerEntry = { ...clone(entry), id: ++this.db.auditSeq };
    this.db.audit.push(e); // INSERT-only
    return clone(e);
  }
  async list(filter?: { objectRef?: string; action?: string; actorRef?: string }) {
    return this.db.audit
      .filter(
        (e) =>
          (!filter?.objectRef || e.objectRef === filter.objectRef) &&
          (!filter?.action || e.action === filter.action) &&
          (!filter?.actorRef || e.actorRef === filter.actorRef),
      )
      .map(clone);
  }
}

@Injectable()
export class MemoryAiDeclarationRepo implements AiDeclarationRepo {
  constructor(private readonly db: MemoryDb) {}
  async put(d: AiDeclaration) {
    this.db.aiDecls.set(d.koId, clone(d));
    return clone(d);
  }
  async getForKo(koId: string) {
    const d = this.db.aiDecls.get(koId);
    return d ? clone(d) : null;
  }
}

@Injectable()
export class MemorySearchPort implements SearchPort {
  constructor(private readonly db: MemoryDb) {}
  async index(doc: SearchDoc) {
    this.db.searchDocs.set(`${doc.index}:${doc.id}`, clone(doc));
  }
  async search(q: { text?: string; koType?: string; status?: string; index: 'public' | 'restricted' }) {
    return [...this.db.searchDocs.values()]
      .filter((d) => d.index === q.index)
      .filter((d) => !q.koType || d.koType === q.koType)
      .filter((d) => !q.status || d.status === q.status)
      .filter((d) => !q.text || `${d.title} ${d.text}`.toLowerCase().includes(q.text.toLowerCase()))
      .map(clone);
  }
}
