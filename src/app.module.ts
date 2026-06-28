import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { PersistenceModule } from '@persistence/persistence.module';
import { CommonModule } from '@common/common.module';
import { ProvenanceModule } from '@modules/provenance/provenance.module';
import { KnowledgeObjectModule } from '@modules/knowledge-object/knowledge-object.module';
import { VersioningModule } from '@modules/versioning/versioning.module';
import { LocalityModule } from '@modules/locality/locality.module';
// Fan-out modules (wired at convergence):
import { TaxonomyModule } from '@modules/taxonomy/taxonomy.module';
import { ObservationModule } from '@modules/observation/observation.module';
import { ReviewModule } from '@modules/review/review.module';
import { CitationModule } from '@modules/citation/citation.module';
import { IdentityTrustModule } from '@modules/identity-trust/identity-trust.module';
import { MediaModule } from '@modules/media/media.module';
import { FederationModule } from '@modules/federation/federation.module';
import { ExportModule } from '@modules/export/export.module';
import { AuthoringModule } from '@modules/authoring/authoring.module';
import { SearchModule } from '@modules/search/search.module';
import { AuthModule } from '@modules/auth/auth.module';
import { DeskModule } from '@modules/desk/desk.module';

/**
 * The JOSE v1 modular monolith — one deployable, cleanly partitioned so any
 * module can be extracted later under load (§23). The trust boundary lives here.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    PersistenceModule.forRoot(),
    CommonModule,
    ProvenanceModule,
    KnowledgeObjectModule,
    VersioningModule,
    LocalityModule,
    TaxonomyModule,
    ObservationModule,
    ReviewModule,
    CitationModule,
    IdentityTrustModule,
    MediaModule,
    FederationModule,
    ExportModule,
    AuthoringModule,
    SearchModule,
    AuthModule,
    DeskModule,
  ],
})
export class AppModule {}
