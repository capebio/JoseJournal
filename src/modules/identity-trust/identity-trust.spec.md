# Identity & Trust module — spec (§3.6, §7)

## Goal
Keep three concerns deliberately separate and enforce a collusion-resistant
assurance ladder plus an integrity-only trust metric.

- **Account** — the thing a human logs into; carries the assurance ladder
  `unverified → verified → certified`.
- **IdentityRecord** (`idrec:…`) — a referenceable person nobody logs into
  (e.g. `'L.'` = Linnaeus), curated by an account, optionally later claimed.
- **Trust metric** — accrued from deeds; broken ONLY on integrity, never on
  disagreement.

## Constraints
- Writes go only through `PORTS.IdentityRepo` and `PORTS.AuditRepo`; provenance
  via the global `ProvenanceService`. No direct DB access.
- IDs minted with `mintId('idrec' | 'cert')`.
- All three endpoints require `@MinAssurance('verified')`. Caller resolved via
  `@CurrentUser()`; `curatedBy`/`accountId` = `user.accountId`.
- Certification is peer-vouched and collusion-resistant: **≥2 DISTINCT** vouchers.
  Duplicate vouchers (same account, incl. self) are ignored, not counted.
- Trust breaks only on integrity (§3.6): `recordTrust('disagreement', …)` is
  refused (throws). `integrity_breach` carries a negative weight and lowers score.
- No public leaderboard in v1 (`score()` is a service method, not an endpoint).

## Endpoints (§7)
- `POST /identity/records` — body `{displayName, externalIds?}` → `IdentityRecord`,
  `curatedBy = user.accountId`.
- `POST /certification/apply` → `Certification` for `user.accountId`, status
  `pending`, `vouchedBy: []`.
- `POST /certification/:id/vouch` → add caller as a distinct voucher; on the 2nd
  distinct voucher set status `granted` and upgrade the applicant account to
  `certified` (`IdentityRepo.updateAccount`), with provenance + audit rows.

## Service methods
- `createIdentityRecord(input)`, `applyForCertification(accountId)`,
  `vouch(certId, voucherAccountId)`.
- `recordTrust(accountId, kind, weight, basisRef?)` — refuses `disagreement`.
- `score(accountId)` — via `IdentityRepo.computeTrustScore`.

## Edge cases
- Vouching a non-existent certification → `NotFoundException`.
- Vouching an already-granted certification → no-op (idempotent), returns it.
- Same voucher twice, or applicant self-vouching, never reaches the threshold.
- Granting is idempotent (status guarded to flip `pending → granted` once).

## Success criteria
- Apply + 2 distinct vouches ⇒ account assurance becomes `certified`; exactly one
  `certification-granted` audit row.
- One voucher, or the same voucher twice, does NOT certify.
- `recordTrust('integrity_breach', negative)` lowers the score.
- `recordTrust('disagreement', …)` throws and writes no trust event.

These are proven in `identity-trust.spec.ts` against the in-memory persistence.
