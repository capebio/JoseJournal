import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, MinAssurance, Roles } from '@common/decorators';
import type { Principal } from '@core/types';
import type { Actor } from '@modules/versioning/versioning.service';
import { ObservationService } from './observation.service';
import { CreateObservationDto, ObservationDecisionDto } from './observation.dto';

function actorOf(p: Principal): Actor {
  return { ref: p.accountId, role: p.roles[0] ?? 'author' };
}

@ApiTags('observations')
@Controller('observations')
export class ObservationController {
  constructor(private readonly observations: ObservationService) {}

  /**
   * §7 POST /observations — elevate a Casabio observation to a citable
   * micro-observation KO and split-store its locality (public QDS-only).
   */
  @MinAssurance('verified')
  @Post()
  async create(@Body() dto: CreateObservationDto, @CurrentUser() user: Principal) {
    const { koId, obsId, public: pub } = await this.observations.create({
      taxonConcept: dto.taxonConcept,
      lat: dto.lat,
      lon: dto.lon,
      sensitivity: dto.sensitivity,
      source: dto.source,
      media: dto.media,
      note: dto.note,
      attachKo: dto.attachKo,
      actor: actorOf(user),
    });
    return { koId, obsId, public: pub };
  }

  /**
   * §7 POST /observations/:obsId/decision — curator accept (verify) / reject the
   * public projection. reject requires a non-empty comment.
   */
  @Roles('author', 'editor', 'steward')
  @Post(':obsId/decision')
  async decide(@Param('obsId') obsId: string, @Body() dto: ObservationDecisionDto, @CurrentUser() user: Principal) {
    return this.observations.decide({ obsId, decision: dto.decision, comment: dto.comment, actor: actorOf(user) });
  }
}
