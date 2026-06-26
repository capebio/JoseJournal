import { Controller, ForbiddenException, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public, Roles } from '@common/decorators';
import type { Principal } from '@core/types';
import { ProvenanceService } from './provenance.service';

@ApiTags('provenance')
@Controller()
export class ProvenanceController {
  constructor(private readonly provenance: ProvenanceService) {}

  /** §7: public provenance events for a KO. */
  @Public()
  @Get('ko/:koId/provenance')
  async publicEvents(@Param('koId') koId: string) {
    return this.provenance.publicForSubject(koId);
  }

  /**
   * §7: the full record incl. non-public events, only through this audited,
   * authorised endpoint (editor/steward). Enforces the §3.4 principle that
   * provenance is complete but disclosure is governed.
   */
  @Roles('editor', 'steward')
  @Get('audit/provenance')
  async fullRecord(@Query('subject') subject: string, @CurrentUser() user: Principal) {
    if (!subject) throw new ForbiddenException('subject query param required');
    return this.provenance.allForSubject(subject);
  }
}
