import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import configuration from '@src/config/configuration';
import { PersistenceModule } from '@persistence/persistence.module';
import { ProvenanceModule } from '@modules/provenance/provenance.module';
import { PORTS, type AuditRepo, type IdentityRepo } from '@core/ports';
import type { Account } from '@core/types';
import { IdentityTrustService } from './identity-trust.service';
import { IdentityTrustModule } from './identity-trust.module';

/**
 * Mirrors test-support/makeContext but wires the IdentityTrustModule (which the
 * shared harness does not import). Same in-memory, service-free persistence.
 */
async function makeIdentityContext(): Promise<TestingModule> {
  process.env.PERSISTENCE = 'memory';
  return Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, load: [configuration], ignoreEnvFile: true }),
      PersistenceModule.forRoot(),
      ProvenanceModule,
      IdentityTrustModule,
    ],
  }).compile();
}

const account = (id: string): Account => ({
  id,
  keycloakSub: `kc:${id}`,
  orcid: null,
  displayName: id,
  assurance: 'verified',
  createdAt: new Date().toISOString(),
});

describe('§9.6 Identity & Trust', () => {
  let mod: TestingModule;
  let svc: IdentityTrustService;
  let identity: IdentityRepo;
  let audit: AuditRepo;

  beforeEach(async () => {
    mod = await makeIdentityContext();
    await mod.init();
    svc = mod.get(IdentityTrustService);
    identity = mod.get(PORTS.IdentityRepo);
    audit = mod.get(PORTS.AuditRepo);
  });
  afterEach(async () => mod.close());

  it('creates a referenceable IdentityRecord nobody logs into (idrec:…), curated by the caller', async () => {
    const rec = await svc.createIdentityRecord({
      displayName: 'L.',
      externalIds: { ipni: '12653-1', botanistAbbrev: 'L.' },
      curatedBy: 'acct:curator',
    });
    expect(rec.id).toMatch(/^idrec:/);
    expect(rec.displayName).toBe('L.');
    expect(rec.curatedBy).toBe('acct:curator');
    expect(rec.claimedBy).toBeNull();
    expect(rec.externalIds).toEqual({ ipni: '12653-1', botanistAbbrev: 'L.' });
    expect(await identity.getIdentityRecord(rec.id)).not.toBeNull();
  });

  it('applying then receiving 2 DISTINCT vouches certifies the account', async () => {
    await identity.createAccount(account('acct:applicant'));
    const cert = await svc.applyForCertification('acct:applicant');
    expect(cert.status).toBe('pending');
    expect(cert.vouchedBy).toEqual([]);

    await svc.vouch(cert.id, 'acct:voucherA');
    let mid = await identity.getCertification(cert.id);
    expect(mid!.status).toBe('pending');
    expect((await identity.getAccount('acct:applicant'))!.assurance).toBe('verified');

    const granted = await svc.vouch(cert.id, 'acct:voucherB');
    expect(granted.status).toBe('granted');
    expect(granted.vouchedBy).toEqual(['acct:voucherA', 'acct:voucherB']);

    expect((await identity.getAccount('acct:applicant'))!.assurance).toBe('certified');
    const ledger = await audit.list({ objectRef: cert.id, action: 'certification-granted' });
    expect(ledger.length).toBe(1);
  });

  it('a single voucher does NOT certify', async () => {
    await identity.createAccount(account('acct:solo'));
    const cert = await svc.applyForCertification('acct:solo');
    const after = await svc.vouch(cert.id, 'acct:voucherA');
    expect(after.status).toBe('pending');
    expect((await identity.getAccount('acct:solo'))!.assurance).toBe('verified');
  });

  it('the SAME voucher twice does NOT certify (collusion-resistant distinctness)', async () => {
    await identity.createAccount(account('acct:dupe'));
    const cert = await svc.applyForCertification('acct:dupe');
    await svc.vouch(cert.id, 'acct:voucherA');
    const after = await svc.vouch(cert.id, 'acct:voucherA');
    expect(after.vouchedBy).toEqual(['acct:voucherA']);
    expect(after.status).toBe('pending');
    expect((await identity.getAccount('acct:dupe'))!.assurance).toBe('verified');
  });

  it('recordTrust(integrity_breach, negative) lowers the score', async () => {
    await svc.recordTrust('acct:t1', 'contribution', 5, 'ver:abc');
    expect(await svc.score('acct:t1')).toBe(5);
    await svc.recordTrust('acct:t1', 'integrity_breach', -8, 'ver:abc');
    expect(await svc.score('acct:t1')).toBe(-3);
  });

  it('recordTrust(disagreement) throws — trust never breaks on disagreement (§3.6)', async () => {
    await expect(svc.recordTrust('acct:t2', 'disagreement', -3)).rejects.toThrow(/disagreement|integrity/i);
    expect(await svc.score('acct:t2')).toBe(0);
  });
});
