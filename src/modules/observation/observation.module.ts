import { Module } from '@nestjs/common';
import { KnowledgeObjectModule } from '@modules/knowledge-object/knowledge-object.module';
import { LocalityModule } from '@modules/locality/locality.module';
import { ObservationService } from './observation.service';
import { ObservationController } from './observation.controller';

/**
 * Micro-observations (§3.7 / §7). Composes KnowledgeObjectService (citable KO) and
 * LocalityService (anti-poaching split). ProvenanceService is global; the
 * KnowledgeObjectRepo port comes from the global PersistenceModule.
 */
@Module({
  imports: [KnowledgeObjectModule, LocalityModule],
  providers: [ObservationService],
  controllers: [ObservationController],
  exports: [ObservationService],
})
export class ObservationModule {}
