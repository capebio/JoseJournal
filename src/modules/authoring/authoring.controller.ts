import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public, Roles } from '@common/decorators';
import type { AiDeclaration, Principal } from '@core/types';
import { AuthoringService } from './authoring.service';
import { AiDeclarationDto } from './authoring.dto';

@ApiTags('authoring')
@Controller()
export class AuthoringController {
  constructor(private readonly authoring: AuthoringService) {}

  /**
   * §7 POST /ko/:koId/ai-declaration — declare AI provenance. `percentage` is
   * accepted only under 'recorded' coverage; the service nulls it otherwise.
   */
  @Roles('author', 'contributor', 'editor', 'steward')
  @Post('ko/:koId/ai-declaration')
  async declare(@Param('koId') koId: string, @Body() dto: AiDeclarationDto, @CurrentUser() user: Principal): Promise<AiDeclaration> {
    return this.authoring.declare({
      koId,
      coverage: dto.coverage,
      role: dto.role,
      model: dto.model,
      accountableHuman: dto.accountableHuman,
      percentage: dto.percentage,
      actorRef: user.accountId,
    });
  }

  /**
   * §7 GET /ko/:koId/ai-declaration — surface the declaration. A 'recorded'
   * declaration is marked authoritative; an 'estimated' one is labelled inferred
   * (explicitly NOT forensic, §9.8).
   */
  @Public()
  @Get('ko/:koId/ai-declaration')
  async get(@Param('koId') koId: string): Promise<AiDeclaration & { authoritative?: true; inferred?: true; note?: string }> {
    const declaration = await this.authoring.getForKo(koId);
    if (!declaration) throw new NotFoundException(`no AI declaration for ${koId}`);
    if (declaration.coverage === 'estimated') {
      return { ...declaration, inferred: true, note: 'best-guess estimate, not forensic' };
    }
    if (declaration.coverage === 'recorded') {
      return { ...declaration, authoritative: true };
    }
    return declaration;
  }
}
