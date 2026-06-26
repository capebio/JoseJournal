# JOSE — v1 Implementation Specification

*Companion to the **JOSE Guiding Document v2** (the "why" and "what"). This document is the "how": the buildable engineering plan for v1. Audience: the Casabio engineering team (primary: Alex Franz). Status: draft for build sign-off and pushback. Where a decision is genuinely unresolved it is marked **OPEN**, with a note on whether it blocks v1.*

*Scope chosen: **Wider v1** — all thesis-provers ship in the first release. Prescriptiveness: **full** — schemas, APIs, acceptance criteria.*

---

## 0. How to read this document

- **Schemas** are given as JSON (Couch documents / JSON-LD envelopes), TypeScript interfaces (shared types in the Nest codebase), and SQL DDL (the Postgres control plane). They are illustrative-but-precise: field names and relationships are intended to be built as written, refined only where implementation reveals a genuine problem.
- **APIs** are NestJS REST endpoints exposed via Swagger/OpenAPI. Only v1 endpoints are listed.
- **Acceptance criteria** are testable Given/When/Then statements. "Done" for v1 means every criterion in §9 passes in CI plus one real flagship treatment exercised end to end.
- Anything not in §1's in-scope list is explicitly deferred. Don't build it in v1.

---

## 1. v1 Scope

### In scope (the wider v1 — all thesis-provers + their load-bearing spine)

**Spine (build first, everything depends on it):**
1. Knowledge-object model + lens abstraction (English-only content, but all five lenses present in the data model).
2. Explicit git-like versioning over CouchDB (immutable content-addressed versions + moving tip + dated history + fork). **Prototype spike gates the rest (§5).**
3. Identity: account vs identity record, Keycloak SSO, ORCID federation, assurance ladder.
4. Total-provenance attribution, with tiered disclosure classification.
5. The trust boundary + the locality policy engine / tiered replication (§6).
6. Postgres narrow control plane (releases, consent, DOIs, access grants, audit ledger, policy).

**Thesis-provers:**
7. Micro-observations as citable knowledge objects with DOIs, living in the graph, linked to Casabio observations and the QDS map.
8. A living treatment that visibly accretes, over the TDWG concept model (Name ≠ Taxon).
9. Snippet/passage citation within the JOSE corpus, with hardened anchoring + the three-identifier model.
10. Transparent review: open reviewer identity, Reviewer Disposition status, co-author consent.
11. The paper-builder (concept → WIP → publish) with recorded AI provenance declaration.
12. Commons / Journal tiers.
13. Media: JXL delivery derivative + source-preserving master, IIIF deep zoom, verification-resolution-always-free.

### Deferred (do NOT build in v1)
BioBucks/CasaBucks and any payments; gamification/trust-score leaderboards (the trust *metric* exists as data; public leaderboards do not); full multilingual corpus (translation-state infrastructure is present, but English is the only publication language); the full parser zoo beyond md/html/docx; native gene-tree *rendering* (the concept model and sequence linkage exist; interactive phylo rendering is fast-follow); complex public fork/merge UX (fork is supported in the model; rich merge tooling is later); subscription-tiered convenience zoom (verification zoom is free in v1; the *tiered* convenience layer is later).

### Flagship proving case
One real treatment (a genuine taxon, e.g. from the Mesembryanthemum complex given the team's expertise) exercised end to end: real observations, a QDS map, evidence, at least one correction producing a new version, a reviewer exchange with dispositions, a micro-observation cited by the treatment, and a DOI-bearing Version of Record. This is the v1 acceptance gate, not a synthetic demo.

---

## 2. Architecture Context

A **modular monolith** (NestJS), deployed into the existing Casabio Kubernetes/OpenStack cluster. One deployable, internally partitioned into modules (§8) with clean interfaces so any module can later be extracted.

```
┌─────────────────────────────────────────────────────────────┐
│ Clients                                                       │
│  Web (React)            Field App (React Native + PouchDB)     │
└───────────────┬───────────────────────────┬──────────────────┘
                │ HTTPS (REST/OpenAPI)        │ Couch replication
                │                             │ (PUBLIC projections only)
┌───────────────▼─────────────────────────────▼──────────────────┐
│ NestJS Modular Monolith  (THE TRUST BOUNDARY)                  │
│  Auth · KnowledgeObject · Versioning · Provenance · Taxonomy   │
│  Observation · Locality(PolicyEngine) · Review · Citation      │
│  Identity/Trust · Media · Federation · Export                  │
└───┬──────────┬───────────┬────────────┬───────────┬───────────┘
    │          │           │            │           │
┌───▼───┐ ┌────▼────┐ ┌────▼─────┐ ┌────▼────┐ ┌────▼─────────┐
│Couch  │ │Postgres │ │ Elastic  │ │ Redis   │ │ Swift (S3)   │
│+Pouch │ │(control │ │(index    │ │(queues, │ │ content-     │
│content│ │ plane)  │ │ only)    │ │ cache)  │ │ addressed    │
│drafts │ │ ACID    │ │          │ │         │ │ media masters│
│public │ │ ledger  │ │          │ │         │ │              │
│proj.  │ │ policy  │ │          │ │         │ │              │
└───────┘ └─────────┘ └──────────┘ └─────────┘ └──────────────┘
```

### Data-plane authority (which store owns what)

| Store | Owns (authoritative) | Never |
|---|---|---|
| **CouchDB** | KO content versions, drafts, public QDS projections, offline-syncable docs | scholarly/legal state transitions; precise localities in public DBs |
| **PostgreSQL** | releases & VoR transitions, DOI registry, co-author consent, access grants, policy decisions, audit ledger, identity/trust, TDWG concept model | large content bodies; binary media |
| **Elastic** | search/index of public (and separately, restricted) projections | being a source of truth — index only, rebuildable |
| **Redis** | job queues (transcode/parse/transcript), caches, ephemeral locks | durable state |
| **Swift** | content-addressed media masters + derivatives | path-based references (always hash-addressed) |

**Rule:** if losing it would corrupt the scholarly or legal record, it lives in Postgres or as a content-addressed immutable object — never solely in an eventually-consistent replicated Couch doc.

### Trust boundary
The browser/field client may replicate **public projections** directly (offline-first). Everything that mints, releases, discloses precise data, records consent, or moves money is **server-authoritative** in NestJS. See §6.

### ID conventions
ULID-based, prefixed, stable: `ko:` knowledge object (entity), `ver:` version (value = `sha256-<hex>`), `ref:` branch/tip pointer, `blk:` content block, `claim:` claim, `prov:` provenance event, `acct:` account, `idrec:` identity record, `name:` nomenclatural name, `concept:` taxon concept, `assert:` assertion, `obs:` observation, `doi:` DOI, `grant:` access grant. Prefixes are part of the stored id.

---

## 3. Core Data Model

### 3.1 Knowledge Object — Entity, Version, Ref

Three separate documents. The **Entity** is stable identity + moving pointers. **Versions** are immutable and content-addressed. **Refs** are mutable pointers (tip, VoR, branches).

**Entity** (CouchDB, mutable pointers only):
```jsonc
{
  "@context": "https://jose.org/ns/v1",
  "@type": "KnowledgeObject",
  "_id": "ko:01JABC...",
  "koType": "treatment",        // treatment|micro-observation|dataset|report|article|review|method|comment|synthesis
  "tier": "journal",            // commons | journal
  "createdAt": "2026-06-23T10:00:00Z",
  "refs": {
    "tip": "ver:sha256-9f2a...",     // current living tip (main branch)
    "vor": "ver:sha256-1c4d...",     // current Version of Record (nullable)
    "branches": { "main": "ver:sha256-9f2a...", "fork:ko:01JXYZ": "ver:sha256-77b0..." }
  },
  "conceptRef": "concept:01J...",    // for treatments: the taxon concept asserted (nullable)
  "subjectRefs": ["obs:01J..."]      // for micro-observations: source observation(s)
}
```

**Version** (CouchDB, immutable; `_id` IS the content hash):
```jsonc
{
  "@type": "Version",
  "_id": "ver:sha256-9f2a...",   // = sha256 over canonicalised `content` + `meta` (excludes _id, _rev)
  "ko": "ko:01JABC...",
  "parent": "ver:sha256-1c4d...", // DAG parent (nullable for first)
  "branch": "main",
  "createdAt": "2026-06-23",      // human-legible date is mandatory (YYYY-MM-DD)
  "authors": ["acct:01J...", "idrec:01J..."],
  "status": "vor",               // raw|verified|reviewed|vor|superseded|retracted
  "visibility": "public",        // private|collaborators|public
  "lenses": {                    // lens metadata present even when single-valued in v1
    "language": "en",
    "depthVariants": ["surface", "verbose"],
    "register": "academic"
  },
  "content": { /* §3.2 */ },
  "provenanceRefs": ["prov:01J..."],
  "doi": null,                   // set only when status=vor
  "contentHash": "sha256-9f2a..." // redundant copy of the hash for integrity checks
}
```

**Hashing rule:** `contentHash = sha256( JCS(content) || JCS(meta) )` where `meta` = `{ko, parent, branch, authors, status, visibility, lenses}` and `JCS` is RFC 8785 JSON Canonicalization. `_rev` and `_id` are excluded. This makes a version's identity independent of CouchDB's own revision/compaction (§5 explains why Couch `_rev` must NOT be the version identity).

**TypeScript shared types:**
```ts
type KoType = 'treatment'|'micro-observation'|'dataset'|'report'|'article'|'review'|'method'|'comment'|'synthesis';
type Tier = 'commons'|'journal';
type VersionStatus = 'raw'|'verified'|'reviewed'|'vor'|'superseded'|'retracted';
type Visibility = 'private'|'collaborators'|'public';
type Disclosure = 'public'|'embargoed'|'restricted'|'sealed'|'legally-suppressed'|'anonymised-but-auditable';

interface VersionMeta {
  ko: string; parent: string|null; branch: string;
  authors: string[]; status: VersionStatus; visibility: Visibility;
  lenses: { language: string; depthVariants: ('surface'|'verbose')[]; register: 'academic'|'popular' };
}
```

### 3.2 Content & Blocks (snippet-anchorable)

Content is a tree of sections → blocks. Every block has a **stable block id** that survives re-rendering (the anchor for snippet citation). Claims are first-class and link to evidence.

```jsonc
"content": {
  "title": "…",
  "sections": [
    {
      "path": "description",            // stable section path (slug)
      "blocks": [
        {
          "blockId": "blk:01J...",      // stable across amendments; new block = new id
          "type": "paragraph",          // paragraph|figure|table|caption|verbose|claim-block
          "text": "Leaves opposite, …",
          "claims": ["claim:01J..."],
          "captions": { "surface": "Fig 1. Habit.", "verbose": "Fig 1. Habit, showing …" }
        }
      ]
    }
  ],
  "claims": {
    "claim:01J...": {
      "statement": "Bat-pollinated.",
      "evidence": ["obs:01J...", "ver:sha256-…#blk:…", "seq:GenBank:MN…"],
      "confidence": "author-asserted"   // NOT a numeric truth score
    }
  }
}
```

### 3.3 Type × Status × Visibility, and Tier

- **Type** (`koType`) and **Status** (`VersionStatus`) are orthogonal; both filterable in search.
- **Visibility** governs replication and read access (private drafts never enter public projections).
- **Tier** (`commons`|`journal`) on the Entity: Commons = integrity/legality gate only; Journal = reviewed, DOI-bearing VoR. A Commons KO graduates to Journal by acquiring a `vor` ref through review (§3.10); a Journal KO may spawn Commons extensions/corrections.

### 3.4 Provenance Event (with tiered disclosure)

Append-only. Stored in Postgres (authoritative ledger, §3.8) and projected to Couch only where `disclosure='public'`.

```sql
CREATE TABLE provenance_event (
  id            TEXT PRIMARY KEY,              -- prov:...
  subject_ref   TEXT NOT NULL,                 -- ver:… | blk:… | claim:… | ko:…
  actor_ref     TEXT NOT NULL,                 -- acct:… | idrec:… | ai:<model>
  actor_role    TEXT NOT NULL CHECK (actor_role IN
                  ('author','contributor','reviewer','steward','editor','ai','system')),
  action        TEXT NOT NULL,                 -- created|amended|reviewed|translated|
                                               -- ai-generated|ai-edited|released|retracted|disclosed|…
  ts            TIMESTAMPTZ NOT NULL DEFAULT now(),
  disclosure    TEXT NOT NULL DEFAULT 'public' CHECK (disclosure IN
                  ('public','embargoed','restricted','sealed','legally-suppressed','anonymised-but-auditable')),
  detail        JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX ON provenance_event (subject_ref);
CREATE INDEX ON provenance_event (actor_ref) WHERE disclosure = 'public';
```

**Principle enforced in code:** provenance is *always recorded completely*; the `disclosure` field governs whether it surfaces publicly. The public Couch projection of any object includes only `disclosure='public'` events. The full record is queryable only through audited server endpoints under authorisation.

### 3.5 TDWG Concept Model (Name ≠ Taxon)

Relational, in Postgres; treatments reference concepts by id, concepts reference the asserting treatment *version*.

```sql
CREATE TABLE nom_name (
  id            TEXT PRIMARY KEY,              -- name:...
  name_string   TEXT NOT NULL,
  authorship    TEXT,
  rank          TEXT,
  code          TEXT CHECK (code IN ('ICN','ICZN','ICNP','other')),
  nom_status    TEXT,                          -- valid|invalid|illegitimate|synonym|…
  registration  JSONB                          -- {zoobank|ipni: id}
);

CREATE TABLE taxon_concept (
  id              TEXT PRIMARY KEY,            -- concept:...
  name_id         TEXT NOT NULL REFERENCES nom_name(id),
  sec_version     TEXT NOT NULL,               -- ver:… of the Treatment asserting this concept ("sec.")
  circumscription JSONB,                       -- included/excluded taxa, diagnostic notes
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE assertion (
  id            TEXT PRIMARY KEY,              -- assert:...
  concept_id    TEXT NOT NULL REFERENCES taxon_concept(id),
  subject_ref   TEXT NOT NULL,                 -- obs:… | specimen:… | ver:…
  evidence_refs TEXT[] NOT NULL DEFAULT '{}',
  asserted_by   TEXT NOT NULL,                 -- acct:… | idrec:…
  ts            TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE nomenclatural_act (
  id            TEXT PRIMARY KEY,
  name_id       TEXT NOT NULL REFERENCES nom_name(id),
  act_type      TEXT NOT NULL,                 -- new_combination|synonymy|lectotypification|…
  code          TEXT NOT NULL,
  governing_decision TEXT,                     -- committee/code reference
  vor_version   TEXT,                          -- ver:… the valid protologue (OPEN until reg. mechanism solid)
  ts            TIMESTAMPTZ DEFAULT now()
);
```

This lets competing concepts on the same name coexist (`Mesembryanthemum` s.l. *sec.* Klak vs *sec.* dissenting treatment) as parallel `taxon_concept` rows, each tied to its treatment version. Tree-of-Life navigation and (later) gene-tree rendering operate over `taxon_concept`, never bare `nom_name`.

### 3.6 Identity, Assurance, Trust

```sql
CREATE TABLE account (
  id            TEXT PRIMARY KEY,              -- acct:...  (mirrors Keycloak subject)
  keycloak_sub  TEXT UNIQUE NOT NULL,
  orcid         TEXT UNIQUE,
  display_name  TEXT NOT NULL,
  assurance     TEXT NOT NULL DEFAULT 'unverified'
                  CHECK (assurance IN ('unverified','verified','certified')),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE identity_record (        -- referenceable entity nobody logs into (e.g. deceased authors)
  id            TEXT PRIMARY KEY,              -- idrec:...
  display_name  TEXT NOT NULL,
  external_ids  JSONB,                         -- {ipni, botanist_abbrev, bionomia, viaf, isni, wikidata}
  curated_by    TEXT REFERENCES account(id),
  claimed_by    TEXT REFERENCES account(id)    -- if a living person later claims the record
);

CREATE TABLE certification (
  id            TEXT PRIMARY KEY,
  account_id    TEXT NOT NULL REFERENCES account(id),
  vouched_by    TEXT[] NOT NULL,               -- acct:… (diverse, weighted by voucher trust)
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','granted','revoked')),
  scope         JSONB,                         -- what precise-data classes this unlocks (still policy-gated)
  ts            TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE trust_event (            -- the metric is event-sourced; deeds weighted over connections
  id            BIGSERIAL PRIMARY KEY,
  account_id    TEXT NOT NULL REFERENCES account(id),
  kind          TEXT NOT NULL,                 -- contribution|review|correction|endorsement|integrity_breach
  weight        NUMERIC NOT NULL,
  basis_ref     TEXT,                          -- the object that justifies it
  ts            TIMESTAMPTZ DEFAULT now()
);
```
v1 records `trust_event`s and computes a private score; **no public leaderboard** (deferred). Trust only ever decreases on `integrity_breach`, never on disagreement (enforced: no `trust_event` may be created with `kind='disagreement'`).

### 3.7 Observations & Localities (public projection vs restricted precise)

Every sensitive object is **split at write time** into a public projection and a restricted record. The browser only ever replicates the public projection.

```jsonc
// PUBLIC projection (CouchDB public DB — replicates to any client)
{
  "_id": "obs:01J...:public",
  "@type": "ObservationPublic",
  "ko": "ko:01J...",
  "taxon": "concept:01J...",
  "localityQDS": "2318CA",          // QDS code only (~20x20km) — NEVER finer here
  "geometryGeneralised": { "type": "Polygon", "coordinates": [ /* QDS cell */ ] },
  "source": { "system": "casabio", "id": "casabio:obs:..." },
  "media": ["media:01J..."],         // derivatives are EXIF-stripped (§6 checklist)
  "verification": "verified"
}
```
```sql
-- RESTRICTED precise record (Postgres, server-mediated only; NEVER in a replicating Couch DB)
CREATE TABLE locality_precise (
  obs_id        TEXT PRIMARY KEY,              -- obs:...
  lat           NUMERIC NOT NULL,
  lon           NUMERIC NOT NULL,
  uncertainty_m INTEGER,
  sensitivity   TEXT NOT NULL,                 -- normal|sensitive|highly-sensitive
  source        JSONB
);
```

### 3.8 Control Plane (Postgres, ACID + append-only ledger)

```sql
CREATE TABLE release (
  id            TEXT PRIMARY KEY,
  ko_id         TEXT NOT NULL,
  version_id    TEXT NOT NULL,                 -- ver:… being released
  tier          TEXT NOT NULL CHECK (tier IN ('commons','journal')),
  doi           TEXT,                          -- set for journal VoR
  released_by   TEXT NOT NULL REFERENCES account(id),
  released_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE doi_registry (
  doi           TEXT PRIMARY KEY,
  version_id    TEXT NOT NULL,                 -- immutable target (a VoR)
  ko_id         TEXT NOT NULL,
  agency        TEXT NOT NULL DEFAULT 'datacite',
  minted_at     TIMESTAMPTZ DEFAULT now(),
  metadata      JSONB
);

CREATE TABLE coauthor_consent (
  id            TEXT PRIMARY KEY,
  ko_id         TEXT NOT NULL,
  candidate     TEXT NOT NULL,                 -- acct:… | idrec:…
  state         TEXT NOT NULL DEFAULT 'named-unconfirmed'
                  CHECK (state IN ('named-unconfirmed','confirmed','declined','negotiating')),
  requested_at  TIMESTAMPTZ DEFAULT now(),
  deadline      TIMESTAMPTZ,
  resolved_at   TIMESTAMPTZ
);

CREATE TABLE access_grant (           -- locality policy engine grants
  id            TEXT PRIMARY KEY,              -- grant:...
  grantee       TEXT NOT NULL REFERENCES account(id),
  object_ref    TEXT NOT NULL,                 -- obs:… (object-specific)
  purpose       TEXT NOT NULL,                 -- purpose-bound (free text + category)
  granted_by    TEXT NOT NULL,
  granted_at    TIMESTAMPTZ DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,          -- time-limited (mandatory)
  revoked_at    TIMESTAMPTZ,                   -- revocable
  offline_pkg   BOOLEAN NOT NULL DEFAULT false -- exceptional; requires extra justification
);

CREATE TABLE audit_ledger (           -- append-only; every sensitive action
  id            BIGSERIAL PRIMARY KEY,
  ts            TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_ref     TEXT NOT NULL,
  action        TEXT NOT NULL,
  object_ref    TEXT,
  disclosure    TEXT NOT NULL DEFAULT 'restricted',
  detail        JSONB NOT NULL DEFAULT '{}'
);
-- audit_ledger is INSERT-only; no UPDATE/DELETE grants in the DB role.
```

### 3.9 Citation — Three Identifiers + Snippet Anchor

```ts
// Three identifiers per knowledge object
// 1. Entity URL : /ko/:koId            -> resolves to current tip; navigation/discovery only
// 2. Version URL: /ko/:koId/v/:verId   -> immutable forever; the scholarly anchor
// 3. DOI        : resolves to the Version URL of a VoR; immutable forever

interface SnippetAnchor {
  versionId: string;     // ver:… (immutable — anchors NEVER point at an entity)
  sectionPath: string;   // e.g. "description"
  blockId: string;       // blk:… (stable across amendments)
  quotedText: string;    // the cited text, stored verbatim
  contentHash: string;   // sha256 of the block at cite time (detects later drift)
}
```
**Rule (enforced):** DOIs and Version URLs never redirect. The entity URL resolves to the tip and renders a "newer version exists / you may have been given an older link" relationship banner when reached via an older version. Snippet anchors resolve against the immutable `versionId`; if `contentHash` no longer matches the live block, the UI shows "the cited text was amended in a later version" and offers both states.

### 3.10 Review — Disposition + Co-author Consent

```ts
type ReviewerDisposition =
  | 'green'   // seen and incorporated
  | 'yellow'  // not seen
  | 'orange'  // seen, not incorporated   (author right-of-reply)
  | 'red';    // disagree with reviewer   (author right-of-reply)

interface ReviewThread {
  id: string;
  koId: string;
  reviewer: string;             // acct:… (open identity; ORCID + credential summary surfaced)
  relevanceScore?: number;      // AI-assessed reviewer↔subject relevance (advisory)
  disposition: ReviewerDisposition;
  comment: string;
  authorReply?: string;         // required to exist for orange/red before release
  ts: string;
}
```
Review is **continuous from submission**. Authors nominate reviewers (v1: nomination is direct; the **editor-confirmation step is OPEN** — see §12). Reviewer identity and disposition are public; reviewer comments are a distinguished category, separate from general inline comments.

---

## 4. The Lens Layer

Lenses are **read-time projections** over a single canonical version, not stored variants (except where genuinely different content exists, e.g. a verbose caption). v1 implements the lens *interface* with these axes live:

- **version** — fully live (the versioning core).
- **depth** — surface/verbose for captions and director's-cut blocks (present where authored).
- **register** — academic/popular tagging on comments; popular-footprint links.
- **annotation** — comments/reviewer-layer/provenance overlay toggles.
- **language** — `en` only in v1, but the field and resolution path exist so adding languages is additive, not structural.

A lens request is expressed as query params on the read endpoints (§7): `?version=…&depth=verbose&annotations=reviewer,provenance`.

---

## 5. The Versioning Core (build + spike first)

**Why not Couch `_rev`:** CouchDB compacts old `_rev`s and they are not content-addressed; they cannot be the permanent, citable version identity. We implement git semantics explicitly *over* Couch.

**Operations:**
- `commit(ko, content, meta) -> ver`: canonicalise, hash, write immutable Version doc whose `_id` is the hash; update Entity `refs.tip` (and branch pointer). Idempotent: committing identical content yields the same `ver` (natural dedup).
- `branch(ko, fromVer, name) -> ref`: add a branch pointer.
- `fork(ko, fromVer) -> newKo`: create a new Entity whose first Version has `parent = fromVer` and records lineage in provenance.
- `tagVoR(ko, ver) -> release`: server-authoritative. Sets Version `status='vor'`, mints DOI (§3.8), writes `release` + `doi_registry` rows in one Postgres transaction, emits provenance `released`.
- `amend(ko, baseVer, changes, actorRole) -> ver`: produces a new Version (or a visible overlay for trivial fixes) per the authority matrix (§ guiding doc 15). Never mutates an existing Version doc.

**Couch/Postgres interaction:** content versions live in Couch; the *fact and authority* of a release/VoR/DOI live in Postgres. The tip pointer is in Couch (fast, replicable); the immutable release record is in Postgres (ACID, audited). On conflict, Postgres is authoritative for "what is released."

**Spike (gates everything):** a thin prototype proving, over the real Couch+Postgres: (a) immutable content-addressed versions survive Couch compaction; (b) tip moves; (c) fork creates lineage; (d) a VoR tag is transactional and its Version URL + DOI resolve byte-identically after the tip advances. **Do not build modules 7–13 until the spike passes its acceptance criteria (§9.1).**

---

## 6. Tiered Replication & Locality Policy Engine (the hard piece)

This is the component most likely to leak if rushed. Build it early, alongside the spine.

**Write path (split at ingest):** when an observation/treatment with locality enters, the server writes (1) a **public projection** (QDS only, EXIF-stripped media derivatives) to the public Couch DB, and (2) the **precise record** to `locality_precise` (Postgres, never replicated).

**Read path for precise data:** server-mediated only. A request for precise coordinates hits the **policy engine**, which evaluates:
```
allow(precise) IFF
  requester.assurance == 'certified'
  AND exists active access_grant(grantee=requester, object_ref=obs, now < expires_at, revoked_at IS NULL)
  AND grant.purpose matches request.purpose
  AND object.sensitivity policy satisfied
  → then: serve precise, write audit_ledger(action='disclosed', object_ref=obs)
```
Certification alone never suffices; a per-object, purpose-bound, time-limited, revocable `access_grant` is required.

**Offline precise access** is exceptional: only via an explicit encrypted, time-bound, purpose-stamped package (`access_grant.offline_pkg=true`) under documented justification, because raw coordinates on a client cannot be recalled. Not a consequence of any role.

**Indirect-leakage checklist (each is a test in §9.5):** EXIF/embedded metadata stripped from all public media derivatives; free-text captions/locality descriptions scanned for coordinates; snippet citations cannot quote precise coordinates from restricted blocks; AI-companion answers run through the same policy engine before returning locality; IIIF tile boundaries / deep-zoom regions do not encode precise location; QDS-intersection queries cannot triangulate a finer point; cached search results and derived raster/vector tiles carry only public projections; CSV/data exports apply the policy engine per-row.

---

## 7. API Surface (NestJS REST / OpenAPI)

All endpoints behind Keycloak-issued JWT; guards enforce assurance/role. `→` shows the primary success response. Lens params apply to all GET-of-content endpoints.

### Knowledge objects & versioning
| Method | Path | Purpose | Auth |
|---|---|---|---|
| POST | `/ko` | create KO (draft, private) | verified |
| GET | `/ko/:koId` | entity → current tip (+banner meta) | per-visibility |
| GET | `/ko/:koId/v/:verId` | immutable version | per-visibility |
| GET | `/ko/:koId/history` | dated version DAG | per-visibility |
| POST | `/ko/:koId/amend` | amend → new version/overlay (authority-matrix checked) | role-based |
| POST | `/ko/:koId/fork` | fork → new KO with lineage | verified |
| POST | `/ko/:koId/release` | release (commons) / tag VoR + mint DOI (journal) | author-maintainer/editor |
| POST | `/ko/:koId/retract` | retract a version (propagation = OPEN, §12) | editor |

### Provenance
| GET | `/ko/:koId/provenance` | public provenance events | public |
| GET | `/audit/provenance?subject=…` | full record incl. non-public | audited/authorised |

### Taxonomy (TDWG)
| POST | `/names` · `/concepts` · `/assertions` | create name/concept/assertion | verified |
| GET | `/concepts/:id` | concept incl. `sec` treatment version | public |
| GET | `/names/:id/concepts` | all competing concepts on a name | public |

### Observations & localities
| POST | `/observations` | ingest micro-observation (auto-split public/precise) | verified |
| POST | `/observations/:id/decision` | accept/reject (reject requires comment) | author-maintainer |
| GET | `/map/:koId` | QDS distribution (public projection) | public |
| POST | `/localities/:obsId/access` | request precise access (policy engine) | certified |
| GET | `/localities/:obsId/precise` | serve precise IFF active grant (audited) | certified+grant |

### Review
| POST | `/ko/:koId/reviewers` | nominate reviewer | author-maintainer |
| POST | `/ko/:koId/review` | submit disposition + comment | reviewer |
| POST | `/ko/:koId/review/:threadId/reply` | author right-of-reply (orange/red) | author-maintainer |
| POST | `/ko/:koId/coauthors` | request co-author (named-unconfirmed) | author-maintainer |
| POST | `/ko/:koId/coauthors/:id/respond` | confirm/decline/negotiate | candidate |

### Citation
| GET | `/cite/:koId?as=version\|doi\|entity` | citation metadata + correct identifier | public |
| POST | `/snippets` | create snippet anchor | verified |
| GET | `/snippets/:id` | resolve snippet (entire ↔ snippet; drift-aware) | per-visibility |

### Authoring (paper-builder)
| PUT | `/ko/:koId/draft` | autosave draft content | author |
| POST | `/ko/:koId/ai-declaration` | record AI provenance declaration (coverage/role/model/human) | author |
| GET | `/ko/:koId/export?format=md\|docx\|jats\|json` | frictionless export at any stage | author |

### Media
| POST | `/media` | upload master → Swift (hash-addressed); enqueue JXL+IIIF derivs | verified |
| GET | `/media/:id?res=…` | serve derivative; verification-resolution always free | public |

### Identity
| POST | `/identity/records` | create/curate identity record (e.g. deceased author) | verified |
| POST | `/certification/apply` · `/certification/:id/vouch` | assurance ladder | verified |

---

## 8. Module Breakdown (Nest)

`AuthModule` (Keycloak guard, role/assurance decorators) · `KnowledgeObjectModule` · `VersioningModule` (the §5 core) · `ProvenanceModule` (ledger + disclosure projection) · `TaxonomyModule` (TDWG) · `ObservationModule` · `LocalityModule` (policy engine, §6) · `ReviewModule` · `CitationModule` · `IdentityTrustModule` · `MediaModule` (Swift + transcode/IIIF queues) · `FederationModule` (Casabio/iNat/GBIF/GenBank/CoL read connectors) · `ExportModule` · `SearchModule` (Elastic projections, public + restricted indices kept separate). Shared `CoreModule` holds the canonicalisation/hashing util and ID minting.

---

## 9. Acceptance Criteria (testable; "done" = all pass + flagship treatment)

### 9.1 Versioning core (spike gate)
- Given a Version is committed, when CouchDB compaction runs, then the Version doc and its `ver:sha256-…` id remain retrievable and byte-identical.
- Given a VoR with a DOI, when the living tip is amended N times, then the VoR Version URL and the DOI both still resolve to content whose recomputed hash equals the original `ver` id.
- Given identical content committed twice, then the same `ver` id results (dedup).
- Given a fork, then the new KO's first Version records `parent` = the source `ver` and a provenance lineage event exists.

### 9.2 Knowledge object & lenses
- Given a private draft, then it never appears in any public Couch projection or Elastic public index.
- Given `?depth=verbose`, then verbose captions/blocks render where authored and fall back to surface where not.
- Given a Commons KO that passes review and gains a VoR, then its `tier` reads `journal` and a `release` row exists.

### 9.3 Provenance + disclosure
- Given a provenance event with `disclosure='restricted'`, then it is absent from the public projection and present via the audited endpoint under authorisation.
- Given any released version, then every block and claim resolves to at least one provenance event (no unattributed content).

### 9.4 Citation
- Given a DOI or Version URL, when requested at any later time, then it never 3xx-redirects and returns the exact cited state.
- Given an entity URL reached from an older link, then a "newer version exists" relation is present in the response.
- Given a snippet whose block was later amended, then resolution flags drift (hash mismatch) and offers both states.

### 9.5 Locality / anti-poaching (each leakage path is a test)
- Given an uncertified user replicating a sensitive treatment, then no coordinate finer than QDS exists in: the doc, media EXIF, captions, snippet output, AI-companion answers, IIIF tiles, exported CSV, or any cached/derived tile.
- Given a certified user without an active grant, then `/localities/:id/precise` returns 403 and writes no disclosure.
- Given a certified user with an active, in-purpose, unexpired grant, then precise data is served and an `audit_ledger` `disclosed` row is written.
- Given a grant past `expires_at` or `revoked_at`, then precise access is denied.

### 9.6 Review & co-authorship
- Given an orange/red disposition, then the version cannot be released until an author reply exists on that thread.
- Given a co-author candidate who hasn't responded, then they display as "named-unconfirmed" and are never shown as having signed off.

### 9.7 Taxonomy
- Given two treatments asserting different concepts for one name, then both `taxon_concept` rows coexist, each resolvable with its `sec` treatment version, and neither overwrites the other.

### 9.8 Authoring / AI provenance
- Given on-platform authoring, then an AI provenance declaration (coverage/role/model/accountable-human) is recorded and surfaced; recorded coverage is marked authoritative.
- Given an imported manuscript, then any AI estimate is labelled `estimated` (inference), never presented as forensic.
- Given any draft state, then `/export` returns the work in a standard format.

### 9.9 Media
- Given an image in a treatment, then the zoom level needed to inspect the diagnostic characters referenced by its claims is available without paywall or watermark.

---

## 10. Build Sequence & Milestones

| # | Milestone | Contains | Gate |
|---|---|---|---|
| M0 | **Versioning spike** | §5 core over real Couch+Postgres | §9.1 passes — **hard gate** |
| M1 | Trust boundary + identity | Keycloak guards, account/idrec, assurance ladder, Postgres control-plane skeleton, audit ledger | §9.2 (visibility) |
| M2 | **Locality policy engine + tiered replication** | public/precise split, policy engine, leakage checklist | §9.5 |
| M3 | KO + provenance + Commons | content/blocks/claims, provenance + disclosure, Commons tier, lens interface | §9.2, §9.3 |
| M4 | Observations + map | micro-obs ingest, Casabio linkage, accept/reject, QDS map | §9.5, parts of §9.2 |
| M5 | Living treatment + taxonomy | TDWG concept model, treatment that accretes | §9.7 |
| M6 | Paper-builder + AI declaration | Quill editor, draft autosave, AI provenance declaration, export | §9.8 |
| M7 | Review + co-authors | disposition, right-of-reply, consent | §9.6 |
| M8 | Citation + DOI + Journal release | three-identifier, snippet anchoring, DOI mint, VoR | §9.4, §9.1 |
| M9 | Media | Swift masters, JXL/IIIF derivatives, free verification zoom | §9.9 |
| M10 | **Flagship treatment** | one real treatment end-to-end | all of §9 |

M0 and M2 are the two highest-risk pieces and are deliberately front-loaded.

---

## 11. Cross-cutting

- **Provenance everywhere:** every write path emits a provenance event; CI fails a module if a content-mutating endpoint lacks one.
- **Audit:** every precise-data disclosure, release, DOI mint, consent change, and access grant writes to `audit_ledger` (INSERT-only DB role).
- **Observability:** reuse OpenTelemetry + Grafana; add spans for policy-engine decisions and version commits.
- **Export:** `/export` must work at every visibility/status — the no-cage rule.
- **Migration:** media references are hash-addressed; the CSIR→LifeWatch→EU object-store moves are backfill jobs behind the resolver, not schema changes.

---

## 12. OPEN items that touch v1 (decide before or during the relevant milestone)

1. **Editor-confirmation of author-nominated reviewers** (M7) — v1 default is direct nomination; confirm whether an editor/steward conflict-screen step is required before reviewers are bound. *Recommend: lightweight conflict-declaration in v1, full editorial confirmation later.*
2. **Retraction propagation** (M8) — how a retraction propagates to forks/downstream citations. *v1 minimum: mark retracted + banner on descendants; full propagation graph deferred.*
3. **Steward appointment** (M5/M7) — who appoints stewards and how; needed once living treatments exist. *v1: founder/editor appoints; community process later.*
4. **Evidence-zoom ruling** (M9) — the exact free/tiered line for IIIF/JXL. *v1 implements "verification resolution free"; the tiered convenience layer is out of v1 anyway, so this can be finalised during M9.*
5. **DOI agency** (M8) — DataCite vs Crossref; affects the registry integration. *Recommend DataCite for data-rich objects; confirm before M8.*
6. **Postgres in the current Casabio cluster** — confirm it is (or can be) provisioned alongside Couch/Elastic/Redis for the control plane; this is assumed by M1.

Items in the guiding document's Part V that do **not** block v1 (editorial governance model, independence structure, sustainability funding, indexing/cold-start, defamation governance, ABS/CARE depth, streaming-data objects) are out of scope for the build and tracked there.

---

*This specification is built to be argued with. The two places to challenge hardest before writing code are the versioning core (§5 — is content-addressing-over-Couch the right substrate, or does a versioned-data store change the calculus?) and the locality policy engine (§6 — the leakage surface is the thing that, if wrong, does real-world harm). Everything else can evolve on a proven spine.*
