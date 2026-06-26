import { TestingModule } from '@nestjs/testing';
import { PORTS, type AuditRepo } from '@core/ports';
import type { Principal } from '@core/types';
import { LocalityService, textLeaksCoordinates } from './locality.service';
import { makeContext } from '@src/test-support/make-context';

const certified = (id: string, roles: any[] = ['contributor']): Principal => ({ sub: id, accountId: id, assurance: 'certified', roles, orcid: null });
const verifiedOnly = (id: string): Principal => ({ sub: id, accountId: id, assurance: 'verified', roles: ['contributor'], orcid: null });

// A genuine South-African locality (Mesembryanthemum country): lat negative, lon positive.
const PRECISE = { lat: -33.9249, lon: 18.4241 };

describe('§9.5 Locality / anti-poaching', () => {
  let mod: TestingModule;
  let locality: LocalityService;
  let audit: AuditRepo;

  beforeEach(async () => {
    mod = await makeContext();
    await mod.init();
    locality = mod.get(LocalityService);
    audit = mod.get(PORTS.AuditRepo);
  });
  afterEach(async () => mod.close());

  async function storeSensitive() {
    return locality.splitAndStore({
      koId: 'ko:flagship',
      taxonConcept: 'concept:mesemb',
      lat: PRECISE.lat,
      lon: PRECISE.lon,
      sensitivity: 'highly-sensitive',
      source: { system: 'casabio', id: 'casabio:obs:1' },
      actorRef: 'acct:contributor',
    });
  }

  it('the public projection contains no coordinate finer than QDS', async () => {
    const { public: pub } = await storeSensitive();
    const json = JSON.stringify(pub);
    expect(pub.localityQDS).toMatch(/^\d{4}[A-D]{2}$/);
    // The precise decimals must appear nowhere in the public doc.
    expect(json).not.toContain('33.9249');
    expect(json).not.toContain('18.4241');
    expect(json).not.toContain('"lat"');
    expect(json).not.toContain('"lon"');
  });

  it('a caption carrying coordinates is refused (indirect leakage guard)', async () => {
    expect(textLeaksCoordinates('Found near -33.9249, 18.4241 by the road')).toBe(true);
    await expect(
      locality.splitAndStore({
        koId: 'ko:x', taxonConcept: 'concept:x', lat: PRECISE.lat, lon: PRECISE.lon, sensitivity: 'sensitive',
        source: { system: 'casabio', id: 'c:1' }, actorRef: 'acct:c', publicCaptions: ['Seen at -33.9249, 18.4241'],
      }),
    ).rejects.toThrow(/leakage|coordinates/i);
  });

  it('certified user WITHOUT a grant is denied 403 and no disclosure is written', async () => {
    const { obsId } = await storeSensitive();
    await expect(locality.servePrecise(certified('acct:r1'), obsId, 'field-verification')).rejects.toThrow(/denied/);
    const disclosed = await audit.list({ objectRef: obsId, action: 'disclosed' });
    expect(disclosed.length).toBe(0);
  });

  it('a non-certified user is denied even with a grant', async () => {
    const { obsId } = await storeSensitive();
    await locality.issueGrant({ grantee: 'acct:r2', objectRef: obsId, purpose: 'field-verification', grantedBy: 'acct:editor', ttlMs: 60_000 });
    await expect(locality.servePrecise(verifiedOnly('acct:r2'), obsId, 'field-verification')).rejects.toThrow(/not-certified|denied/);
  });

  it('certified user WITH an active, in-purpose, unexpired grant is served and a disclosed row is written', async () => {
    const { obsId } = await storeSensitive();
    await locality.issueGrant({ grantee: 'acct:r3', objectRef: obsId, purpose: 'field-verification', grantedBy: 'acct:editor', ttlMs: 60_000 });
    const precise = await locality.servePrecise(certified('acct:r3'), obsId, 'field-verification');
    expect(precise.lat).toBeCloseTo(PRECISE.lat, 4);
    expect(precise.lon).toBeCloseTo(PRECISE.lon, 4);
    const disclosed = await audit.list({ objectRef: obsId, action: 'disclosed' });
    expect(disclosed.length).toBe(1);
  });

  it('purpose mismatch is denied', async () => {
    const { obsId } = await storeSensitive();
    await locality.issueGrant({ grantee: 'acct:r4', objectRef: obsId, purpose: 'field-verification', grantedBy: 'acct:editor', ttlMs: 60_000 });
    await expect(locality.servePrecise(certified('acct:r4'), obsId, 'commercial-bioprospecting')).rejects.toThrow(/denied/);
  });

  it('an expired grant denies access', async () => {
    const { obsId } = await storeSensitive();
    await locality.issueGrant({ grantee: 'acct:r5', objectRef: obsId, purpose: 'field-verification', grantedBy: 'acct:editor', ttlMs: -1 });
    await expect(locality.servePrecise(certified('acct:r5'), obsId, 'field-verification')).rejects.toThrow(/denied|no-active-grant/);
  });

  it('a revoked grant denies access', async () => {
    const { obsId } = await storeSensitive();
    const grant = await locality.issueGrant({ grantee: 'acct:r6', objectRef: obsId, purpose: 'field-verification', grantedBy: 'acct:editor', ttlMs: 60_000 });
    await locality.revokeGrant(grant.id, 'acct:editor');
    await expect(locality.servePrecise(certified('acct:r6'), obsId, 'field-verification')).rejects.toThrow(/denied|no-active-grant/);
  });

  it('offline precise requires a grant with offlinePkg=true', async () => {
    const { obsId } = await storeSensitive();
    await locality.issueGrant({ grantee: 'acct:r7', objectRef: obsId, purpose: 'field-verification', grantedBy: 'acct:editor', ttlMs: 60_000, offlinePkg: false });
    await expect(locality.servePrecise(certified('acct:r7'), obsId, 'field-verification', true)).rejects.toThrow(/offline/);
  });
});
