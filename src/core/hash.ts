import { createHash } from 'crypto';
import { canonicalize } from './canonical';
import type { KnowledgeObjectContent, VersionMeta } from './types';

/**
 * §3.1 Hashing rule:
 *   contentHash = sha256( JCS(content) || JCS(meta) )
 * where meta = { ko, parent, branch, authors, status, visibility, lenses }.
 * `_rev` and `_id` are excluded so a version's identity is independent of
 * CouchDB's revision/compaction machinery (§5: Couch `_rev` must NOT be the
 * version identity).
 *
 * The concatenation is of the two canonical *strings*; both are unambiguous and
 * self-delimiting JSON values, so `||` cannot be made ambiguous by content.
 */
export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

/** `sha256-<hex>` — the value form used for contentHash and Swift media addressing. */
export function sha256Address(input: string | Buffer): string {
  return `sha256-${sha256Hex(input)}`;
}

/**
 * Compute the canonical content hash of a version.
 * Returns both the `contentHash` value (`sha256-<hex>`) and the full version id
 * (`ver:sha256-<hex>`), which is also the CouchDB `_id` of the immutable doc.
 */
export function computeVersionHash(
  content: KnowledgeObjectContent,
  meta: VersionMeta,
): { contentHash: string; versionId: string } {
  const canonicalContent = canonicalize(content);
  const canonicalMeta = canonicalize(metaForHash(meta));
  const digest = sha256Hex(canonicalContent + canonicalMeta);
  const contentHash = `sha256-${digest}`;
  return { contentHash, versionId: `ver:${contentHash}` };
}

/**
 * The exact, ordered meta subset that participates in the hash. Authors are
 * sorted so that author-list ordering (a presentation concern) never changes a
 * version's identity. Every field here is load-bearing for identity; nothing
 * else from the Version doc is.
 */
export function metaForHash(meta: VersionMeta): Record<string, unknown> {
  return {
    ko: meta.ko,
    parent: meta.parent,
    branch: meta.branch,
    authors: [...meta.authors].sort(),
    status: meta.status,
    visibility: meta.visibility,
    lenses: {
      language: meta.lenses.language,
      depthVariants: [...meta.lenses.depthVariants].sort(),
      register: meta.lenses.register,
    },
  };
}
