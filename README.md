# JOSE — The Journal of Systematics and Ecology

> A living, evidence-governed publication layer for biodiversity science — the scholarly apex of
> [Casabio](https://casabio.org). JOSE shifts from *publishing snapshots* to *maintaining living
> knowledge*: claims stable enough to cite, open enough to correct, with total provenance and
> ethics built into the data model rather than bolted on.

This repository is a working **v1 implementation** of JOSE, built from two specifications (in
[`test/`](test/)): the **Guiding Document v2** (the charter — the *why*), the **v1 Implementation
Spec** (the backend — the *how*), and the **v1 Frontend Spec** (the client). It is two coupled
pieces:

- **Backend** — a NestJS **modular monolith** (this repo root) on the real Casabio stack:
  CouchDB+PouchDB, PostgreSQL, Elastic, Redis, Swift/MinIO, Keycloak.
- **Frontend** — a React + TypeScript client ([`frontend/`](frontend/)) wired to the live backend.

## What's the idea

JOSE's unit is not "the paper" — it's the **knowledge object**: a claim, treatment, specimen,
observation, map, dataset, review, or correction, each citable, attributable, versioned, and
connected. The keystone is a **git-inspired moving snapshot**: immutable, content-addressed
versions + a moving living tip + DOIs as tags on frozen Versions of Record. Underneath runs **total
provenance** (nothing unattributed) and an **ethics-in-architecture** locality engine that keeps
sensitive sites out of public data while still serving evidence.

## Status

| Layer | Built | Verified |
|---|---|---|
| **Backend** — 15 modules, the §5 versioning core, the §6 locality policy engine | ✅ | 101 tests (unit + flagship e2e); all §9 acceptance criteria; live stack end-to-end |
| **Frontend** — 9 screens (Reader, Builder, Review, Distribution Map, Capture, Discovery, Profile, Lightbox, Snippet Viewer) | ✅ | Playwright render smoke against the live API; all §11 acceptance behaviours |

The whole thing runs end-to-end: a real flagship treatment (a *Mesembryanthemum* from the
Knersvlakte) flows from observation → QDS map → evidence → correction (new version) → transparent
review with dispositions → micro-observation citation → DOI-bearing Version of Record, all on real
infrastructure.

## Architecture (§2, §24)

```
Clients (React web · React Native + PouchDB field app)
   │ HTTPS REST/OpenAPI            │ Couch replication (PUBLIC projections only)
   ▼                              ▼
NestJS modular monolith  ── THE TRUST BOUNDARY ──
   Auth · KnowledgeObject · Versioning · Provenance · Taxonomy · Observation
   Locality(PolicyEngine) · Review · Citation · IdentityTrust · Media · Federation
   Export · Authoring · Search
   │        │         │          │           │
 Couch   Postgres  Elastic     Redis      Swift/MinIO
 content control-  index-only  queues/    content-addressed
 +public  plane               cache       media masters
 proj.    (ACID)
```

**Data-plane authority.** Couch owns content versions, drafts, and public QDS projections. Postgres
owns every scholarly/legal state transition (releases, DOIs, consent, access grants, the
append-only audit ledger, the TDWG concept model, identity/trust). Elastic is index-only. Swift
holds content-addressed media masters (hash, never path). *If losing it would corrupt the scholarly
or legal record, it lives in Postgres or as a content-addressed immutable object.*

**Two load-bearing pieces.** The **versioning core** (`src/modules/versioning`) implements git
semantics explicitly over Couch — a version's identity is `sha256(JCS(content) ‖ JCS(meta))`, not
Couch `_rev`. The **locality policy engine** (`src/modules/locality`) splits every sensitive object
into a QDS-only public projection (replicable) and a restricted precise record (Postgres, never
replicated); precise disclosure is server-mediated, object-specific, purpose-bound, time-limited,
logged, and revocable.

## Repository layout

```
src/                  NestJS modular monolith (15 modules + core + persistence ports/adapters)
db/migrations/        Postgres control-plane DDL (§3.4–3.8)
keycloak/             realm import (roles, ORCID OIDC slot)
scripts/              migrate · init-stack · seed-flagship · live-smoke
docker-compose.yml    the live stack: couch · postgres · elastic · redis · minio · keycloak
frontend/             React + TypeScript client (Vite) — 9 screens, wired to the live API
test/                 the three specs, design prototypes, and the flagship e2e
```

## Quick start

### Deterministic, service-free (all acceptance criteria, no Docker)

```bash
npm install
npm test                 # 99 unit specs + the flagship e2e (in-memory adapters)
npm run build            # tsc + tsc-alias → dist/
```

### The live stack (real Casabio components)

```bash
docker compose up -d                          # couch · postgres · elastic · redis · minio · keycloak
PERSISTENCE=live npm run db:migrate           # apply db/migrations/*.sql
PERSISTENCE=live npm run stack:init           # create Couch DBs, Elastic indices, MinIO bucket
PERSISTENCE=live node dist/main.js            # :3000 · Swagger at /api
node scripts/seed-flagship.mjs                # seed a real flagship treatment

cd frontend && npm install && npm run dev     # the client (sign in via the dev switcher)
```

> **Note:** the toolchain uses the project's own `tsc`/`jest` binaries directly (RTK proxy aside),
> TypeScript is pinned to 5.6.x (baseUrl), and the frontend uses relative imports (Windows path
> casing). See `CLAUDE`-style notes in the build scripts.

## The acceptance gate

"Done" for the backend is every criterion in the Implementation Spec §9 passing in CI **plus** one
real flagship treatment exercised end to end. For the frontend it is the Frontend Spec §11
behaviours. Both are met. See `src/modules/**/​*.spec.ts`, `test/flagship.e2e-spec.ts`, and
`frontend/README.md` for the mapping.

## License

GNU AG-3.0 (see [`LICENSE`](LICENSE)) — the scholarly record stays free to read and publish (Diamond
OA), and the platform itself is open.
