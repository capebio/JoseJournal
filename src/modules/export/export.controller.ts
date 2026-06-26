import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser, Roles } from '@common/decorators';
import type { Principal } from '@core/types';
import { ExportService, type ExportActor, type ExportFormat } from './export.service';
import { ExportQueryDto } from './export.dto';

function actorOf(p: Principal): ExportActor {
  return { ref: p.accountId, role: p.roles[0] ?? 'author' };
}

@ApiTags('export')
@Controller('ko')
export class ExportController {
  constructor(private readonly exporter: ExportService) {}

  /**
   * §7 GET /ko/:koId/export?format=md|docx|jats|json&version=<verId?>
   *
   * §9.8 / §11 "no cage": export works at ANY visibility/status, draft included.
   * The route is NOT gated on release. We set the format-appropriate Content-Type
   * and return the rendered string body (passthrough keeps Nest's serialization).
   */
  @Roles('author', 'contributor', 'editor', 'steward')
  @Get(':koId/export')
  async export(
    @Param('koId') koId: string,
    @Query() q: ExportQueryDto,
    @CurrentUser() user: Principal,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const format: ExportFormat = q.format ?? 'md';
    const result = await this.exporter.export(koId, format, q.version ?? null, actorOf(user));
    res.type(result.contentType);
    return result.body;
  }
}
