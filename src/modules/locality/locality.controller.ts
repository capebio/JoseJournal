import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Capability, CurrentUser, Public } from '@common/decorators';
import type { Principal } from '@core/types';
import { LocalityService } from './locality.service';
import { IssueGrantDto, PreciseQueryDto } from './locality.dto';

@ApiTags('localities')
@Controller()
export class LocalityController {
  constructor(private readonly locality: LocalityService) {}

  /** §7 GET /map/:koId — QDS distribution (public projection only). */
  @Public()
  @Get('map/:koId')
  async map(@Param('koId') koId: string) {
    return this.locality.map(koId);
  }

  /**
   * §7 POST /localities/:obsId/access — issue an object-specific grant. The
   * granting authority is editor/steward (certification ≠ automatic site access,
   * §18); the grantee is the certified researcher who will consume it.
   */
  @Capability('grant-precise')
  @Post('localities/:obsId/access')
  async issueGrant(@Param('obsId') obsId: string, @Body() dto: IssueGrantDto, @CurrentUser() user: Principal) {
    return this.locality.issueGrant({
      grantee: dto.grantee,
      objectRef: obsId,
      purpose: dto.purpose,
      grantedBy: user.accountId,
      ttlMs: dto.ttlMs,
      offlinePkg: dto.offlinePkg,
    });
  }

  /** §7 GET /localities/:obsId/precise — serve precise IFF active grant (audited). */
  @Capability('request-precise')
  @Get('localities/:obsId/precise')
  async precise(@Param('obsId') obsId: string, @Query() q: PreciseQueryDto, @CurrentUser() user: Principal) {
    return this.locality.servePrecise(user, obsId, q.purpose, q.offline === 'true');
  }
}
