import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, MinAssurance, Public } from '@common/decorators';
import type { Principal } from '@core/types';
import { CitationService } from './citation.service';
import { CiteQueryDto, CreateSnippetDto } from './citation.dto';

@ApiTags('citation')
@Controller()
export class CitationController {
  constructor(private readonly citation: CitationService) {}

  /**
   * §7 GET /cite/:koId?as=version|doi|entity — return citation metadata pinned to
   * the requested identifier. Public read; default identifier is the immutable
   * version (the citable unit). Never a redirect (§9.4).
   */
  @Public()
  @Get('cite/:koId')
  async cite(@Param('koId') koId: string, @Query() q: CiteQueryDto) {
    return this.citation.cite(koId, q.as ?? 'version');
  }

  /**
   * §7 POST /snippets — anchor a quotation to an immutable version+block. Gated
   * at 'verified' assurance (§17). The anchor pins a versionId, never an entity.
   */
  @MinAssurance('verified')
  @Post('snippets')
  async createSnippet(@Body() dto: CreateSnippetDto, @CurrentUser() user: Principal) {
    return this.citation.createSnippet({
      versionId: dto.versionId,
      sectionPath: dto.sectionPath,
      blockId: dto.blockId,
      quotedText: dto.quotedText,
      actorRef: user.accountId,
      actorRole: user.roles[0] ?? 'author',
    });
  }

  /**
   * §7 GET /snippets/:id — resolve the anchor. drift:false with the live block if
   * unchanged; drift:true with BOTH the cited text and the current block if the
   * block was amended in a later version (§9.4). Public read.
   */
  @Public()
  @Get('snippets/:id')
  async resolveSnippet(@Param('id') id: string) {
    return this.citation.resolveSnippet(id);
  }
}
