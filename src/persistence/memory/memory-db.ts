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
import type { MediaObjectMeta, SearchDoc, UnitOfWork } from '@core/ports';

const clone = <T>(v: T): T => structuredClone(v);

/**
 * Single in-memory store backing all repository adapters in 'memory' mode.
 * Deterministic and service-free — this is what makes every §9 acceptance
 * criterion runnable in CI. The same module code runs unchanged against the
 * live adapters; only the bound implementation differs.
 */
export class MemoryDb {
  entities = new Map<string, KnowledgeObjectEntity>();
  versions = new Map<string, VersionDoc>();
  publicProjections = new Map<string, Record<string, unknown>>();
  provenance: ProvenanceEvent[] = [];
  names = new Map<string, NomName>();
  concepts = new Map<string, TaxonConcept>();
  assertions = new Map<string, Assertion>();
  acts = new Map<string, NomenclaturalAct>();
  accounts = new Map<string, Account>();
  accountsBySub = new Map<string, string>();
  identityRecords = new Map<string, IdentityRecord>();
  certifications = new Map<string, Certification>();
  trustEvents: TrustEvent[] = [];
  trustSeq = 0;
  localityPrecise = new Map<string, LocalityPrecise>();
  grants = new Map<string, AccessGrant>();
  releases = new Map<string, Release>();
  dois = new Map<string, DoiRegistryEntry>();
  consents = new Map<string, CoauthorConsent>();
  reviews = new Map<string, ReviewThread>();
  snippets = new Map<string, SnippetAnchor>();
  mediaMeta = new Map<string, MediaObjectMeta>();
  mediaBytes = new Map<string, Buffer>(); // keyed by contentAddress; excluded from txn snapshot
  audit: AuditLedgerEntry[] = [];
  auditSeq = 0;
  aiDecls = new Map<string, AiDeclaration>();
  searchDocs = new Map<string, SearchDoc>();

  /** Serialise the JSON-able state (everything except media bytes) for UoW snapshots. */
  snapshot(): string {
    return JSON.stringify({
      entities: [...this.entities],
      versions: [...this.versions],
      publicProjections: [...this.publicProjections],
      provenance: this.provenance,
      names: [...this.names],
      concepts: [...this.concepts],
      assertions: [...this.assertions],
      acts: [...this.acts],
      accounts: [...this.accounts],
      accountsBySub: [...this.accountsBySub],
      identityRecords: [...this.identityRecords],
      certifications: [...this.certifications],
      trustEvents: this.trustEvents,
      trustSeq: this.trustSeq,
      localityPrecise: [...this.localityPrecise],
      grants: [...this.grants],
      releases: [...this.releases],
      dois: [...this.dois],
      consents: [...this.consents],
      reviews: [...this.reviews],
      snippets: [...this.snippets],
      mediaMeta: [...this.mediaMeta],
      audit: this.audit,
      auditSeq: this.auditSeq,
      aiDecls: [...this.aiDecls],
      searchDocs: [...this.searchDocs],
    });
  }

  restore(snap: string): void {
    const s = JSON.parse(snap);
    this.entities = new Map(s.entities);
    this.versions = new Map(s.versions);
    this.publicProjections = new Map(s.publicProjections);
    this.provenance = s.provenance;
    this.names = new Map(s.names);
    this.concepts = new Map(s.concepts);
    this.assertions = new Map(s.assertions);
    this.acts = new Map(s.acts);
    this.accounts = new Map(s.accounts);
    this.accountsBySub = new Map(s.accountsBySub);
    this.identityRecords = new Map(s.identityRecords);
    this.certifications = new Map(s.certifications);
    this.trustEvents = s.trustEvents;
    this.trustSeq = s.trustSeq;
    this.localityPrecise = new Map(s.localityPrecise);
    this.grants = new Map(s.grants);
    this.releases = new Map(s.releases);
    this.dois = new Map(s.dois);
    this.consents = new Map(s.consents);
    this.reviews = new Map(s.reviews);
    this.snippets = new Map(s.snippets);
    this.mediaMeta = new Map(s.mediaMeta);
    this.audit = s.audit;
    this.auditSeq = s.auditSeq;
    this.aiDecls = new Map(s.aiDecls);
    this.searchDocs = new Map(s.searchDocs);
  }
}

/** In-memory UoW: snapshot before the body; restore on throw → atomicity. */
export class MemoryUnitOfWork implements UnitOfWork {
  constructor(private readonly db: MemoryDb) {}
  async run<T>(work: () => Promise<T>): Promise<T> {
    const snap = this.db.snapshot();
    try {
      return await work();
    } catch (e) {
      this.db.restore(snap);
      throw e;
    }
  }
}

export { clone };
