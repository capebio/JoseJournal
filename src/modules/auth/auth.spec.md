# Auth module — spec

## Goal
Provide a dev-login helper and a whoami endpoint. The real trust boundary (the
global `AuthGuard` in `@common/auth.guard`, registered by `CommonModule`) already
verifies Keycloak RS256 tokens and an HS256 dev path, and resolves them to a
`Principal`. This module only:

1. mints HS256 dev tokens so local/e2e runs work without Keycloak, and
2. echoes the caller's resolved `Principal`.

## Constraints
- Files live only under `src/modules/auth/`.
- No DB access; no edits to spine/core/common/persistence or other modules.
- `POST /auth/dev-login` must mint via `signHs256(claims, devSecret)` from
  `@common/jwt`, and must work ONLY when `config.get('keycloak').devMode` is true,
  else throw `ForbiddenException`.
- Both routes are `@Public()` (anonymous callers get a 200; the guard still
  attaches a `Principal` when a valid bearer is present).

## Endpoints
- `POST /auth/dev-login` (`@Public()`)
  - Body: `{ sub, accountId?, assurance?, roles?, orcid?, name? }`.
  - Returns `{ token: signHs256({sub, accountId, assurance, roles, orcid, name}, devSecret) }`.
  - Throws `ForbiddenException` when `keycloak.devMode` is false.
- `GET /auth/me` (`@Public()`)
  - Returns the resolved `Principal`, or `{ anonymous: true }` when none.

## Edge cases
- Dev mode off → `dev-login` is forbidden (no self-issued trust in prod).
- Garbage / absent bearer on `/auth/me` → tolerated (public read), reports anonymous.
- The HS256 token must carry the dev/extension claims (`accountId`, `assurance`,
  `roles`, `orcid`, `name`) the guard reads when auto-provisioning the account and
  building the `Principal`.

## Success criteria (acceptance)
- `dev-login` returns a token; its claims decode to the requested identity.
- Presenting that token as `Authorization: Bearer <token>` to `/auth/me` resolves
  a `Principal` with the requested `assurance`/`roles`.
- `/auth/me` without a token (or with junk) reports `{ anonymous: true }`.
- `dev-login` throws when `devMode` is false.

## Verification
`auth.spec.ts` builds a small HTTP Nest app (`ConfigModule` +
`PersistenceModule.forRoot()` + `CommonModule` + `AuthModule`) — because
`makeContext()` omits `AuthModule` and is HTTP-less — and drives the full round
trip through the global guard with supertest, plus a direct `decodeJwt` claims
check. Deterministic: in-memory persistence, no network, no `Date.now` reliance
beyond what `signHs256` stamps.
