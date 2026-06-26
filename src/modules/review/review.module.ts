import { Module } from '@nestjs/common';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';

/**
 * §3.10 / §7 Review module — continuous transparent review, author right-of-reply,
 * and co-author consent. ReviewService is exported so the orchestrator can call
 * releaseBlockers() to gate releases (§9.6). Persistence ports and ProvenanceModule
 * are global, so no imports are needed here.
 */
@Module({
  providers: [ReviewService],
  controllers: [ReviewController],
  exports: [ReviewService],
})
export class ReviewModule {}
