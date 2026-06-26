import { Body, Controller, ConflictException, Post, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, MinAssurance, Roles } from '@common/decorators';
import type { ActorRole, Principal } from '@core/types';
import { VersioningService } from './versioning.service';
import { KnowledgeObjectService } from '@modules/knowledge-object/knowledge-object.service';
import { ReviewService } from '@modules/review/review.service';
import { AmendDto, ForkDto, ReleaseDto, RetractDto } from '@modules/knowledge-object/knowledge-object.dto';

function actorOf(p: Principal): { ref: string; role: ActorRole } {
  return { ref: p.accountId, role: p.roles[0] ?? 'author' };
}

@ApiTags('versioning')
@Controller('ko')
export class VersioningController {
  constructor(
    private readonly versioning: VersioningService,
    private readonly ko: KnowledgeObjectService,
    private readonly review: ReviewService,
  ) {}

  /** §7 POST /ko/:id/amend — authority-matrix checked in the service. */
  @Roles('author', 'contributor', 'editor', 'steward')
  @Post(':koId/amend')
  async amend(@Param('koId') koId: string, @Body() dto: AmendDto, @CurrentUser() user: Principal) {
    const version = await this.versioning.amend({
      koId,
      baseVersionId: dto.baseVersionId,
      content: dto.content,
      actor: actorOf(user),
      amendClass: dto.amendClass,
      status: dto.status,
    });
    await this.ko.reindex(koId, version._id);
    return version;
  }

  /** §7 POST /ko/:id/fork — new KO with lineage. */
  @MinAssurance('verified')
  @Post(':koId/fork')
  async fork(@Param('koId') koId: string, @Body() dto: ForkDto, @CurrentUser() user: Principal) {
    return this.versioning.fork(koId, dto.fromVersionId, actorOf(user));
  }

  /** §7 POST /ko/:id/release — Commons release, or Journal VoR + DOI. */
  @Roles('author', 'editor', 'steward')
  @Post(':koId/release')
  async release(@Param('koId') koId: string, @Body() dto: ReleaseDto, @CurrentUser() user: Principal) {
    // §9.6 release gate: an orange/red disposition with no author right-of-reply
    // blocks any release until the author responds.
    const blockers = await this.review.releaseBlockers(koId);
    if (blockers.length > 0) {
      throw new ConflictException({
        message: 'release blocked: unanswered orange/red reviewer dispositions require an author reply (§9.6)',
        blockers: blockers.map((b) => ({ threadId: b.id, reviewer: b.reviewer, disposition: b.disposition })),
      });
    }
    if ((dto.tier ?? 'journal') === 'commons') {
      return this.versioning.releaseCommons(koId, actorOf(user));
    }
    const result = await this.versioning.tagVoR(koId, dto.versionId ?? null, actorOf(user));
    await this.ko.reindex(koId, result.version._id);
    return result;
  }

  /** §7 POST /ko/:id/retract — editor only; v1 minimum propagation (§12.2). */
  @Roles('editor', 'steward')
  @Post(':koId/retract')
  async retract(@Param('koId') koId: string, @Body() dto: RetractDto, @CurrentUser() user: Principal) {
    return this.versioning.retract(koId, dto.versionId, actorOf(user), dto.reason);
  }
}
