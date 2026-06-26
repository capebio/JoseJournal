import { Module } from '@nestjs/common';
import { AuthoringService } from './authoring.service';
import { AuthoringController } from './authoring.controller';

/**
 * Authoring / AI provenance declaration (§7, §13). Depends only on the global
 * AiDeclarationRepo port and the global ProvenanceService, so no imports are
 * needed here.
 */
@Module({
  providers: [AuthoringService],
  controllers: [AuthoringController],
  exports: [AuthoringService],
})
export class AuthoringModule {}
