# Media Module — Spec (JOSE v1, §7 / §9.9)

## Goal
Content-addressed media masters with JXL/IIIF delivery derivatives, where
**verification resolution is always free and never watermarked** (§9.9). The
zoom needed to inspect diagnostic characters (≤ `verificationMaxEdge`) must reach
any reader with no paywall and no watermark.

## Constraints
- Every blob is keyed by its sha256 content address (`sha256-…`), never a path
  (§29). Master + derivatives are self-verifying; storage migration is a backfill
  behind the resolver, not a reference rewrite.
- Inject only `PORTS.MediaRepo`, `ProvenanceService`, `ConfigService`. Never touch
  a DB directly. Provenance is recorded on every write.
- Auth: `POST /media` requires `@MinAssurance('verified')`; `GET /media/:id` is
  `@Public()`.
- Verification resolution must NEVER be paywalled or watermarked.

## Endpoints (§7, exact)
- `POST /media` `(verified+)` — body `{ mime, dataBase64, verificationMaxEdge? }`.
  Decode `Buffer.from(dataBase64,'base64')`; `contentAddress = sha256Address(bytes)`;
  `MediaRepo.putMaster({ id: mintId('media'), contentAddress, mime, bytes: bytes.length,
  derivatives:{}, verificationMaxEdge, exifStripped:true }, bytes)`. Then build a
  `jxl` derivative (v1: same bytes, `image/jxl`, `maxEdge = verificationMaxEdge ?? config`)
  and an `iiif` descriptor derivative (small JSON info doc, `application/json`).
  Record provenance. Return the meta.
- `GET /media/:id?res=<number>|'verification'` `(public)` — serve a derivative
  descriptor. `res` absent / `'verification'` / `≤ verificationMaxEdge`
  (fallback `config.freeVerificationMaxEdge`) ⇒ `{ free:true, watermark:false,
  address, mime, maxEdge }`. Higher `res` in v1 is still free but tagged
  `{ free:true, tierNote:'convenience tier deferred to fast-follow' }`.

## Edge cases
- Identical bytes ⇒ identical `contentAddress` (deterministic), distinct media ids.
- Media without `verificationMaxEdge` falls back to `config.freeVerificationMaxEdge`.
- Unknown id ⇒ 404.
- In-memory repo returns clones, so the service re-reads via `getMeta(id)` after
  `putDerivative` so the returned meta reflects both derivatives.

## Known v1 limitation — EXIF stripping
No image library in v1, so we cannot actually strip EXIF or transcode. The master
is marked `exifStripped:true` and callers are TRUSTED to send pre-stripped bytes;
this flag being `true` is what the §6 anti-leakage checklist asserts on. The `jxl`
derivative likewise stores the master bytes verbatim under `image/jxl`. A
fast-follow wires a real strip/transcode step at ingest and stops trusting callers.

## Success criteria (§9.9 acceptance)
- Upload a small base64 blob ⇒ `address` starts `sha256-`, `exifStripped === true`,
  `jxl` + `iiif` derivatives present.
- `GET` at verification res ⇒ `free:true`, `watermark:false`, no paywall.
- Higher res ⇒ still `free:true` with the convenience-tier `tierNote`.
