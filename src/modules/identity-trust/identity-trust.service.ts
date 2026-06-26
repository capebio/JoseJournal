import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PORTS, type AuditRepo, type IdentityRepo } from '@core/ports';
import type { Certification, IdentityRecord, Principal, TrustEvent } from '@core/types';
import { mintId } from '@core/ids';
import { ProvenanceService } from '@modules/provenance/provenance.service';

export interface CreateIdentityRecordInput {
  displayName: string;
  externalIds?: Record<string, string>;
  /** acct:… of the curator — an IdentityRecord is referenceable, never logged into. */
  curatedBy: string;
}

/**
 * §3.6 Identity & Trust. Three orthogonal things kept deliberately separate:
 *
 *  - the *Account* someone logs into (assurance ladder: unverified→verified→certified);
 *  - the *IdentityRecord* — a referenceable person nobody logs into ('L.' = Linnaeus),
 *    curated by an account and optionally later claimed by one;
 *  - the *trust metric* — accrued from deeds (contributions, reviews, corrections,
 *    endorsements), broken ONLY by an integrity breach, never by disagreement (§3.6).
 *
 * Certification is peer-vouched and collusion-resistant: it needs ≥2 DISTINCT
 * vouchers; reaching that threshold both grants the certification and upgrades the
 * applicant account to 'certified'. There is no public leaderboard in v1.
 */
@Injectable()
export class IdentityTrustService {
  constructor(
    @Inject(PORTS.IdentityRepo) private readonly identity: IdentityRepo,
    @Inject(PORTS.AuditRepo) private readonly audit: AuditRepo,
    private readonly provenance: ProvenanceService,
  ) {}

  /** §7 create a referenceable IdentityRecord (idrec:…) nobody logs into. */
  async createIdentityRecord(input: CreateIdentityRecordInput): Promise<IdentityRecord> {
    const record: IdentityRecord = {
      id: mintId('idrec'),
      displayName: input.displayName,
      externalIds: input.externalIds ?? null,
      curatedBy: input.curatedBy,
      claimedBy: null,
    };
    await this.identity.createIdentityRecord(record);
    await this.provenance.record({
      subjectRef: record.id,
      actorRef: input.curatedBy,
      actorRole: 'steward',
      action: 'created',
      detail: { displayName: record.displayName },
    });
    return record;
  }

  /** §7 apply for certification — opens a pending request for the caller's account. */
  async applyForCertification(accountId: string): Promise<Certification> {
    const cert: Certification = {
      id: mintId('cert'),
      accountId,
      vouchedBy: [],
      status: 'pending',
      scope: null,
      ts: new Date().toISOString(),
    };
    await this.identity.createCertification(cert);
    await this.provenance.record({
      subjectRef: cert.id,
      actorRef: accountId,
      actorRole: 'author',
      action: 'consent-requested',
      detail: { kind: 'certification-application' },
    });
    return cert;
  }

  /**
   * §7 add a distinct voucher to a pending certification. Collusion-resistant:
   * a duplicate voucher (same account, including the applicant re-vouching) is
   * ignored. On reaching ≥2 DISTINCT vouchers the certification is granted and
   * the applicant account is upgraded to 'certified' — recorded in provenance
   * and the audit ledger.
   */
  async vouch(certId: string, voucherAccountId: string): Promise<Certification> {
    const cert = await this.identity.getCertification(certId);
    if (!cert) throw new NotFoundException(`no certification ${certId}`);
    if (cert.status !== 'pending') return cert; // idempotent once resolved

    // Ignore duplicate vouchers — distinctness is what makes the threshold meaningful.
    if (!cert.vouchedBy.includes(voucherAccountId)) {
      cert.vouchedBy = [...cert.vouchedBy, voucherAccountId];
      await this.identity.updateCertification(cert);
      await this.provenance.record({
        subjectRef: cert.id,
        actorRef: voucherAccountId,
        actorRole: 'steward',
        action: 'endorsed',
        detail: { vouchCount: cert.vouchedBy.length },
      });
    }

    if (cert.vouchedBy.length >= 2 && cert.status === 'pending') {
      cert.status = 'granted';
      await this.identity.updateCertification(cert);

      const account = await this.identity.getAccount(cert.accountId);
      if (account) {
        account.assurance = 'certified';
        await this.identity.updateAccount(account);
      }

      const ts = new Date().toISOString();
      await this.provenance.record({
        subjectRef: cert.id,
        actorRef: voucherAccountId,
        actorRole: 'steward',
        action: 'consent-resolved',
        detail: { result: 'granted', accountId: cert.accountId, vouchers: cert.vouchedBy },
      });
      await this.audit.append({
        ts,
        actorRef: voucherAccountId,
        action: 'certification-granted',
        objectRef: cert.id,
        disclosure: 'public',
        detail: { accountId: cert.accountId, vouchers: cert.vouchedBy, assurance: 'certified' },
      });
    }
    return cert;
  }

  /**
   * Record a trust deed. Trust breaks ONLY on integrity (§3.6) — a 'disagreement'
   * is never a trust event and is refused outright. An 'integrity_breach' carries a
   * negative weight and lowers the score; positive deeds raise it.
   */
  async recordTrust(accountId: string, kind: string, weight: number, basisRef?: string): Promise<TrustEvent> {
    if (kind === 'disagreement') {
      throw new BadRequestException('trust never breaks on disagreement — only on integrity (§3.6)');
    }
    return this.identity.addTrustEvent({
      accountId,
      kind: kind as TrustEvent['kind'],
      weight,
      basisRef: basisRef ?? null,
      ts: new Date().toISOString(),
    });
  }

  /** Current (private — no public leaderboard in v1) trust score for an account. */
  score(accountId: string): Promise<number> {
    return this.identity.computeTrustScore(accountId);
  }
}
