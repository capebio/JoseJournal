# Export Module Spec (§7, §9.8, §11 — "no cage")

## Goal
Frictionless export of a Knowledge Object's content at **any** stage. An author
must always be able to walk away with their work in a standard, portable format —
the platform is "not a cage." Export is **never** gated on release/visibility/status.

## Endpoint (§7, exact)
`GET /ko/:koId/export?format=md|docx|jats|json&version=<verId?>`
- Guard: `@Roles('author','contributor','editor','steward')`.
- Loads the target version: `version` query param if given, else the entity's current tip
  (`KnowledgeObjectService.getEntity` → `refs.tip` → `getVersion`).
- Renders and returns the string body; sets a format-appropriate `Content-Type`.

## Formats
- **json** — the canonical `VersionDoc` (`JSON.stringify`, pretty). `application/json`.
- **md** — `# title`, then per section `## (title||path)` and its blocks: paragraph
  text verbatim; figures as `![caption]` (caption chosen at **surface** depth). `text/markdown`.
- **jats** — minimal well-formed JATS XML:
  `<article><front><article-meta><title-group><article-title>…` and
  `<body><sec><title>…</title><p>…</p></sec></body>`. XML entities escaped. `application/xml`.
- **docx** — minimal WordprocessingML `document.xml` **body string**.
  **v1 LIMITATION** (documented in `export.service.ts#renderDocx`): this is the bare
  WordML document, NOT a zipped `.docx` OOXML container. md/jats/json are the fully
  supported formats. `application/xml`.

## Constraints
- Write only inside `src/modules/export/`.
- Inject `KnowledgeObjectService` (import `KnowledgeObjectModule`).
- Record a provenance `exported` event on every export (`ProvenanceService`, global).
- No release/visibility/status gate in the renderer; access control stays at the
  route guard and the KO read path.

## Edge cases
- Unknown KO / unknown version → `NotFoundException`.
- `version` param that belongs to a different KO → `NotFoundException`.
- KO with no committed version (empty tip) → `NotFoundException`.
- XML special characters in titles/text are escaped in jats/docx.
- Figure/caption blocks contribute their surface caption; paragraph blocks their text.

## Success criteria (§9.8 acceptance)
A **private raw draft** KO can be exported and md + json + jats all return non-empty
content containing the title. Covered by `export.spec.ts`:
- md/json/jats/docx of a private 'raw' draft are non-empty and contain the title;
- explicit `version` param pins that version;
- unknown KO and cross-KO version are rejected;
- an `exported` provenance event is written against the version;
- XML escaping is correct.
