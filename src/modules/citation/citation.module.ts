import { Module } from '@nestjs/common';
import { KnowledgeObjectModule } from '@modules/knowledge-object/knowledge-object.module';
import { CitationService } from './citation.service';
import { CitationController } from './citation.controller';

/**
 * §3.9 Citation. CitationRepo + ReleaseRepo are provided globally by
 * PersistenceModule; ProvenanceService is provided globally by ProvenanceModule.
 * KnowledgeObjectModule is imported to load immutable versions/blocks.
 */
@Module({
  imports: [KnowledgeObjectModule],
  providers: [CitationService],
  controllers: [CitationController],
  exports: [CitationService],
})
export class CitationModule {}
