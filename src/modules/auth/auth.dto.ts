import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import type { Assurance } from '@core/types';

/**
 * Body of POST /auth/dev-login. Mirrors the dev/extension claims the HS256 path
 * understands (see @common/jwt JwtClaims) so the minted token resolves cleanly
 * to a Principal in the global AuthGuard.
 */
export class DevLoginDto {
  @IsString()
  sub!: string; // keycloak subject (any stable string in dev)

  @IsOptional()
  @IsString()
  accountId?: string; // acct:… — minted on first sight if absent

  @IsOptional()
  @IsIn(['unverified', 'verified', 'certified'])
  assurance?: Assurance;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];

  @IsOptional()
  @IsString()
  orcid?: string;

  @IsOptional()
  @IsString()
  name?: string;
}
