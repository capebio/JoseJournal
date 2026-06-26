# Federation module — SPEC

## Goal
Read-only, standards-based connectors OUT from JOSE to external biodiversity and
identity authorities. JOSE *resolves* references held elsewhere into a uniform,
source-tagged "federated reference" object. It never writes back upstream.

## Constraints
- **Read-only.** No persistence ports, no cross-module dependencies, no writes.
- **Offline-safe in v1.** Every resolver returns a structured stub synthesised from
  its inputs — NO network I/O — so CI is deterministic and needs no live upstream.
- **Real HTTP is behind a future flag** (`federation.live`, default off) and is NOT
  wired in v1. Flipping the flag changes only the private `fetch*` bodies; the
  returned `FederatedReference` shape is the stable contract.
- **The scientific name is the interlingua and MUST NOT be translated.** It is the
  join key across every connector. Vernacular/common names are an additive layer
  hung off the scientific name, never a replacement.
- All routes are `@Public()` reads (no auth, no assurance gate).

## Resolvers (each returns `{ source, id, resolvedAt: new Date().toISOString(), stub, data }`)
- `resolveObservation(system, id)` — GBIF / iNaturalist / FishBase / Casabio.
- `resolveSequence(accession)` — GenBank / ENA / DDBJ (INSDC mirror set).
- `resolveTaxon(name)` — Catalogue of Life / EOL / Wikidata (vernacular-names layer).
- `resolvePerson(ref)` — ORCID / Bionomia / IPNI / VIAF (incl. deceased authors).

## Endpoints (all `@Public()`)
- `GET /federation/observation?system=&id=`
- `GET /federation/sequence?accession=`
- `GET /federation/taxon?name=`
- `GET /federation/person?ref=`

## Edge cases
- Unknown observation `system` → labelled `unknown:<system>` rather than mislabelled.
- Sequence archive inferred from authority prefix (`ena:`, `ddbj:`, `genbank:`) or
  accession shape; defaults to GenBank.
- Person authority inferred from prefix or ORCID id shape; defaults to ORCID.
- Registries that carry deceased authors (Bionomia/IPNI/VIAF) flag `includesDeceased`.

## Success criteria
- Each endpoint returns a deterministic shape with the upstream source labelled
  (provenance of source).
- The spec proves all four resolvers return source-tagged references and that the
  scientific name passes through `resolveTaxon` verbatim (untranslated).
- Compiles cleanly; spec is deterministic (no network, only `new Date()`).
