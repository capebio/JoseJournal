import { Module, forwardRef } from '@nestjs/common';
import { VersioningService } from './versioning.service';
import { VersioningController } from './versioning.controller';
import { KnowledgeObjectModule } from '@modules/knowledge-object/knowledge-object.module';
import { ReviewModule } from '@modules/review/review.module';

@Module({
  // ReviewModule supplies the §9.6 release gate (releaseBlockers). It has no
  // dependency back on versioning, so a plain import (no forwardRef) is safe.
  imports: [forwardRef(() => KnowledgeObjectModule), ReviewModule],
  providers: [VersioningService],
  controllers: [VersioningController],
  exports: [VersioningService],
})
export class VersioningModule {}
