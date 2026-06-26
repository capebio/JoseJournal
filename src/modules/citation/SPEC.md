# Citation module — spec (§3.9, §7, §9.4)

## Goal
Implement the three-identifier citation model and hardened snippet anchoring for
JOSE knowledge objects:
1. `GET /cite/:koId?as=entity|version|doi` — return citation metadata pinned to
   the requested identifier (never a redirect).
2. `POST /snippets` — anchor a quotation to an immutable version+block.
3. `GET /snippets/:id` — resolve the anchor, detecting later drift and offering
   both the cited and current state.

## Constraints
- Three identifiers are never conflated:
  - entity → `/ko/:koId` (navigation only, follows the moving tip)
  - version → `/ko/:koId/v/:tip` (immutable, content-addressed — the citable unit)
  - doi → the KO's VoR DOI via `ReleaseRepo.getDoiForVersion(entity.refs.vor)`;
    falls back to a version URL + explicit note when no VoR exists.
- Every cite response carries a `YYYY-MM-DD` `asOf` plus `authors` and `title`
  from the chosen version.
- Snippet anchors ALWAYS reference an immutable `versionId`, never an entity
  (§3.9). The block content hash is `sha256Address(canonicalize(block))`.
- `quotedText` defaults to the block's `text` when omitted.
- Restricted blocks (precise locality) are never quotable (§6 leakage guard).
- All DB access via `PORTS.CitationRepo` / `PORTS.ReleaseRepo`; versions/blocks
  loaded via `KnowledgeObjectService`. Provenance recorded on every snippet write.

## Edge cases
- KO with no VoR yet → `as=doi` falls back to the immutable version with a note;
  it never silently redirects.
- A snippet on version V resolves `drift:false` forever because V is immutable —
  a later amend mints a NEW version and never mutates V.
- When the block under the pinned version diverges from the stored content hash
  (block amended under the same `blockId`), resolve returns `drift:true` with the
  cited text AND the current block.
- A `blockId` that no longer exists in the pinned version → `drift:true` with the
  cited text only.
- Missing KO / version / block / snippet → 404.

## Success criteria (§9.4)
- A version/DOI cite response returns the exact pinned identifier/state, never a
  redirect.
- A snippet whose block was later amended resolves with `drift:true` and both
  states.
- Authorization: `/cite/:koId` and `/snippets/:id` are `@Public()`; `/snippets`
  requires `@MinAssurance('verified')`.
- The accompanying `citation.spec.ts` proves all of the above deterministically
  on the in-memory stack.
