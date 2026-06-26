import type { ContentBlock, KnowledgeObjectContent, VersionDoc } from '@core/types';

/**
 * §4 lens layer — read-time projections over ONE canonical version (not stored
 * variants, except genuinely different content like a verbose caption). v1 axes:
 *  - version  : handled by which VersionDoc is loaded (the versioning core).
 *  - depth    : surface | verbose — selects caption depth and includes verbose
 *               (director's-cut) blocks only when requested.
 *  - register : academic | popular (advisory tag; affects comment surfacing).
 *  - annotation: comments / reviewer-layer / provenance overlay toggles (applied
 *               by the controller, which composes the extra layers).
 *  - language : 'en' only in v1, but the field/path exist so it stays additive.
 *
 * Crucially, projecting NEVER reveals a `restricted` block's text (anti-leakage,
 * §6) — restricted blocks are dropped from any projection meant for a reader who
 * is not server-side-authorised; the locality module owns the precise path.
 */
export interface LensRequest {
  depth?: 'surface' | 'verbose';
  register?: 'academic' | 'popular';
  language?: string;
  /** When false (default for public reads), restricted blocks are omitted entirely. */
  includeRestricted?: boolean;
}

function projectBlock(block: ContentBlock, depth: 'surface' | 'verbose'): ContentBlock | null {
  // Verbose (director's-cut) blocks only appear when verbose depth is requested.
  if (block.type === 'verbose' && depth !== 'verbose') return null;

  const out: ContentBlock = { ...block };
  if (block.captions) {
    const chosen = block.captions[depth] ?? block.captions.surface ?? block.captions.verbose;
    out.captions = chosen !== undefined ? { [depth]: chosen } : undefined;
  }
  return out;
}

export function applyLens(version: VersionDoc, req: LensRequest): KnowledgeObjectContent {
  const depth = req.depth ?? 'surface';
  const includeRestricted = req.includeRestricted ?? false;
  const sections = version.content.sections.map((section) => ({
    ...section,
    blocks: section.blocks
      .filter((b) => includeRestricted || !b.restricted) // never leak restricted text
      .map((b) => projectBlock(b, depth))
      .filter((b): b is ContentBlock => b !== null),
  }));
  return { ...version.content, sections };
}

/** True if any block in the version is marked restricted (informs projection safety). */
export function hasRestrictedContent(version: VersionDoc): boolean {
  return version.content.sections.some((s) => s.blocks.some((b) => b.restricted));
}
