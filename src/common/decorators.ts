import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { ActorRole, Assurance, Principal } from '@core/types';

/** Endpoints that bypass the JWT guard entirely (public reads). */
export const PUBLIC_KEY = 'jose:public';
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/** Minimum assurance level (§17 ladder). 'certified' gates precise-locality requests. */
export const MIN_ASSURANCE_KEY = 'jose:minAssurance';
export const MinAssurance = (level: Assurance) => SetMetadata(MIN_ASSURANCE_KEY, level);

/** Required role(s) (authority matrix §15). Any-of semantics. */
export const ROLES_KEY = 'jose:roles';
export const Roles = (...roles: ActorRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Gate an endpoint by a named capability resolved against the CAPABILITIES
 * registry (// DECISION: D7). When present it subsumes @MinAssurance/@Roles — the
 * single place the assurance/role floor for that action is defined is the table.
 */
export const CAPABILITY_KEY = 'jose:capability';
export const Capability = (key: string) => SetMetadata(CAPABILITY_KEY, key);

/** Inject the resolved Principal into a handler param. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): Principal => {
  const req = ctx.switchToHttp().getRequest();
  return req.principal as Principal;
});
