-- JOSE v1 Postgres control plane (§3.4–3.8). Authoritative for every scholarly/
-- legal state transition. Content lives in Couch; this is the ACID spine.

-- ── Provenance ledger (§3.4) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS provenance_event (
  id            TEXT PRIMARY KEY,
  subject_ref   TEXT NOT NULL,
  actor_ref     TEXT NOT NULL,
  actor_role    TEXT NOT NULL CHECK (actor_role IN ('author','contributor','reviewer','steward','editor','ai','system')),
  action        TEXT NOT NULL,
  ts            TIMESTAMPTZ NOT NULL DEFAULT now(),
  disclosure    TEXT NOT NULL DEFAULT 'public' CHECK (disclosure IN
                  ('public','embargoed','restricted','sealed','legally-suppressed','anonymised-but-auditable')),
  detail        JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS provenance_subject_idx ON provenance_event (subject_ref);
CREATE INDEX IF NOT EXISTS provenance_actor_public_idx ON provenance_event (actor_ref) WHERE disclosure = 'public';

-- ── TDWG concept model — Name ≠ Taxon (§3.5) ────────────────────────────────
CREATE TABLE IF NOT EXISTS nom_name (
  id            TEXT PRIMARY KEY,
  name_string   TEXT NOT NULL,
  authorship    TEXT,
  rank          TEXT,
  code          TEXT CHECK (code IN ('ICN','ICZN','ICNP','other')),
  nom_status    TEXT,
  registration  JSONB
);

CREATE TABLE IF NOT EXISTS taxon_concept (
  id              TEXT PRIMARY KEY,
  name_id         TEXT NOT NULL REFERENCES nom_name(id),
  sec_version     TEXT NOT NULL,
  circumscription JSONB,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS concept_name_idx ON taxon_concept (name_id);

CREATE TABLE IF NOT EXISTS assertion (
  id            TEXT PRIMARY KEY,
  concept_id    TEXT NOT NULL REFERENCES taxon_concept(id),
  subject_ref   TEXT NOT NULL,
  evidence_refs TEXT[] NOT NULL DEFAULT '{}',
  asserted_by   TEXT NOT NULL,
  ts            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assertion_concept_idx ON assertion (concept_id);

CREATE TABLE IF NOT EXISTS nomenclatural_act (
  id            TEXT PRIMARY KEY,
  name_id       TEXT NOT NULL REFERENCES nom_name(id),
  act_type      TEXT NOT NULL,
  code          TEXT NOT NULL,
  governing_decision TEXT,
  vor_version   TEXT,
  ts            TIMESTAMPTZ DEFAULT now()
);

-- ── Identity, assurance, trust (§3.6) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS account (
  id            TEXT PRIMARY KEY,
  keycloak_sub  TEXT UNIQUE NOT NULL,
  orcid         TEXT UNIQUE,
  display_name  TEXT NOT NULL,
  assurance     TEXT NOT NULL DEFAULT 'unverified' CHECK (assurance IN ('unverified','verified','certified')),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS identity_record (
  id            TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL,
  external_ids  JSONB,
  curated_by    TEXT REFERENCES account(id),
  claimed_by    TEXT REFERENCES account(id)
);

CREATE TABLE IF NOT EXISTS certification (
  id            TEXT PRIMARY KEY,
  account_id    TEXT NOT NULL REFERENCES account(id),
  vouched_by    TEXT[] NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','granted','revoked')),
  scope         JSONB,
  ts            TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trust_event (
  id            BIGSERIAL PRIMARY KEY,
  account_id    TEXT NOT NULL REFERENCES account(id),
  kind          TEXT NOT NULL CHECK (kind IN ('contribution','review','correction','endorsement','integrity_breach')),
  weight        NUMERIC NOT NULL,
  basis_ref     TEXT,
  ts            TIMESTAMPTZ DEFAULT now()
);

-- ── Observations & localities (§3.7) — restricted precise table ─────────────
CREATE TABLE IF NOT EXISTS locality_precise (
  obs_id        TEXT PRIMARY KEY,
  lat           NUMERIC NOT NULL,
  lon           NUMERIC NOT NULL,
  uncertainty_m INTEGER,
  sensitivity   TEXT NOT NULL CHECK (sensitivity IN ('normal','sensitive','highly-sensitive')),
  source        JSONB
);

-- ── Control plane (§3.8) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS release (
  id            TEXT PRIMARY KEY,
  ko_id         TEXT NOT NULL,
  version_id    TEXT NOT NULL,
  tier          TEXT NOT NULL CHECK (tier IN ('commons','journal')),
  doi           TEXT,
  released_by   TEXT NOT NULL REFERENCES account(id),
  released_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS release_ko_idx ON release (ko_id);
CREATE INDEX IF NOT EXISTS release_version_idx ON release (version_id);

CREATE TABLE IF NOT EXISTS doi_registry (
  doi           TEXT PRIMARY KEY,
  version_id    TEXT NOT NULL,
  ko_id         TEXT NOT NULL,
  agency        TEXT NOT NULL DEFAULT 'datacite',
  minted_at     TIMESTAMPTZ DEFAULT now(),
  metadata      JSONB
);
CREATE INDEX IF NOT EXISTS doi_version_idx ON doi_registry (version_id);

CREATE TABLE IF NOT EXISTS coauthor_consent (
  id            TEXT PRIMARY KEY,
  ko_id         TEXT NOT NULL,
  candidate     TEXT NOT NULL,
  state         TEXT NOT NULL DEFAULT 'named-unconfirmed' CHECK (state IN ('named-unconfirmed','confirmed','declined','negotiating')),
  requested_at  TIMESTAMPTZ DEFAULT now(),
  deadline      TIMESTAMPTZ,
  resolved_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS consent_ko_idx ON coauthor_consent (ko_id);

CREATE TABLE IF NOT EXISTS access_grant (
  id            TEXT PRIMARY KEY,
  grantee       TEXT NOT NULL REFERENCES account(id),
  object_ref    TEXT NOT NULL,
  purpose       TEXT NOT NULL,
  granted_by    TEXT NOT NULL,
  granted_at    TIMESTAMPTZ DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ,
  offline_pkg   BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS grant_lookup_idx ON access_grant (grantee, object_ref);

CREATE TABLE IF NOT EXISTS audit_ledger (
  id            BIGSERIAL PRIMARY KEY,
  ts            TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_ref     TEXT NOT NULL,
  action        TEXT NOT NULL,
  object_ref    TEXT,
  disclosure    TEXT NOT NULL DEFAULT 'restricted',
  detail        JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS audit_object_idx ON audit_ledger (object_ref);
-- audit_ledger is INSERT-only by policy; see 002_audit_insert_only.sql.

-- ── Review threads (§3.10) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_thread (
  id              TEXT PRIMARY KEY,
  ko_id           TEXT NOT NULL,
  reviewer        TEXT NOT NULL,
  relevance_score NUMERIC,
  disposition     TEXT NOT NULL CHECK (disposition IN ('green','yellow','orange','red')),
  comment         TEXT NOT NULL DEFAULT '',
  author_reply    TEXT,
  ts              TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS review_ko_idx ON review_thread (ko_id);

-- ── Snippet anchors (§3.9) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS snippet_anchor (
  id            TEXT PRIMARY KEY,
  version_id    TEXT NOT NULL,
  section_path  TEXT NOT NULL,
  block_id      TEXT NOT NULL,
  quoted_text   TEXT NOT NULL,
  content_hash  TEXT NOT NULL
);

-- ── AI provenance declarations (§13 / §7 authoring) ─────────────────────────
CREATE TABLE IF NOT EXISTS ai_declaration (
  ko_id             TEXT PRIMARY KEY,
  coverage          TEXT NOT NULL CHECK (coverage IN ('recorded','attested','estimated')),
  role              TEXT NOT NULL,
  model             TEXT,
  accountable_human TEXT NOT NULL,
  percentage        NUMERIC,
  recorded_at       TIMESTAMPTZ DEFAULT now()
);
