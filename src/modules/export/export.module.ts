import { Module } from '@nestjs/common';
import { KnowledgeObjectModule } from '@modules/knowledge-object/knowledge-object.module';
import { ExportService } from './export.service';
import { ExportController } from './export.controller';

/**
 * §7/§11 Export — frictionless export at every stage ("no cage" rule). Depends on
 * KnowledgeObjectService to load the target version; ProvenanceService is global.
 */
@Module({
  imports: [KnowledgeObjectModule],
  providers: [ExportService],
  controllers: [ExportController],
  exports: [ExportService],
})
export class ExportModule {}
