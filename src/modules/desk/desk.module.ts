import { Module } from '@nestjs/common';
import { KnowledgeObjectModule } from '@modules/knowledge-object/knowledge-object.module';
import { ReviewModule } from '@modules/review/review.module';
import { LocalityModule } from '@modules/locality/locality.module';
import { DeskService } from './desk.service';
import { DeskController } from './desk.controller';

/**
 * M7 Desk module. Read-only aggregation over existing services (KO / Review /
 * Locality, all exported) + the global SearchPort/AuditRepo. No persistence of
 * its own — the Desk is a projection of live state.
 */
@Module({
  imports: [KnowledgeObjectModule, ReviewModule, LocalityModule],
  providers: [DeskService],
  controllers: [DeskController],
})
export class DeskModule {}
