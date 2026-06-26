/**
 * Lens state ⇄ URL (Frontend Spec §4, AC 11.1). Lens state lives in the URL query
 * so any composed view is shareable and reproducible; changing a lens never
 * mutates the object and never issues a write — it only re-projects.
 */
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface LensState {
  version: string | null; // ver:… ; null = the moving tip
  depth: 'surface' | 'verbose';
  register: 'academic' | 'popular';
  lang: string; // 'en' only in v1, but wired
  annotations: { reviewer: boolean; provenance: boolean; ai: boolean };
}

/** A merge-patch for the lens; annotations may be partial (toggle one overlay). */
export type LensPatch = Partial<Omit<LensState, 'annotations'>> & { annotations?: Partial<LensState['annotations']> };

export const DEFAULT_LENS: LensState = {
  version: null,
  depth: 'surface',
  register: 'academic',
  lang: 'en',
  annotations: { reviewer: true, provenance: false, ai: false },
};

export function parseLens(params: URLSearchParams): LensState {
  const ann = (params.get('annotations') ?? 'reviewer').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    version: params.get('version'),
    depth: params.get('depth') === 'verbose' ? 'verbose' : 'surface',
    register: params.get('register') === 'popular' ? 'popular' : 'academic',
    lang: params.get('lang') ?? 'en',
    annotations: { reviewer: ann.includes('reviewer'), provenance: ann.includes('provenance'), ai: ann.includes('ai') },
  };
}

/** Serialize into an existing params object (preserves unrelated params). */
export function writeLens(params: URLSearchParams, lens: LensState): URLSearchParams {
  const p = new URLSearchParams(params);
  lens.version ? p.set('version', lens.version) : p.delete('version');
  lens.depth === 'verbose' ? p.set('depth', 'verbose') : p.delete('depth');
  lens.register === 'popular' ? p.set('register', 'popular') : p.delete('register');
  lens.lang && lens.lang !== 'en' ? p.set('lang', lens.lang) : p.delete('lang');
  const ann = Object.entries(lens.annotations).filter(([, on]) => on).map(([k]) => k);
  // Always write annotations explicitly (incl. empty) so a shared link reproduces exactly.
  p.set('annotations', ann.join(','));
  return p;
}

/** React hook: the current lens + a merge-setter that round-trips through the URL. */
export function useLens(): [LensState, (patch: LensPatch) => void] {
  const [params, setParams] = useSearchParams();
  const lens = useMemo(() => parseLens(params), [params]);
  const setLens = useCallback(
    (patch: LensPatch) => {
      const next: LensState = { ...lens, ...patch, annotations: { ...lens.annotations, ...(patch.annotations ?? {}) } };
      setParams(writeLens(params, next), { replace: false });
    },
    [lens, params, setParams],
  );
  return [lens, setLens];
}
