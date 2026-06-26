# JOSE v1 — Frontend

The client layer, built from the **JOSE v1 Frontend Specification**. React + TypeScript + Vite,
wired to the live NestJS backend (`../`). Implements the design language (§3), the lens
interaction model (§4), all nine screens (§5), and the acceptance criteria (§11).

## Run

```bash
# 1. Backend live on :3000 (see ../README.md): docker compose up -d, migrate, PERSISTENCE=live node dist/main.js
# 2. Seed a real flagship treatment so the Reader opens on real data:
node ../scripts/seed-flagship.mjs        # writes public/seed.json

npm install
npm run dev          # http://localhost:5173 (auto-bumps if taken; this session used :5280)
npm run build        # tsc + vite build → dist/ (production)
npm run typecheck
```

Sign in with the shell's **dev sign-in** (bottom-left): pick an actor (R. Botha / A. Klak /
J. Smith / Guest). This mints an HS256 dev token the backend accepts (`AUTH_DEV_MODE`).

## Architecture (Frontend Spec §2)

- **`src/core/`** — the shared core (`@jose/core` equivalent):
  - `api/` — `endpoints.ts` (the typed API surface; every screen calls these, never raw fetch),
    `client.ts` (token + fetch), `types.ts` (domain DTOs), `openapi.d.ts` (generated from the
    backend OpenAPI: `npm run gen:api`).
  - `lens/lens-url.ts` — lens state ⇄ URL query (shareable composed views, AC 11.1).
  - `auth/auth.tsx` — dev-login + principal (authority is always server-side).
  - `query/queryClient.ts` — TanStack Query (cache keyed by entity+version+lens).
  - `offline/offline.ts` — PouchDB replication of **public projections only** (no client path
    renders sub-QDS coordinates; AC 11.5), `useOnline()`.
  - `seed.ts` — the demo entry point.
- **`src/styles/`** — `tokens.css` (§3 palette/type + a11y floor) + `jose.css` (the shared
  component vocabulary). `--type-red` only marks provenance/type/annotation/evidence.
- **`src/components/`** — `lens/LensBar`, `shell/AppShell`, plus per-screen component dirs.
- **`src/screens/`** — Reader, DistributionMap, Builder, ReviewPanel, Capture, Discovery,
  Profile, Lightbox, SnippetViewer, Home, DoiResolver.

Routing reflects the three-identifier model (§2): `/ko/:koId` (entity→tip), `/ko/:koId/v/:verId`
(immutable, never client-redirects), `/doi/:doi` (→ VoR version). Lens state lives in `?…`.

> **Note on path aliases:** this repo uses **relative imports** throughout. The Windows project
> path casing (`C:/Foo/Jose`) breaks Vite's `@core` alias resolver, so aliases are avoided.

## Screens → spec & acceptance

| Screen | Spec | Wires to | AC |
|---|---|---|---|
| **Reader** + Lens Bar | §5.1, §4 | `/ko/:id`, `/history`, `/reviews`, `/provenance`, `/snippets` | 11.1–11.4 |
| **Distribution Map** | §5.2, §5.6 (precise) | `/map/:id`, `/observations/:id/decision`, `/localities/:id/precise` | 11.5 |
| **Builder** | §5.3 | `/ko` POST, `/draft`, `/amend`, `/ai-declaration`, `/export` | 11.7 |
| **Review Panel** | §5.4 | `/reviews`, `/review`, `/reply`, `/coauthors`, `/release` | 11.6 |
| **Capture** | §5.5 | `/observations` (offline-first) | 11.5 |
| **Snippet Viewer** | §5.6 | `/snippets/:id` (drift-aware) | 11.4 |
| **Discovery** | §5.7 | `/search` (type×status×tier, not a feed) | — |
| **Profile** | §5.8 | `/identity/records`, `/certification/*` | — |
| **JXL Lightbox** | §5.9 | `/media/:id` (verification zoom free) | 11.8 |

Verified end-to-end against the live backend with Playwright (`smoke-fe.mjs`, `smoke-screens.mjs`):
all screens render real data, 0 page errors; AC 11.1 (lens→URL) confirmed.

## Known v1 limitations

- **Offline** is best-effort: PouchDB replicates public projections (Couch CORS enabled); the
  full sync-conflict "keep yours / take theirs / compare" UI (§8) is scaffolded, not finished.
- A treatment's **Distribution map** shows only observations whose `ko` equals that treatment;
  seeded micro-observations live on their own micro-obs KOs (a backend data-model nuance).
- **JXL/IIIF** are descriptor-level (the backend has no image codec in v1); the Lightbox proves
  the free-verification-zoom policy, not a real decoder.
- `/doi/:doi` resolves the seeded DOI locally (no reverse-lookup endpoint yet).
- Language lens is wired (`?lang=`) but `en`-only ships.
