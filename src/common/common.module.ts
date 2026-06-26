import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth.guard';

/**
 * Registers the trust-boundary guard globally. Every route is protected unless
 * marked @Public(); @MinAssurance / @Roles refine access. The guard depends on
 * IdentityRepo (from the global PersistenceModule), Reflector, and ConfigService.
 */
@Global()
@Module({
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class CommonModule {}
