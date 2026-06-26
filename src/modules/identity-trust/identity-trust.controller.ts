import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, MinAssurance } from '@common/decorators';
import type { Principal } from '@core/types';
import { IdentityTrustService } from './identity-trust.service';
import { CreateIdentityRecordDto } from './identity-trust.dto';

@ApiTags('identity-trust')
@Controller()
export class IdentityTrustController {
  constructor(private readonly identityTrust: IdentityTrustService) {}

  /**
   * §7 POST /identity/records — mint a referenceable IdentityRecord (idrec:…)
   * that nobody logs into (e.g. 'L.' = Linnaeus), curated by the caller.
   */
  @MinAssurance('verified')
  @Post('identity/records')
  async createRecord(@Body() dto: CreateIdentityRecordDto, @CurrentUser() user: Principal) {
    return this.identityTrust.createIdentityRecord({
      displayName: dto.displayName,
      externalIds: dto.externalIds as Record<string, string> | undefined,
      curatedBy: user.accountId,
    });
  }

  /** §7 POST /certification/apply — open a pending certification for the caller. */
  @MinAssurance('verified')
  @Post('certification/apply')
  async apply(@CurrentUser() user: Principal) {
    return this.identityTrust.applyForCertification(user.accountId);
  }

  /**
   * §7 POST /certification/:id/vouch — add the caller as a distinct voucher.
   * Two distinct vouchers grant the certification and certify the applicant.
   */
  @MinAssurance('verified')
  @Post('certification/:id/vouch')
  async vouch(@Param('id') id: string, @CurrentUser() user: Principal) {
    return this.identityTrust.vouch(id, user.accountId);
  }
}
