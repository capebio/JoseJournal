# Search Module (§8) — Spec

## Goal
Expose a read-only query surface over the Elastic projections built by the
Knowledge Object module. The PUBLIC and RESTRICTED indices are kept strictly
separate; this module only QUERIES (indexing happens in
`KnowledgeObjectService` on create/reindex).

## Constraints
- Inject `PORTS.SearchPort` only; never touch a DB directly.
- Do not index here — query only.
- `GET /search` is `@Public()` so the public index is reachable anonymously.
- The restricted index requires the caller to hold role `editor` or `steward`
  (any-of). Certification or mere authentication is insufficient.
- Default index is `public` when the `index` param is omitted.

## Endpoint
`GET /search?text=&koType=&status=&index=public|restricted`
- Resolves the (possibly anonymous) `Principal` via `@CurrentUser()`.
- If `index === 'restricted'` and the caller lacks `editor`/`steward`, throw
  `ForbiddenException`.
- Otherwise call `SearchPort.search({ text, koType, status, index })`.

## Edge cases
- Anonymous caller (`user` undefined/null) targeting `restricted` → 403.
- Under-privileged caller (e.g. `author`) targeting `restricted` → 403.
- `index` omitted → treated as `public`.
- A public query can never surface restricted-index docs: the port filters by
  index and the two indices are physically separate.

## Success criteria
- A public query returns only public-index docs.
- An anonymous or under-privileged caller cannot query the restricted index.
- An editor/steward can query the restricted index.
- Structured filters (`koType`, `status`, `text`) narrow within the chosen index.
