import { IsIn, IsOptional, IsString } from 'class-validator';
import type { ReviewerDisposition } from '@core/types';

/** §7 POST /ko/:koId/reviewers — assign a reviewer, opening a yellow thread. */
export class AddReviewerDto {
  @IsString()
  reviewer!: string; // acct:…
}

/** §7 POST /ko/:koId/review — submit or update a disposition + comment. */
export class SubmitReviewDto {
  @IsOptional()
  @IsString()
  threadId?: string; // review:… — omit to open a fresh thread

  @IsIn(['green', 'yellow', 'orange', 'red'])
  disposition!: ReviewerDisposition;

  @IsString()
  comment!: string;
}

/** §7 POST /ko/:koId/review/:threadId/reply — author right-of-reply. */
export class ReplyDto {
  @IsString()
  reply!: string;
}

/** §7 POST /ko/:koId/coauthors — name a co-author candidate (consent requested). */
export class AddCoauthorDto {
  @IsString()
  candidate!: string; // acct:… | idrec:…
}

/** §7 POST /ko/:koId/coauthors/:id/respond — candidate resolves their consent. */
export class RespondCoauthorDto {
  @IsIn(['confirmed', 'declined', 'negotiating'])
  response!: 'confirmed' | 'declined' | 'negotiating';
}
