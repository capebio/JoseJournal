# JOSE — v1 Frontend Specification

*Companion to the **JOSE v1 Implementation Specification** (backend) and the **JOSE Guiding Document v2**. This is the client layer: design language, the lens interaction model, the screen inventory, the component library, the offline-first behaviour, and acceptance criteria. Audience: the Casabio frontend team. Status: draft for build sign-off and pushback.*

*Scope: **Wider v1** — every thesis-prover has a usable interface. Prescriptiveness: **full**. Every screen maps to backend endpoints in the implementation spec (referenced as IS §7).*

---

## 0. How to read this document

- **Wireframes** are ASCII, self-contained, and indicate layout/hierarchy — not pixel design. The design language (§3) governs how they're rendered.
- **Components** are named in PascalCase and reused across screens; the library is §6.
- **Flows** in §7 are the step-by-step interactions that must work end-to-end for the flagship treatment.
- **Acceptance criteria** (§11) are testable and mirror the backend's thesis-prover structure.
- Copy in labels/buttons is **normative** — written in the interface's voice (active, plain, consistent: the button that says **Publish** produces a toast that says **Published**).

---

## 1. Scope & Thesis-Prover → Screen Map

| Thesis-prover (IS §1) | Primary screen(s) |
|---|---|
| Living treatment that accretes | **Reader** (§5.1) |
| Lens abstraction | **Lens Bar** (§4), present on Reader |
| Micro-observations + QDS map | **Distribution Map** (§5.2), **Capture** (§5.5) |
| Snippet/passage citation | **Snippet Citer** + **Reference Viewer** (§5.6) |
| Transparent review | **Review Panel** (§5.4) |
| Paper-builder + AI provenance | **Builder** (§5.3) |
| Versioning / three identifiers | **Version Bar / Banner**, **Version DAG** (§5.1) |
| Identity / certification | **Profile** (§5.8) |
| Commons / Journal | **Discovery** (§5.7) |
| Media | **JXL Lightbox** (§5.9) |

**Deferred (don't build the UI in v1):** payments/wallet, public leaderboards, full multilingual switching (the language lens shows `en` only but is wired), interactive gene-tree rendering (evidence rail shows sequence links, not a live tree), rich fork/merge UX (fork is a single action; visual merge tooling is later), tiered convenience-zoom controls (verification zoom is free and unmetered in v1).

---

## 2. Tech & Client Architecture

- **Web:** React (TypeScript), Vite. **Field app:** React Native, sharing the core.
- **Shared core package** (`@jose/core`): TypeScript types and a typed API client **generated from the backend OpenAPI/Swagger** (IS §7) — no hand-written request shapes; the contract is the source of truth. Plus the design tokens, the lens-state model, and the offline sync layer.
- **State:** server state via TanStack Query (cache keyed by entity+version+lens); local UI/lens state via a small store (Zustand). No global Redux.
- **Routing** reflects the three-identifier model (IS §3.9):
  - `/ko/:koId` → entity (resolves to tip; renders the "newer version" relationship when reached via an old link)
  - `/ko/:koId/v/:verId` → immutable version (the scholarly anchor; what citations link to)
  - `/doi/:doi` → resolves to a VoR version URL
  - Lens state is **URL query params** (`?depth=verbose&annotations=reviewer,provenance&lang=en`) so any view is shareable and reproducible.
- **Offline-first (field app + web PWA):** PouchDB replicates **public projections only** (IS §3.7). Authoritative actions (release, precise-locality requests, consent, DOI) are **online REST calls** to the NestJS trust boundary — the client never assumes authority it doesn't have. See §8.
- **The trust boundary is reflected client-side:** the client has no code path that can render a coordinate finer than QDS from a public projection, because the data simply isn't there (IS §6). Precise data only ever arrives through an authenticated, server-mediated response and is held in memory, never written to the offline store unless it's an explicit encrypted grant package.

---

## 3. Design Language

**Brief, pinned:** a *living scientific instrument*. Two things in tension, held together: the **organic** (a treatment that grows, the living world it documents) and the **instrument** (measurement, the QDS lattice, the version DAG, precise identifiers). The reader's single job on the core screen is to read a living treatment and move through its evidence by changing lenses. The design must feel rigorous and alive, not dusty and nostalgic.

**Deliberately *not*** the reflexive "scholarly biodiversity" look (aged-cream paper, high-contrast Didone, terracotta). That's the template answer for this exact brief, so we spend our freedom elsewhere.

### Tokens

**Colour** — cool herbarium-under-museum-light, not warm-aged-paper:
```
--paper      #F6F8F5   /* base: cool off-white, faint green-grey cast      */
--ink        #18201B   /* text: near-black with a green-black undertone     */
--structure  #6E7C70   /* rules, the QDS lattice, the version DAG lines     */
--type-red   #A83A2C   /* THE accent. Herbarium type-label red. Used ONLY   */
                       /* for provenance, nomenclatural type, annotation.   */
--verified   #2E6E5E   /* status only: verified / VoR / confirmed (teal-green)*/
--haze       #ECEFE9   /* fills, hovers, inactive lens strata               */
```
The accent is meaningful, not decorative: red is the colour of the **type** — the type-specimen label, the nomenclatural anchor — so it marks the places where provenance and authority live (the version banner, a claim's evidence, the type concept, a reviewer's annotation). It never decorates.

**Type** — three roles, each load-bearing:
```
Display / UI chrome : a humanist grotesque (e.g. "Söhne", "Inter Tight", or similar) —
                      the instrument voice. Tight, confident, never dainty.
Body / treatments   : a readable literary serif WITH A STRONG ITALIC (e.g. "Spectral",
                      "Newsreader"). The italic is load-bearing: scientific names are
                      always italic by convention, so the body italic is doing taxonomy,
                      not emphasis.
Mono / data         : a monospace (e.g. "Commit Mono", "IBM Plex Mono") for every precise
                      identifier — version hashes (ver:sha256…), DOIs, QDS codes, GenBank
                      accessions, coordinates. Mono = "this is an exact identifier", a
                      visual cue that carries meaning.
```
Type scale is calm and editorial (long-form reading is the job); weight and the italic carry hierarchy more than size.

**Layout:** a two-column reading frame — the **treatment** (serif, generous measure) and a persistent **evidence rail** (instrument voice, mono identifiers). The lens bar spans the top of the reading frame. Zero gratuitous radius; rules are hairline `--structure`. Restraint everywhere except the signature.

**Signature element — the Lens Bar (and its strata).** JOSE's one memorable thing is the control surface that lets you re-see one object through composable lenses. Active lenses render as visible, faintly layered **strata** — looking *through* a stack, the way you'd stack acetate overlays on a specimen plate. It is the embodiment of the whole platform: one canonical object, many ways of seeing. Everything else stays quiet so this lands.

**Motion (restrained, reduced-motion respected):** the version timeline scrubs and the treatment "settles" a beat as a new version loads; lens toggles cross-fade the relevant strata. Nothing ambient, nothing decorative.

---

## 4. The Lens System as UI (the signature)

A knowledge object is one canonical thing; lenses are how the reader composes a view of it (IS §4). The **Lens Bar** sits atop the reading frame and exposes five axes. Lens state lives in the URL and is shareable.

```
LENS BAR
 ⟲ Version  [ v3 · 2026-06-23 ▾ ]   ⚐ VoR        ← timeline/DAG popover; pick any version
 🌐 Language [ en ▾ ]                              ← en only in v1, control present
 ◑ Depth     [ surface ●———— verbose ]            ← reveals verbose captions + director's-cut
 Aa Register [ Academic | Popular ]               ← swaps summaries / popular-footprint copy
 ◫ Annotations  ☑ Reviewer  ☐ Provenance  ☐ AI    ← overlay layers toggled on the text
```

Per-lens behaviour:

- **Version** — a popover showing the dated version DAG (IS §3.1). Selecting a version navigates to its immutable `/v/:verId` URL. The current **VoR** and **tip** are marked. This is also where forks branch off visually.
- **Language** — selector; `en` only, but choosing it issues `?lang=` so adding languages is additive.
- **Depth** — a slider, not a toggle, because depth is a continuum: at `surface` you get the published captions and body; toward `verbose` the verbose captions and the author's director's-cut blocks fade in (clearly marked, reviewed/unreviewed per IS).
- **Register** — Academic/Popular swaps summary blocks and surfaces the popular-footprint links; never changes the claims or evidence.
- **Annotations** — independent overlay layers painted onto the text: **Reviewer** (disposition-coloured margin notes), **Provenance** (every block's origin, in `--type-red`), **AI** (the human/AI content view from the provenance declaration). Multiple may be on at once.

**Rule:** lenses are *read-time projections*; they never mutate the object. Changing a lens is always safe, instant, and reversible — and reflected in the URL so a colleague opening the link sees exactly what you saw.

---

## 5. Screen Inventory

### 5.1 The Reader (the heart)

The living treatment. Where accretion, provenance, claims→evidence, versioning, and citation all surface.

```
┌──────────────────────────────────────────────────────────────────────┐
│ JOSE     [ search names · places · evidence ]        ◐ R. Botha · ⚐cert │
├──────────────────────────────────────────────────────────────────────┤
│ ⟲ v3 · 2026-06-23 ▾  ⚐VoR   🌐en   ◑Depth[——●—]  Aa Acad|Pop  ◫ ☑Rev ☐Prov│
├────────────────────────────────────────────┬─────────────────────────┤
│  Mesembryanthemum …  sec. Botha 2026         │  EVIDENCE                │
│  ──────────────────────────────────          │  ───────────            │
│  ⓘ Commons · Journal(VoR) · DOI 10.59…/jose  │  ▸ Distribution (QDS)    │
│                                              │     [mini-map · 38 obs]   │
│  Description                                 │  ▸ Specimens (12)         │
│  Leaves opposite, succulent, … ● claim       │  ▸ Sequences  MN9921…     │
│   └─ evidence ▸ obs:…  seq:…  Fig 1          │  ▸ Provenance (full)      │
│  ┊ reviewer ▸ orange · "needs type cited"    │  ▸ Versions  v1·v2·v3 ◆   │
│  ┊            author replied ▸               │                          │
│                                              │                          │
│  « select any text → ‘Cite this passage’ »   │                          │
├────────────────────────────────────────────┴─────────────────────────┤
│ ⚠ You opened v2. A newer version exists.  [ View latest (v3) ]          │
└──────────────────────────────────────────────────────────────────────┘
```
- **Header strip** shows tier badges (Commons / Journal-VoR) and the DOI in mono; clicking the DOI copies the citation.
- **Claims** carry a `●` marker; expanding shows the evidence list (observations, sequences, figures), each a link to its source (IS §3.2).
- **Reviewer overlay** (when the annotation lens is on) shows disposition-coloured margin notes; orange/red display the author's right-of-reply inline (IS §3.10).
- **Version banner** appears only when the entity was reached via an older link or you're viewing a non-tip version; it links forward without redirecting (IS §3.9, acceptance §9.4).
- **Selection → "Cite this passage"** opens the Snippet Citer (§5.6).
- Components: `LensBar`, `TierBadges`, `ClaimMarker`, `EvidenceList`, `ReviewerOverlay`, `VersionBanner`, `EvidenceRail`, `SnippetCiter`.

### 5.2 Distribution Map (accept/reject → QDS)

```
┌───────────────────────────────────────────────┐
│  Distribution · Mesembryanthemum …             │
│  ┌───────────────────────────────┐  Pending(7) │
│  │      ░░▓ QDS lattice ░░        │  ▸ obs:441 ▸ │
│  │   ▣  ▣      ▣                  │     iNat ·   │
│  │      ▣   ●pending              │     [Accept] │
│  │   ▣      ▣    ▣                │     [Reject] │
│  └───────────────────────────────┘   (comment   │
│  Accepted ▣  ·  Pending ●  ·  Rejected ✕         │
│  ⓘ Localities shown at QDS (~20×20 km).          │
│     Precise access ▸ request (certified)         │
└───────────────────────────────────────────────┘
```
- Points are **QDS cells by default** (never finer in the public projection). Each is clickable → its source observation (Casabio/iNat/GBIF/FishBase).
- The curator accepts/rejects pending observations; **reject requires a comment** (IS §7).
- **"Request precise access"** is visible only to certified users and opens the policy-engine flow (§7, flow F6) — precise points are served server-side, in memory, and clearly marked time-limited; they're never written to the offline store.
- Components: `QDSMap`, `ObservationDecision`, `PreciseAccessRequest`.

### 5.3 The Builder (paper-builder: concept → WIP → publish)

```
┌──────────────────────────────────────────────────────────────┐
│ Draft · "…"   ● Private ▾    AI provenance ▸ recorded  ◫ AI view│
├──────────────────────────────┬───────────────────────────────┤
│  [ Quill editor ]             │  AUTHORSHIP                    │
│  Leaves opposite, succulent…  │  ▣ human   ▤ AI   ▥ AI→human   │
│  ▤ "(suggested expansion)"    │  Declaration:                  │
│                               │   coverage  recorded           │
│  ⌗ link AI account ▸          │   roles     editing, drafting  │
│                               │   model     <provider/model>   │
│  Insert ▸ claim · figure ·    │   accountable  R. Botha        │
│          observation · cite   │  ───────────                   │
│                               │  Export ▸ md · docx · jats·json│
├──────────────────────────────┴───────────────────────────────┤
│  Save draft   ·   Request review   ·   Publish to Commons      │
└──────────────────────────────────────────────────────────────┘
```
- **Quill** editor; authors link their own AI account (BYO-AI) or use the generic one.
- **AI provenance is recorded as you write** (IS §3.4, §9.8): the AI-content view (`◫ AI view`) shades human / AI / AI-then-human content; the declaration panel shows coverage (recorded vs estimated), roles, model, and the accountable human — **not** a single forensic percentage.
- **Visibility** control (Private → Collaborators → Public) on the draft.
- **Export is always available, at every state** (the no-cage rule, IS §11): md, docx, JATS, JSON.
- Actions read as what they do: **Save draft**, **Request review**, **Publish to Commons** (Journal/VoR release happens after review, §5.4).
- Components: `QuillBuilder`, `AIProvenancePanel`, `AIContentView`, `VisibilityControl`, `ExportMenu`, `InsertMenu`.

### 5.4 Review Panel (continuous, transparent, disposition)

```
┌───────────────────────────────────────────────┐
│ Review · "…"                 Continuous · open  │
│ Reviewers                                       │
│  ◐ A. Klak   ORCID 0000-… · relevance 0.82      │
│     ▣ green  · "incorporated"                    │
│  ◐ J. Smith  ORCID 0000-…                        │
│     ▤ orange · "type not cited"                  │
│        author ▸ "addressed in v3, see §desc"     │
│  + Nominate reviewer                             │
│ ───────────                                      │
│ Co-authors                                       │
│  ◑ M. Dlamini   named-unconfirmed · ⏳ 5 days     │
│  ◑ L. Roux      confirmed                         │
│ ───────────                                      │
│ [ Release as Version of Record ]  (mints DOI)    │
└───────────────────────────────────────────────┘
```
- Reviewers are **named**, with ORCID + credential summary and the advisory relevance score.
- **Disposition** uses the four states with their colours (green/yellow/orange/red); orange/red require and display the **author's reply** before release (IS §9.6).
- **Co-authors** show `named-unconfirmed` until they respond — never silently signed off (IS §9.6).
- **Release as Version of Record** is gated (all orange/red have replies; co-author deadlines resolved) and mints the DOI server-side.
- Components: `ReviewerCard`, `DispositionTag`, `AuthorReply`, `CoauthorChip`, `ReleaseButton`.

### 5.5 Micro-observation Capture (field-app first)

```
┌─────────────────────────┐
│  New observation         │
│  📷 [photo]  EXIF stripped│
│  Taxon ▸ search concept   │
│  Note ▸ "visiting flower" │
│  Locality ▸ captured ●    │
│   (precise stored locally,│
│    syncs as QDS public +  │
│    precise to server)     │
│  ● Offline — will sync     │
│  [ Save observation ]      │
└─────────────────────────┘
```
- The smallest citable knowledge object. Works **fully offline**; queues for sync.
- On sync, the server performs the public/precise split (IS §3.7); the **public projection that returns to other clients is QDS + EXIF-stripped**.
- A saved micro-observation is immediately citable once public (gets an entity URL; DOI on request).
- Components: `CaptureForm`, `ConceptSearch`, `OfflineBadge`, `SyncQueue`.

### 5.6 Snippet Citation & Reference Viewer

```
selection ▸ ┌───────────────────────┐
            │ Cite this passage      │
            │  ⌗ v3 · §description    │
            │  block blk:7a· hash ok  │
            │  [ Copy citation ]      │
            └───────────────────────┘

reference  ▸ "(Botha 2026, §desc)"  ⓘ
   click ▸  ┌───────────────────────┐
            │ ◉ View snippet         │
            │ ○ View entire treatment │
            │ ── snippet ──           │
            │ "Leaves opposite…"      │
            │ ⚠ amended in v4 ▸ both  │
            └───────────────────────┘
```
- Selecting text builds a **hardened anchor** (immutable version + section path + stable block id + quoted text + content hash; IS §3.9). Visual line numbers are never the anchor.
- A reference in any treatment is a **button**, not a footnote chase: it offers **View snippet** or **View entire treatment**. Snippet shows just the cited block.
- If the cited block changed since (hash mismatch), the viewer flags **"amended in a later version"** and offers both states (IS §9.4).
- Components: `SnippetCiter`, `ReferenceButton`, `SnippetViewer`, `DriftNotice`.

### 5.7 Discovery (Commons vs Journal — graph, not feed)

A filterable, graph-anchored browse — **not** a recency feed (Non-Goal). You arrive at objects through a taxon, a place, or an evidence question, then filter by **type × status** and **tier**.

```
┌──────────────────────────────────────────────┐
│ Explore                                        │
│ Anchor ▸  [ taxon ]  [ place ]  [ evidence ]   │
│ Tier  ▸  ◉ Journal  ○ Commons  ○ Both          │
│ Type  ▸  treatment · micro-obs · dataset · …    │
│ Status▸  reviewed · VoR · raw …                 │
│ ──────────────────────────────                  │
│  results as linked cards (no infinite scroll)   │
└──────────────────────────────────────────────┘
```
- Components: `AnchorPicker`, `TypeStatusFilter`, `TierToggle`, `ObjectCard`.

### 5.8 Profile / Identity / Certification

- Shows **account vs identity record** (you can curate a record for a deceased author; IS §3.6).
- ORCID, assurance level (unverified → verified → certified), and the certification application/vouch flow.
- The trust signal is shown **privately to the user** in v1 (no public leaderboard), framed as deeds-led.
- Components: `IdentityHeader`, `AssuranceLadder`, `CertificationFlow`, `RecordCurator`.

### 5.9 JXL Lightbox

- Opens from any organism image; links **both the image and its observation**.
- **Verification zoom is free and unmetered** — the detail needed to inspect the diagnostic characters a claim references is never paywalled or watermarked (IS §9.9). Full-screen carries a Casabio attribution watermark; that's the only mark.
- Deep zoom uses IIIF tiles; tile regions never encode precise locality (IS §6 checklist).
- Components: `JXLLightbox` (wraps the WASM LibJXL decoder), `IIIFDeepZoom`.

---

## 6. Component Library (v1)

Signature & lens: `LensBar`, `VersionTimeline` (DAG popover), `DepthSlider`, `AnnotationLayers`.
Reading: `TreatmentBody`, `ClaimMarker`, `EvidenceList`, `EvidenceRail`, `TierBadges`, `VersionBanner`, `ReviewerOverlay`, `ProvenanceOverlay`.
Authoring: `QuillBuilder`, `AIProvenancePanel`, `AIContentView`, `VisibilityControl`, `ExportMenu`, `InsertMenu`.
Review: `ReviewerCard`, `DispositionTag`, `AuthorReply`, `CoauthorChip`, `ReleaseButton`.
Maps/obs: `QDSMap`, `ObservationDecision`, `PreciseAccessRequest`, `CaptureForm`, `ConceptSearch`, `OfflineBadge`.
Citation: `SnippetCiter`, `ReferenceButton`, `SnippetViewer`, `DriftNotice`.
Media: `JXLLightbox`, `IIIFDeepZoom`.
Identity/discovery: `IdentityHeader`, `AssuranceLadder`, `CertificationFlow`, `AnchorPicker`, `TypeStatusFilter`, `TierToggle`, `ObjectCard`.

Every component derives colour/type strictly from §3 tokens. The `--type-red` accent appears **only** in `VersionBanner`, `ProvenanceOverlay`, `EvidenceList` markers, type-concept labels, and reviewer annotation — nowhere else.

---

## 7. Key Interaction Flows

- **F1 · Read with lenses.** Open `/ko/:id` → tip renders → adjust Version/Depth/Annotations → URL updates → share URL → colleague sees the identical composed view. *(AC §11.1)*
- **F2 · Cite a passage.** Select text → **Cite this passage** → anchor built against the immutable version → **Copy citation** → paste elsewhere → reference button resolves to snippet, drift-aware. *(AC §11.4)*
- **F3 · Capture offline → sync.** Field app, no signal → capture micro-obs (precise stored locally) → **Save observation** queues → on reconnect, server splits public/precise → other clients see QDS only. *(AC §11.5)*
- **F4 · Amend → new version.** Edit a released treatment → trivial fix applies as attributed overlay; substantive change creates a **new dated version**; the old version URL/DOI still resolve unchanged. *(AC §11.4, IS §9.1)*
- **F5 · Review exchange.** Nominate reviewer → reviewer sets **orange** with a note → author replies → **Release as Version of Record** unlocks only once every orange/red has a reply. *(AC §11.6)*
- **F6 · Request precise locality.** Certified user → **Request precise access** (states purpose) → server policy engine grants object-specific, time-limited access → precise points render in-session, marked expiring → never persisted offline. *(AC §11.5, IS §6)*
- **F7 · Publish.** Builder → **Publish to Commons** (integrity/legality gate only) → later graduates to **Journal/VoR** through review, minting a DOI. *(AC §11.2)*

---

## 8. Offline-First Behaviour

| Works fully offline | Online-only (trust boundary) |
|---|---|
| Read replicated public treatments & QDS maps | Releasing a version / minting a DOI |
| Capture micro-observations (queue to sync) | Requesting/serving precise localities |
| Draft authoring (local autosave) | Co-author consent, certification |
| Browse cached evidence (non-sensitive) | Submitting/answering review |

- The offline store holds **public projections only**; there is no client code path that renders sub-QDS coordinates from it.
- **Sync conflicts** surface as a plain choice ("This treatment changed on the server while you were offline — keep yours, take theirs, or compare"), never a silent overwrite; the versioning core means both states are preserved regardless.
- **Precise data offline** is exceptional: only an explicit, server-issued, encrypted, time-bound grant package (IS §6) — shown to the user as a clearly-expiring, revocable item, never a permanent local copy.

---

## 9. State, Data Fetching, Routing

- Query cache key = `(entityId | versionId, lensState)`; changing a lens is a new cache entry, so toggles are instant after first load.
- Draft edits are **optimistic** with local autosave; release/VoR actions are **never** optimistic (they await server confirmation — they're authoritative).
- The router enforces the identifier contract: version URLs and DOIs are immutable targets and must never client-side redirect; only the entity route resolves-to-latest, and it always renders the relationship banner when not at tip.

---

## 10. Accessibility & Equity (charter-aligned)

- **Quality floor, non-negotiable:** responsive to mobile, visible keyboard focus, reduced-motion respected, WCAG-AA contrast (the §3 palette is chosen to pass on `--paper`).
- Video carries captions + verbose captions + transcript; transcripts are first-class (and double as the AI-parse and time-snippet source).
- **Low-bandwidth is a first-class mode**, not a fallback: the field app and PWA must be usable on intermittent connections; images degrade gracefully (a lightweight evidence view before high-res JXL). This is the equity commitment made literal at the client.
- The **language lens is wired even though `en`-only ships** — strings are externalised from day one so multilingualism is additive, not a rebuild.

---

## 11. Acceptance Criteria (frontend; testable)

**11.1 Lenses.** Given any lens change, then the URL updates and reloading or sharing it reproduces the identical composed view; and no lens change ever issues a write request.

**11.2 Reader / tiers.** Given a Journal VoR, then tier badges and the DOI render and the DOI copies a correct citation; given a Commons object, then no DOI/VoR badge shows.

**11.3 Versioning UI.** Given a version URL or DOI opened directly, then the client never redirects and renders that exact version; given an entity URL reached from an old link, then the forward banner shows and links to the tip without losing the opened version.

**11.4 Citation.** Given a selected passage, then a citation with an immutable-version anchor is produced; given a cited block later amended, then the reference viewer flags drift and offers both states.

**11.5 Locality (anti-poaching, client side).** Given any offline or public view, then no rendered map point, image, caption, export, or AI answer exposes finer-than-QDS location; given precise access without an active grant, then the precise control is absent or returns a clear "access required" state; given an active grant, then precise points render in-session, marked expiring, and are not written to the offline store.

**11.6 Review.** Given an orange/red disposition without an author reply, then **Release as Version of Record** is disabled with a reason; given an unresponded co-author, then they render as "named-unconfirmed", never as confirmed.

**11.7 Authoring.** Given on-platform writing, then the AI content view and recorded provenance declaration render; given any draft state, then Export returns the work; given an imported manuscript, then any AI figure is labelled "estimated".

**11.8 Media.** Given a claim referencing a diagnostic character, then the zoom needed to inspect it is reachable without paywall or watermark.

**11.9 Floor.** Every screen passes keyboard-only navigation, AA contrast, and reduced-motion.

---

## 12. Build Sequence (mapped to backend milestones)

| FE | Builds | Needs backend |
|---|---|---|
| FE0 | Design tokens, `@jose/core` (typed OpenAPI client), routing + lens-state model, app shell | IS M0–M1 |
| FE1 | **Reader** read-path + **Lens Bar** (version, depth, annotations) over a released treatment | IS M3, M5 |
| FE2 | **QDS Map** + observation accept/reject; **Capture** (offline) | IS M2, M4 |
| FE3 | **Snippet Citer** + **Reference Viewer** (drift-aware); version banner | IS M8 |
| FE4 | **Builder** + AI provenance panel + AI content view + export | IS M6 |
| FE5 | **Review Panel** (disposition, replies, co-author) + **Release** | IS M7, M8 |
| FE6 | **Precise-access** flow (policy-engine UI) + grant/expiry handling | IS M2 |
| FE7 | **JXL Lightbox** + IIIF deep zoom (free verification zoom) | IS M9 |
| FE8 | **Discovery**, **Profile/Certification**, offline-sync polish | IS M1–M9 |
| FE9 | **Flagship treatment** dressed end-to-end; a11y + low-bandwidth pass | IS M10 |

FE1 (the Reader + Lens Bar) is the screen to build first and get right — it's the signature, and it's what makes JOSE legibly itself. Everything else hangs off proving that one screen feels alive.

---

*Two places to challenge before building: the Lens Bar interaction (§4 — is "strata you look through" the right physical metaphor, or does it overcomplicate a control that could be plainer?) and the offline/precise-locality boundary (§8 — confirm the field workflow never needs precise data persisted locally in the normal case, because the whole client-side anti-poaching guarantee rests on it). The Reader is the screen worth prototyping interactively first.*
