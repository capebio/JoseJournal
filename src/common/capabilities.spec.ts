import { principalHasCapability, assertCapability } from './capabilities';
import type { Principal } from '@core/types';

const P = (assurance: Principal['assurance'], roles: Principal['roles'] = []): Principal => ({
  sub: 'kc', accountId: 'acct:x', assurance, roles, orcid: null,
});

describe('// DECISION: D7 — capability registry', () => {
  it('a verified (level-1) user is refused certified-only capabilities', () => {
    const u = P('verified', ['author', 'reviewer']);
    expect(principalHasCapability(u, 'request-precise')).toBe(false);
    expect(principalHasCapability(u, 'peer-review')).toBe(false);
    expect(principalHasCapability(u, 'release-vor')).toBe(false);
    expect(() => assertCapability(u, 'release-vor')).toThrow(/certified/);
  });

  it('a certified user with the right role passes the certified capabilities', () => {
    const reviewer = P('certified', ['reviewer']);
    expect(principalHasCapability(reviewer, 'peer-review')).toBe(true);
    expect(principalHasCapability(reviewer, 'request-precise')).toBe(true);

    const author = P('certified', ['author']);
    expect(principalHasCapability(author, 'release-vor')).toBe(true);
    // certified but lacking a granting role cannot grant precise to others
    expect(principalHasCapability(author, 'grant-precise')).toBe(false);
    expect(principalHasCapability(P('certified', ['editor']), 'grant-precise')).toBe(true);
  });

  it('verified can publish to Commons but not mint a Journal VoR', () => {
    const u = P('verified', ['author']);
    expect(principalHasCapability(u, 'publish-commons')).toBe(true);
    expect(principalHasCapability(u, 'release-vor')).toBe(false);
  });

  it('unverified is read-only', () => {
    const u = P('unverified');
    expect(principalHasCapability(u, 'read')).toBe(true);
    expect(principalHasCapability(u, 'contribute')).toBe(false);
  });
});
