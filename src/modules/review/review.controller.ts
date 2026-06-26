import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, MinAssurance, Public, Roles } from '@common/decorators';
import type { Principal } from '@core/types';
import { ReviewService } from './review.service';
import { AddCoauthorDto, AddReviewerDto, ReplyDto, RespondCoauthorDto, SubmitReviewDto } from './review.dto';

@ApiTags('review')
@Controller('ko')
export class ReviewController {
  constructor(private readonly review: ReviewService) {}

  /** §7 read: GET /ko/:koId/reviews — review threads (open identity) for the Reader overlay + Review Panel. */
  @Public()
  @Get(':koId/reviews')
  listReviews(@Param('koId') koId: string) {
    return this.review.listReviews(koId);
  }

  /** §7 read: GET /ko/:koId/coauthors — co-author consents (named-unconfirmed surfaces). */
  @Public()
  @Get(':koId/coauthors')
  listCoauthors(@Param('koId') koId: string) {
    return this.review.listCoauthors(koId);
  }

  /** §7 POST /ko/:koId/reviewers — assign a reviewer (opens a yellow thread). */
  @Roles('author', 'editor', 'steward')
  @Post(':koId/reviewers')
  async addReviewer(@Param('koId') koId: string, @Body() dto: AddReviewerDto, @CurrentUser() user: Principal) {
    return this.review.addReviewer(koId, dto.reviewer, user.accountId);
  }

  /** §7 POST /ko/:koId/review — submit/update a disposition + comment (open identity). */
  @Roles('reviewer', 'editor', 'steward')
  @Post(':koId/review')
  async submitReview(@Param('koId') koId: string, @Body() dto: SubmitReviewDto, @CurrentUser() user: Principal) {
    return this.review.submitReview(koId, user.accountId, dto.disposition, dto.comment, dto.threadId);
  }

  /** §7 POST /ko/:koId/review/:threadId/reply — author right-of-reply (gates orange/red). */
  @Roles('author', 'editor', 'steward')
  @Post(':koId/review/:threadId/reply')
  async reply(
    @Param('koId') koId: string,
    @Param('threadId') threadId: string,
    @Body() dto: ReplyDto,
    @CurrentUser() user: Principal,
  ) {
    return this.review.reply(koId, threadId, dto.reply, user.accountId);
  }

  /** §7 POST /ko/:koId/coauthors — name a co-author candidate (consent requested). */
  @Roles('author', 'editor', 'steward')
  @Post(':koId/coauthors')
  async addCoauthor(@Param('koId') koId: string, @Body() dto: AddCoauthorDto, @CurrentUser() user: Principal) {
    return this.review.addCoauthor(koId, dto.candidate, user.accountId);
  }

  /** §7 POST /ko/:koId/coauthors/:id/respond — candidate resolves their consent. */
  @MinAssurance('verified')
  @Post(':koId/coauthors/:id/respond')
  async respondCoauthor(
    @Param('id') id: string,
    @Body() dto: RespondCoauthorDto,
    @CurrentUser() user: Principal,
  ) {
    return this.review.respondCoauthor(id, dto.response, user.accountId);
  }
}
