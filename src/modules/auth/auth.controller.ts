import { Body, Controller, ForbiddenException, Get, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public } from '@common/decorators';
import { signHs256 } from '@common/jwt';
import type { Principal } from '@core/types';
import { DevLoginDto } from './auth.dto';

/**
 * Dev-login helper + whoami (§2.5, §7). The real trust boundary is the global
 * AuthGuard (Keycloak RS256 in production); this controller only mints HS256 dev
 * tokens so local/e2e runs work without Keycloak, and echoes the resolved
 * Principal. Both routes are @Public — the guard still attaches a Principal when
 * a valid bearer token is present.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly config: ConfigService) {}

  /**
   * POST /auth/dev-login — mint an HS256 token the guard accepts via its dev
   * path. Available ONLY when keycloak.devMode is true (AUTH_DEV_MODE); a live
   * deployment must reject this so no one can self-issue trust.
   */
  @Public()
  @Post('dev-login')
  devLogin(@Body() dto: DevLoginDto): { token: string } {
    const kc = this.config.get('keycloak') as { devMode: boolean; devSecret: string };
    if (!kc.devMode) {
      throw new ForbiddenException('dev-login is disabled outside dev mode');
    }
    const token = signHs256(
      {
        sub: dto.sub,
        accountId: dto.accountId,
        assurance: dto.assurance,
        roles: dto.roles,
        orcid: dto.orcid,
        name: dto.name,
      },
      kc.devSecret,
    );
    return { token };
  }

  /**
   * GET /auth/me — return the caller's resolved Principal, or {anonymous:true}
   * when no (valid) token was presented. Public so anonymous callers get a 200.
   */
  @Public()
  @Get('me')
  me(@CurrentUser() user: Principal): Principal | { anonymous: true } {
    return user ?? { anonymous: true };
  }
}
