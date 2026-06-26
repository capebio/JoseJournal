import { Global, Module, Provider } from '@nestjs/common';
import { PORTS } from '@core/ports';
import { MemoryDb, MemoryUnitOfWork } from './memory/memory-db';
import {
  MemoryAiDeclarationRepo,
  MemoryAuditRepo,
  MemoryCitationRepo,
  MemoryConsentRepo,
  MemoryIdentityRepo,
  MemoryKnowledgeObjectRepo,
  MemoryLocalityRepo,
  MemoryMediaRepo,
  MemoryProvenanceRepo,
  MemoryReleaseRepo,
  MemoryReviewRepo,
  MemorySearchPort,
  MemoryTaxonomyRepo,
} from './memory/memory.repos';
import { LiveCouchKnowledgeObjectRepo } from './live/couch.repo';
import { PgPool, PgUnitOfWork } from './live/pg-pool';
import {
  PgAiDeclarationRepo,
  PgAuditRepo,
  PgCitationRepo,
  PgConsentRepo,
  PgIdentityRepo,
  PgLocalityRepo,
  PgProvenanceRepo,
  PgReleaseRepo,
  PgReviewRepo,
  PgTaxonomyRepo,
} from './live/pg.repos';
import { ElasticSearchPort } from './live/elastic.search';
import { MinioMediaRepo } from './live/minio.media';

/**
 * Binds every persistence port to either the in-memory adapter (deterministic,
 * service-free — §9 CI) or the live adapter (Couch/Postgres/Elastic/MinIO),
 * selected by PERSISTENCE=memory|live. Modules are oblivious to the choice.
 */
function buildProviders(mode: string): Provider[] {
  if (mode === 'live') {
    return [
      PgPool,
      { provide: PORTS.UnitOfWork, useClass: PgUnitOfWork },
      { provide: PORTS.KnowledgeObjectRepo, useClass: LiveCouchKnowledgeObjectRepo },
      { provide: PORTS.ProvenanceRepo, useClass: PgProvenanceRepo },
      { provide: PORTS.TaxonomyRepo, useClass: PgTaxonomyRepo },
      { provide: PORTS.IdentityRepo, useClass: PgIdentityRepo },
      { provide: PORTS.LocalityRepo, useClass: PgLocalityRepo },
      { provide: PORTS.ReleaseRepo, useClass: PgReleaseRepo },
      { provide: PORTS.ConsentRepo, useClass: PgConsentRepo },
      { provide: PORTS.ReviewRepo, useClass: PgReviewRepo },
      { provide: PORTS.CitationRepo, useClass: PgCitationRepo },
      { provide: PORTS.MediaRepo, useClass: MinioMediaRepo },
      { provide: PORTS.AuditRepo, useClass: PgAuditRepo },
      { provide: PORTS.AiDeclarationRepo, useClass: PgAiDeclarationRepo },
      { provide: PORTS.SearchPort, useClass: ElasticSearchPort },
    ];
  }
  // memory mode
  const db = new MemoryDb();
  return [
    { provide: MemoryDb, useValue: db },
    { provide: PORTS.UnitOfWork, useFactory: () => new MemoryUnitOfWork(db) },
    { provide: PORTS.KnowledgeObjectRepo, useFactory: () => new MemoryKnowledgeObjectRepo(db) },
    { provide: PORTS.ProvenanceRepo, useFactory: () => new MemoryProvenanceRepo(db) },
    { provide: PORTS.TaxonomyRepo, useFactory: () => new MemoryTaxonomyRepo(db) },
    { provide: PORTS.IdentityRepo, useFactory: () => new MemoryIdentityRepo(db) },
    { provide: PORTS.LocalityRepo, useFactory: () => new MemoryLocalityRepo(db) },
    { provide: PORTS.ReleaseRepo, useFactory: () => new MemoryReleaseRepo(db) },
    { provide: PORTS.ConsentRepo, useFactory: () => new MemoryConsentRepo(db) },
    { provide: PORTS.ReviewRepo, useFactory: () => new MemoryReviewRepo(db) },
    { provide: PORTS.CitationRepo, useFactory: () => new MemoryCitationRepo(db) },
    { provide: PORTS.MediaRepo, useFactory: () => new MemoryMediaRepo(db) },
    { provide: PORTS.AuditRepo, useFactory: () => new MemoryAuditRepo(db) },
    { provide: PORTS.AiDeclarationRepo, useFactory: () => new MemoryAiDeclarationRepo(db) },
    { provide: PORTS.SearchPort, useFactory: () => new MemorySearchPort(db) },
  ];
}

const PORT_TOKENS = Object.values(PORTS);

@Global()
@Module({})
export class PersistenceModule {
  static forRoot(): import('@nestjs/common').DynamicModule {
    const mode = process.env.PERSISTENCE === 'live' ? 'live' : 'memory';
    const providers = buildProviders(mode);
    // MemoryDb is only a provider in memory mode; export it only then so tests
    // can reach the raw store (e.g. to simulate Couch compaction).
    const exports = mode === 'live' ? [...PORT_TOKENS] : [...PORT_TOKENS, MemoryDb];
    return {
      module: PersistenceModule,
      providers: [...providers],
      exports,
    };
  }
}
