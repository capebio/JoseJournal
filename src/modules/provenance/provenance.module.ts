import { Global, Module } from '@nestjs/common';
import { ProvenanceService } from './provenance.service';
import { ProvenanceController } from './provenance.controller';

/**
 * Global so every module can inject ProvenanceService without re-importing.
 * This is the cross-cutting "provenance everywhere" guarantee (§11).
 */
@Global()
@Module({
  providers: [ProvenanceService],
  controllers: [ProvenanceController],
  exports: [ProvenanceService],
})
export class ProvenanceModule {}
