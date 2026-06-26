import { ulid } from 'ulid';

/**
 * §2 ID conventions — ULID-based, prefixed, stable. The prefix is part of the
 * stored id. `ver:` ids are special: they are content-addressed (a sha256), not
 * ULIDs — minted by the versioning core (hash.ts), never here.
 */
export const ID_PREFIXES = {
  ko: 'ko', // knowledge object (entity)
  ref: 'ref', // branch/tip pointer
  blk: 'blk', // content block
  claim: 'claim', // claim
  prov: 'prov', // provenance event
  acct: 'acct', // account
  idrec: 'idrec', // identity record
  name: 'name', // nomenclatural name
  concept: 'concept', // taxon concept
  assert: 'assert', // assertion
  act: 'act', // nomenclatural act
  obs: 'obs', // observation
  doi: 'doi', // DOI (internal handle)
  grant: 'grant', // access grant
  media: 'media', // media object
  seq: 'seq', // sequence accession reference
  specimen: 'specimen', // digital extended specimen
  snippet: 'snippet', // snippet anchor
  review: 'review', // review thread
  release: 'release', // release record
  cert: 'cert', // certification
  consent: 'consent', // co-author consent
} as const;

export type IdPrefix = (typeof ID_PREFIXES)[keyof typeof ID_PREFIXES];

/** Mint a new prefixed ULID, e.g. `ko:01JABCXYZ...`. */
export function mintId(prefix: IdPrefix): string {
  return `${prefix}:${ulid()}`;
}

/** True if `id` carries the expected prefix. */
export function hasPrefix(id: string, prefix: IdPrefix): boolean {
  return typeof id === 'string' && id.startsWith(`${prefix}:`);
}

/** Extract the prefix of a prefixed id (`ko:01J...` -> `ko`), or null. */
export function prefixOf(id: string): string | null {
  const i = id.indexOf(':');
  return i > 0 ? id.slice(0, i) : null;
}
