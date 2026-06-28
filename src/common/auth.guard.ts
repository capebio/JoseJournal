import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwksClient } from 'jwks-rsa';
import { PORTS, type IdentityRepo } from '@core/ports';
import type { ActorRole, Assurance, Principal } from '@core/types';
import { mintId } from '@core/ids';
import { CAPABILITY_KEY, MIN_ASSURANCE_KEY, PUBLIC_KEY, ROLES_KEY } from './decorators';
import { ASSURANCE_RANK, assertCapability } from './capabilities';
import { decodeJwt, verifyHs256, verifyRs256, type JwtClaims } from './jwt';

/**
 * The trust boundary's front door (§2.5, §7). Verifies the Keycloak-issued JWT
 * (or an HS256 dev token), resolves it to a JOSE Principal (auto-provisioning
 * the account row on first sight), and enforces @MinAssurance / @Roles.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private jwks?: JwksClient;

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    @Inject(PORTS.IdentityRepo) private readonly identity: IdentityRepo,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    const req = ctx.switchToHttp().getRequest();

    const token = this.extractToken(req);
    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException('missing bearer token');
    }

    let claims: JwtClaims;
    try {
      claims = await this.verify(token);
    } catch (e) {
      if (isPublic) return true; // public reads tolerate a bad/absent token
      throw new UnauthorizedException(`token verification failed: ${(e as Error).message}`);
    }

    const principal = await this.resolvePrincipal(claims);
    req.principal = principal;

    // Even public endpoints get a principal when a valid token is present, but
    // assurance/role gates only apply to protected handlers.
    if (isPublic) return true;

    // A @Capability resolves against the // DECISION: D7 registry and is the
    // authoritative gate when present (it subsumes @MinAssurance/@Roles).
    const capability = this.reflector.getAllAndOverride<string>(CAPABILITY_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (capability) {
      assertCapability(principal, capability);
      return true;
    }

    const minAssurance = this.reflector.getAllAndOverride<Assurance>(MIN_ASSURANCE_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (minAssurance && ASSURANCE_RANK[principal.assurance] < ASSURANCE_RANK[minAssurance]) {
      throw new ForbiddenException(`requires assurance '${minAssurance}', principal is '${principal.assurance}'`);
    }

    const roles = this.reflector.getAllAndOverride<ActorRole[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (roles && roles.length > 0 && !roles.some((r) => principal.roles.includes(r))) {
      throw new ForbiddenException(`requires one of roles [${roles.join(', ')}]`);
    }

    return true;
  }

  private extractToken(req: any): string | null {
    const h = req.headers?.authorization;
    if (typeof h === 'string' && h.startsWith('Bearer ')) return h.slice(7);
    return null;
  }

  private async verify(token: string): Promise<JwtClaims> {
    const kc = this.config.get('keycloak') as any;
    const header = decodeJwt(token).header;
    if (header.alg === 'HS256') {
      if (!kc.devMode) throw new Error('HS256 tokens rejected outside dev mode');
      return verifyHs256(token, kc.devSecret);
    }
    // RS256 — Keycloak. Fetch the signing key by kid from JWKS.
    if (!this.jwks) this.jwks = new JwksClient({ jwksUri: kc.jwksUri, cache: true, rateLimit: true });
    const key = await this.jwks.getSigningKey(header.kid);
    const pem = key.getPublicKey();
    const claims = verifyRs256(token, pem);
    if (kc.issuer && claims.iss && claims.iss !== kc.issuer) throw new Error('issuer mismatch');
    return claims;
  }

  private async resolvePrincipal(claims: JwtClaims): Promise<Principal> {
    let account = await this.identity.getAccountByKeycloakSub(claims.sub);
    // Fall back to the asserted accountId: a dev token (or a re-keyed Keycloak
    // subject) may name an account that already exists. Reuse it rather than
    // attempting a colliding insert (which would 500 on the PK).
    if (!account && claims.accountId) {
      account = await this.identity.getAccount(claims.accountId);
    }
    if (!account) {
      account = await this.identity.createAccount({
        id: claims.accountId || mintId('acct'),
        keycloakSub: claims.sub,
        orcid: claims.orcid ?? null,
        displayName: claims.name || claims.preferred_username || claims.sub,
        assurance: claims.assurance || 'unverified',
        createdAt: new Date().toISOString(),
      });
    }
    const roles = (claims.roles || claims.realm_access?.roles || []) as ActorRole[];
    return {
      sub: claims.sub,
      accountId: account.id,
      assurance: account.assurance,
      roles,
      orcid: account.orcid ?? null,
    };
  }
}
