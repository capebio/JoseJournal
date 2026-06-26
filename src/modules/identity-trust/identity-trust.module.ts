import { Module } from '@nestjs/common';
import { IdentityTrustService } from './identity-trust.service';
import { IdentityTrustController } from './identity-trust.controller';

@Module({
  providers: [IdentityTrustService],
  controllers: [IdentityTrustController],
  exports: [IdentityTrustService],
})
export class IdentityTrustModule {}
