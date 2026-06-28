import { ForbiddenException } from '@nestjs/common';
import type { ActorRole, Assurance, Principal } from '@core/types';

/**
 * Numeric rank of the impl's assurance enum — the SINGLE source of truth (the
 * guard and the capability registry both read it). The reconciled spec's 4-level
 * ladder (anonymous|orcid|endorsed|certified) maps onto v1's three levels; the
 * level-2 'endorsed' rung arrives with the web-of-trust work (M1), until which
 * level-2 capabilities sit at 'verified'.
 */
export const ASSURANCE_RANK: Record<Assurance, number> = { unverified: 0, verified: 1, certified: 2 };

export interface Capability {
  minAssurance: Assurance;
  /** Any-of role requirement on top of the assurance floor (optional). */
  roles?: ActorRole[];
}

/**
 * // DECISION: D7 — capability → assurance-level (+ role) mapping.
 *
 * The single DATA table the trust boundary resolves every gate against, instead
 * of scattered @MinAssurance/@Roles checks. Adopted default = the DECISIONS-OPEN
 * proposal: read=anon(0); contribute/publish-commons/accountable-author=orcid(1);
 * propose-fork/nominate-reviewers=endorsed(2); peer-review / request-precise /
 * release-vor / grant-precise / steward = certified(3), with 'steward' expressed
 * as a role flag on top of certification rather than a 4th rung. Until the level-2
 * 'endorsed' rung exists, level-2 capabilities require 'verified'.
 *
 * Change THIS table (and ASSURANCE_RANK) when DGE rules on D7 — nowhere else.
 */
export const CAPABILITIES: Record<string, Capability> = {
  read: { minAssurance: 'unverified' },
  contribute: { minAssurance: 'verified' },
  'publish-commons': { minAssurance: 'verified' },
  'accountable-author': { minAssurance: 'verified' },
  'propose-fork': { minAssurance: 'verified' }, // D7: spec target is endorsed(2); interim 'verified' until the rung lands
  'nominate-reviewers': { minAssurance: 'verified' }, // D7: spec target endorsed(2); interim 'verified'
  'peer-review': { minAssurance: 'certified', roles: ['reviewer', 'editor', 'steward'] },
  'request-precise': { minAssurance: 'certified' },
  'release-vor': { minAssurance: 'certified', roles: ['author', 'editor', 'steward'] },
  'grant-precise': { minAssurance: 'certified', roles: ['editor', 'steward'] },
  steward: { minAssurance: 'certified', roles: ['steward', 'editor'] },
};

export function capabilityFor(key: string): Capability {
  const cap = CAPABILITIES[key];
  if (!cap) throw new Error(`unknown capability "${key}"`);
  return cap;
}

/** True iff the principal satisfies the capability (assurance rank + any-of roles). */
export function principalHasCapability(principal: Principal, key: string): boolean {
  const cap = capabilityFor(key);
  if (ASSURANCE_RANK[principal.assurance] < ASSURANCE_RANK[cap.minAssurance]) return false;
  if (cap.roles && cap.roles.length > 0 && !cap.roles.some((r) => principal.roles.includes(r))) return false;
  return true;
}

/** Throw 403 unless the principal satisfies the capability (for in-handler gating). */
export function assertCapability(principal: Principal, key: string): void {
  if (!principalHasCapability(principal, key)) {
    const cap = capabilityFor(key);
    const roles = cap.roles ? ` and one of roles [${cap.roles.join(', ')}]` : '';
    throw new ForbiddenException(`capability '${key}' requires assurance '${cap.minAssurance}'${roles}`);
  }
}
