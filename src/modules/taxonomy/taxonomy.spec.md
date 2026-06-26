# Taxonomy module — spec (§3.5 TDWG concept model)

## Goal
Implement the TDWG concept model where **Name ≠ Taxon**. A `NomName` is a governed
string; a `TaxonConcept` is "that name *sec.* a particular treatment version".
Multiple treatments may assert competing concepts on one name and they must
coexist — none overwrites another (§9.7).

## Constraints
- Inject only `PORTS.TaxonomyRepo` and `ProvenanceService` (never a DB directly).
- IDs: `mintId('name'|'concept'|'assert'|'act')`.
- Every create records a `ProvenanceService` event with `subjectRef` = the new id.
- Writes require `@MinAssurance('verified')`; reads are `@Public()`.
- Actor = `{ ref: user.accountId, role: user.roles[0] ?? 'author' }`.
- Route paths exactly per §7 (below). No edits outside `src/modules/taxonomy/`.

## Endpoints (§7)
| Method | Path                  | Auth                       | Effect |
|--------|-----------------------|----------------------------|--------|
| POST   | `/names`              | `@MinAssurance('verified')`| create `NomName` (`mintId('name')`) |
| POST   | `/names/:id/acts`     | `@MinAssurance('verified')`| create `NomenclaturalAct` via `repo.createAct` (`mintId('act')`) |
| POST   | `/concepts`           | `@MinAssurance('verified')`| create `TaxonConcept` (`mintId('concept')`); `secVersion` = `ver:…` of asserting treatment |
| POST   | `/assertions`         | `@MinAssurance('verified')`| create `Assertion` (`mintId('assert')`) |
| GET    | `/concepts/:id`       | `@Public()`                | the concept incl. its `secVersion` treatment version |
| GET    | `/names/:id/concepts` | `@Public()`                | ALL competing concepts on that name (array) |

## Edge cases
- Concept/assertion/act against a non-existent name/concept → `404` (`NotFoundException`).
- Unset optional name fields normalised to `null` (matches `NomName`/`TaxonConcept` shape).
- `assertedBy` defaults to the calling actor when omitted; `evidenceRefs` defaults to `[]`.
- A name with no concepts → empty array (not 404).
- Concepts are never mutated: the asserting `secVersion` is immutable on the row.

## Success criteria (§9.7 acceptance)
Two treatments asserting **different** concepts for **one** name →
- both `taxon_concept` rows coexist (`listConceptsForName` returns 2);
- each is resolvable with its own `secVersion`;
- neither overwrites the other (verified at both service and repo layers).
Proven by `taxonomy.spec.ts` (`§9.7 ... coexist — neither overwrites the other`).

## Verification
Centralised (orchestrator runs lint/test/build). The spec uses a local in-memory
DI context mirroring `make-context.ts` (global `PersistenceModule` +
`ProvenanceModule` + `TaxonomyModule`), deterministic and service-free, because
the frozen `makeContext()` does not wire `TaxonomyModule`.

## Orchestrator wiring
Add `TaxonomyModule` to `src/app.module.ts` imports. No other module's files are
touched; `TaxonomyService` is exported for any downstream consumer.
