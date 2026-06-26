import { Module, forwardRef } from '@nestjs/common';
import { KnowledgeObjectService } from './knowledge-object.service';
import { KnowledgeObjectController } from './knowledge-object.controller';
import { VersioningModule } from '@modules/versioning/versioning.module';

/**
 * KnowledgeObjectModule and VersioningModule are mutually dependent
 * (KO.createKo → Versioning.commit; Versioning controllers → KO.reindex), so the
 * cycle is broken with forwardRef. Both export their service.
 */
@Module({
  imports: [forwardRef(() => VersioningModule)],
  providers: [KnowledgeObjectService],
  controllers: [KnowledgeObjectController],
  exports: [KnowledgeObjectService],
})
export class KnowledgeObjectModule {}
