import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public } from '@common/decorators';
import type { Principal } from '@core/types';
import { SearchService } from './search.service';
import { SearchQueryDto } from './search.dto';

@ApiTags('search')
@Controller()
export class SearchController {
  constructor(private readonly search: SearchService) {}

  /**
   * §8 GET /search — query the Elastic projection. Marked @Public() so the public
   * index is reachable anonymously, but the service gates the restricted index to
   * editor/steward (the resolved Principal, if any, is passed through). The public
   * and restricted indices are separate, so a public query never returns
   * restricted-index docs.
   */
  @Public()
  @Get('search')
  async query(@Query() q: SearchQueryDto, @CurrentUser() user: Principal) {
    return this.search.query({ text: q.text, koType: q.koType, status: q.status, index: q.index }, user);
  }
}
