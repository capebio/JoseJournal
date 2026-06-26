import { Module } from '@nestjs/common';
import { FederationService } from './federation.service';
import { FederationController } from './federation.controller';

/**
 * Federation — read-only standards-based connectors OUT. Self-contained: no
 * persistence ports, no cross-module dependencies. v1 connectors are offline-safe
 * stubs (deterministic CI, no network); live HTTP is behind a future flag.
 */
@Module({
  providers: [FederationService],
  controllers: [FederationController],
  exports: [FederationService],
})
export class FederationModule {}
