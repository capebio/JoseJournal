# Authoring module spec (AI provenance declaration)

## Goal
Let an authorised contributor declare the AI provenance of a Knowledge Object under
one of three honesty tiers — `recorded` (on-platform instrumentation),
`attested` (human attestation), `estimated` (best-guess) — store it, and surface it
publicly with the correct trust label. (JOSE §7 authoring, §13 guiding doc, acceptance §9.8.)

## Endpoints (§7 — exact)
- `POST /ko/:koId/ai-declaration` — `@Roles('author','contributor','editor','steward')`
  - body: `{ coverage, role, model?, accountableHuman?, percentage? }`
  - stores `AiDeclaration { koId, coverage, role, model, accountableHuman: accountableHuman ?? user.accountId, percentage, recordedAt: new Date().toISOString() }`
- `GET /ko/:koId/ai-declaration` — `@Public()` — returns the declaration with a trust label.

## Constraints
- A `percentage` is admissible **only** when `coverage === 'recorded'`; for any other
  coverage it is forced to `null` (an unsubstantiated number is never persisted).
- Every declaration writes a provenance event: `ai-generated` when `role === 'drafting'`,
  otherwise `ai-edited`; `actorRole` is always `'ai'`; `detail` carries `coverage`/`model`.
- `accountableHuman` defaults to the caller (`user.accountId`) when omitted.
- Reads are public; only the listed roles may write.
- Persistence solely via `PORTS.AiDeclarationRepo`; provenance via the global `ProvenanceService`.

## Read-time labelling (§9.8)
- `coverage === 'recorded'` → `{ authoritative: true }`.
- `coverage === 'estimated'` → `{ inferred: true, note: 'best-guess estimate, not forensic' }`.
- `coverage === 'attested'` → returned as-is (no special label).
- No declaration → `404`.

## Edge cases
- Re-declaring the same KO overwrites (`AiDeclarationRepo.put` is keyed by `koId`).
- `percentage` out of range is rejected by the DTO (`@Min(0) @Max(100)`).
- A non-drafting role still records, but as `ai-edited`.

## Success criteria (acceptance §9.8 — proven in authoring.spec.ts)
1. A `recorded` declaration is stored, surfaced, and marked authoritative (percentage kept).
2. An `estimated` declaration is labelled inferred and never forensic (percentage nulled).
3. A `percentage` is rejected/nulled unless `coverage === 'recorded'`.
4. `accountableHuman` defaults to the caller when not supplied.
