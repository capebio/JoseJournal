import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators';
import type { Principal } from '@core/types';
import { DeskService } from './desk.service';

/**
 * M7 Desk — GET /desk. Per-user aggregation; requires a signed-in principal (no
 * @Public), but no special assurance/role — every authenticated user has a Desk.
 */
@ApiTags('desk')
@Controller('desk')
export class DeskController {
  constructor(private readonly desk: DeskService) {}

  @Get()
  forUser(@CurrentUser() user: Principal) {
    return this.desk.forUser(user);
  }
}
