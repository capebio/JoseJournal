/**
 * FE4 Builder — citation engine (Frontend Spec §5.3). Ported from the prototype
 * BuilderScreen. In-text `[@key]` tokens live verbatim inside block text; this
 * module resolves them against the manuscript bibliography to render numbered or
 * author–date in-text markers, a synced reference list, and per-reference usage
 * counts. A `jose` reference pins a living object at a version — the three-
 * identifier model exercised from inside authoring.
 */
import type { ReactNode } from 'react';
import type { Reference } from '../../core/api/types';

export type CiteStyle = 'numbered' | 'authordate';
export interface CiteEntry { num: number; ref: Reference }
export interface CiteBuild {
  citeMap: Record<string, CiteEntry>;
  order: string[];
  counts: Record<string, number>;
  byKey: Record<string, Reference>;
}
/** A reference whose identity (id/key) is assigned on insertion. */
export type RefInput = Omit<Reference, 'id' | 'key'> & { id?: string; key?: string };

export interface JoseObject {
  concept: string;
  short: string;
  authors: string;
  year: string;
  title: string;
  vor: string | null;
  tip: string;
  section: string;
  hash: string;
}

// ── Demo data (the prototype's seed; real adds come via the picker) ──────────
export const REF_SEED: Reference[] = [
  { id: 'r1', key: 'klak2012', type: 'article', short: 'Klak & Bruyns', authors: 'Klak, C. & Bruyns, P. V.', year: '2012', title: 'A phylogeny and new classification of the Mesembryanthemoideae (Aizoaceae)', source: 'Taxon 61', doi: '10.1002/tax.612009' },
  { id: 'r2', key: 'hartmann2001', type: 'book', short: 'Hartmann', authors: 'Hartmann, H. E. K. (ed.)', year: '2001', title: 'Illustrated Handbook of Succulent Plants: Aizoaceae', source: 'Springer, Berlin' },
  { id: 'r3', key: 'tdwg2017', type: 'web', short: 'TDWG', authors: 'Biodiversity Information Standards (TDWG)', year: '2017', title: 'Darwin Core quick reference guide', source: 'tdwg.org' },
  { id: 'r4', key: 'botha2026', type: 'jose', short: 'Botha', authors: 'Botha, R.', year: '2026', title: 'Mesembryanthemum aureum Botha — a living treatment', source: 'JOSE', jose: { concept: '10.59321/jose.aizo.0142', version: 'v2', isVoR: true, tip: 'v3', section: '§description', hash: '9f2ac1e7' } },
];

export const DOI_DB: Record<string, RefInput> = {
  '10.1111/jbi.13889': { type: 'article', short: 'Born et al.', authors: 'Born, J., Linder, H. P. & Desmet, P.', year: '2007', title: 'The Greater Cape Floristic Region', source: 'Journal of Biogeography 34', doi: '10.1111/jbi.13889' },
  '10.1554/05-528.1': { type: 'article', short: 'Ellis et al.', authors: 'Ellis, A. G., Weis, A. E. & Gaut, B. S.', year: '2006', title: 'Evolutionary radiation of stone plants (Aizoaceae)', source: 'Evolution 60', doi: '10.1554/05-528.1' },
};

export const WEB_RESULTS: RefInput[] = [
  { type: 'article', short: 'Schmiedel & Jürgens', authors: 'Schmiedel, U. & Jürgens, N.', year: '1999', title: 'Community structure on quartz fields in the Knersvlakte', source: 'Plant Ecology 142', doi: '10.1023/A:1009856025887' },
  { type: 'article', short: 'Ellis et al.', authors: 'Ellis, A. G., Weis, A. E. & Gaut, B. S.', year: '2006', title: 'Evolutionary radiation of stone plants (Aizoaceae)', source: 'Evolution 60', doi: '10.1554/05-528.1' },
  { type: 'book', short: 'Snijman', authors: 'Snijman, D. A. (ed.)', year: '2013', title: 'Plants of the Greater Cape Floristic Region 2: the Extra Cape Flora', source: 'SANBI', doi: '' },
];

export const JOSE_OBJECTS: JoseObject[] = [
  { concept: '10.59321/jose.aizo.0142', short: 'Botha', authors: 'Botha, R.', year: '2026', title: 'Mesembryanthemum aureum Botha — a living treatment', vor: 'v2', tip: 'v3', section: '§description', hash: '9f2ac1e7' },
  { concept: '10.59321/jose.poll.0210', short: 'ShareNat contributors', authors: 'ShareNat contributors', year: '2026', title: 'Pollination micro-observations of the Knersvlakte', vor: null, tip: 'v4', section: '§observations', hash: 'c71d40a2' },
];

// ── Build / resolve ──────────────────────────────────────────────────────────
/** Scan all text for `[@key]` tokens: first-appearance order, usage counts, map. */
export function buildCites(texts: Array<string | undefined>, refs: Reference[]): CiteBuild {
  const byKey: Record<string, Reference> = {};
  refs.forEach((r) => (byKey[r.key] = r));
  const order: string[] = [];
  const counts: Record<string, number> = {};
  const re = /\[@([^\]]+)\]/g;
  texts.forEach((t) => {
    let m: RegExpExecArray | null;
    const rr = new RegExp(re);
    while ((m = rr.exec(t || '')) !== null) {
      m[1].split(/[;,]/).forEach((s) => {
        const key = s.trim().replace(/^@/, '');
        if (!key) return;
        counts[key] = (counts[key] || 0) + 1;
        if (byKey[key] && order.indexOf(key) < 0) order.push(key);
      });
    }
  });
  const citeMap: Record<string, CiteEntry> = {};
  order.forEach((key, i) => (citeMap[key] = { num: i + 1, ref: byKey[key] }));
  return { citeMap, order, counts, byKey };
}

/** Render one in-text citation token to a linked `[n]` (numbered) or `(Short, year)`. */
export function renderCite(keysRaw: string, citeMap: Record<string, CiteEntry>, style: CiteStyle, k: number): ReactNode {
  const keys = keysRaw.split(/[;,]/).map((s) => s.trim().replace(/^@/, '')).filter(Boolean);
  const items = keys.map((key) => citeMap[key]).filter(Boolean);
  if (!items.length) return <span key={'c' + k} className="bld-cite bld-cite-bad">[?]</span>;
  const living = items.some((x) => x.ref.type === 'jose');
  const label = style === 'numbered'
    ? '[' + items.map((x) => x.num).join(', ') + ']'
    : '(' + items.map((x) => x.ref.short + ', ' + x.ref.year).join('; ') + ')';
  const href = '#ref-' + items[0].ref.key;
  return (
    <a key={'c' + k} className="bld-cite" href={href}>
      {label}
      {living && <span className="bld-living" title="living object">‡</span>}
    </a>
  );
}

/** Render block text resolving `[@key]` citations and `*italic*` scientific names. */
export function renderInline(text: string | undefined, citeMap: Record<string, CiteEntry>, style: CiteStyle): ReactNode {
  if (!text) return null;
  const out: ReactNode[] = [];
  const re = /\[@([^\]]+)\]|\*([^*]+)\*/g;
  let m: RegExpExecArray | null;
  let last = 0;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] != null) out.push(renderCite(m[1], citeMap, style, k++));
    else out.push(<i key={'i' + k++}>{m[2]}</i>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Rich (JSX) reference formatter for the bibliography list / cards / picker. */
export function fmtRef(r: Reference): ReactNode {
  if (r.type === 'book') return <>{r.authors} ({r.year}). <i>{r.title}</i>. {r.source}.</>;
  if (r.type === 'web') return <>{r.authors} ({r.year}). {r.title}. {r.source}.</>;
  if (r.type === 'jose' && r.jose) {
    return (
      <>
        {r.authors} ({r.year}). {r.title}. <i>JOSE</i> {r.jose.version}
        {r.jose.isVoR ? ' (Version of Record)' : ' (living tip)'}.{' '}
        <span className="bld-refdoi">{r.jose.concept} [{r.jose.section}; ver:sha256-{r.jose.hash}…]</span>
        <span className="bld-refliving">living</span>
      </>
    );
  }
  return (
    <>
      {r.authors} ({r.year}). {r.title}. <i>{r.source}</i>.
      {r.doi ? <> <span className="bld-refdoi">https://doi.org/{r.doi}</span></> : null}
    </>
  );
}

/** Plain-text reference formatter (kept in sync with the server export renderer). */
export function plainRef(r: Reference): string {
  if (r.type === 'book' || r.type === 'web') return `${r.authors} (${r.year}). ${r.title}. ${r.source ?? ''}.`;
  if (r.type === 'jose' && r.jose) {
    return `${r.authors} (${r.year}). ${r.title}. JOSE ${r.jose.version}${r.jose.isVoR ? ' (Version of Record)' : ' (living tip)'}. ${r.jose.concept} [${r.jose.section}; ver:sha256-${r.jose.hash}…].`;
  }
  return `${r.authors} (${r.year}). ${r.title}. ${r.source ?? ''}.${r.doi ? ` https://doi.org/${r.doi}` : ''}`;
}

/** Derive a unique citation key from author + year, avoiding collisions. */
export function genKey(r: RefInput, refs: Reference[]): string {
  const base = ((r.short || r.authors || 'ref').toLowerCase().replace(/[^a-z]/g, '').slice(0, 12) || 'ref') + (r.year || '');
  let key = base;
  let i = 2;
  while (refs.some((x) => x.key === key)) key = base + '_' + i++;
  return key;
}
