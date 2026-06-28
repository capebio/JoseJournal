import { useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { qk } from '../core/query/queryClient';
import * as ep from '../core/api/endpoints';
import type { SearchDoc } from '../core/api/types';
import { useAuth } from '../core/auth/auth';
import { useToast } from '../components/common/useToast';
import { ObjectCard } from '../components/discovery/ObjectCard';
import { ApiError } from '../core/api/client';
import '../components/discovery/discovery.css';

/** Anchor kinds (Frontend Spec §5.7). v1 routes all three through text search; the
 *  segmented control sets the placeholder + an intent hint the user can refine. */
type AnchorKind = 'taxon' | 'place' | 'evidence';
const ANCHORS: { k: AnchorKind; label: string; hint: string }[] = [
  { k: 'taxon', label: 'Taxon', hint: 'e.g. Conophytum, Aizoaceae' },
  { k: 'place', label: 'Place', hint: 'locality, QDS, region' },
  { k: 'evidence', label: 'Evidence', hint: 'specimen, sequence, dataset' },
];

type TierFilter = 'both' | 'commons' | 'journal';
const KO_TYPES = ['treatment', 'micro-observation', 'dataset', 'report', 'article', 'review', 'method', 'comment', 'synthesis'];
const STATUSES = ['reviewed', 'vor', 'verified', 'raw', 'superseded', 'retracted'];

export function Discovery() {
  const { principal } = useAuth();
  const { flash, node: toastNode } = useToast();

  const [anchor, setAnchor] = useState<AnchorKind>('taxon');
  const [text, setText] = useState('');
  const [tier, setTier] = useState<TierFilter>('both');
  const [koType, setKoType] = useState('');
  const [status, setStatus] = useState('');
  const [restricted, setRestricted] = useState(false);

  // editor/steward may toggle the restricted index (role-gated server-side, surfaced on 403).
  const roles = principal?.roles ?? [];
  const mayRestrict = roles.includes('editor') || roles.includes('steward');
  const index: 'public' | 'restricted' = restricted && mayRestrict ? 'restricted' : 'public';

  const query = useMemo(
    () => ({ text: text.trim() || undefined, koType: koType || undefined, status: status || undefined, index }),
    [text, koType, status, index],
  );
  const key = `${query.text ?? ''}|${query.koType ?? ''}|${query.status ?? ''}|${query.index}`;

  const searchQ = useQuery({
    queryKey: qk.search(key),
    queryFn: () => ep.search(query),
    placeholderData: keepPreviousData,
  });

  // Tier is filtered client-side (the search API exposes text/koType/status/index).
  const docs: SearchDoc[] = useMemo(() => {
    const all = searchQ.data ?? [];
    return tier === 'both' ? all : all.filter((d) => d.tier === tier);
  }, [searchQ.data, tier]);

  const errStatus = searchQ.error instanceof ApiError ? searchQ.error.status : undefined;
  const restrictedDenied = errStatus === 403;

  const toggleRestricted = () => {
    if (!mayRestrict) {
      flash('Restricted index is limited to editors and stewards.');
      return;
    }
    setRestricted((r) => !r);
  };

  return (
    <div className="jose-page">
      <h1>Explore</h1>
      <p className="lede">Browse the graph by taxon, place, or evidence — filtered by type, status, and tier. Not a feed.</p>

      {/* Anchor row */}
      <div className="jose-card">
        <h2>Anchor</h2>
        <div className="disc-anchor">
          <div className="disc-searchbox">
            <span className="ic" aria-hidden>⌕</span>
            <input
              type="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={ANCHORS.find((a) => a.k === anchor)?.hint}
              aria-label="Search text"
            />
          </div>
          <div className="disc-kind" role="group" aria-label="Anchor kind">
            {ANCHORS.map((a) => (
              <button
                key={a.k}
                type="button"
                aria-pressed={anchor === a.k}
                onClick={() => setAnchor(a.k)}
              >
                <span className="ki" aria-hidden />{a.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="jose-card">
        <h2>Filters</h2>
        <div className="disc-filters">
          <div className="jose-field">
            <label htmlFor="disc-tier">Tier</label>
            <select id="disc-tier" value={tier} onChange={(e) => setTier(e.target.value as TierFilter)}>
              <option value="both">Both</option>
              <option value="journal">Journal</option>
              <option value="commons">Commons</option>
            </select>
          </div>
          <div className="jose-field">
            <label htmlFor="disc-type">Type</label>
            <select id="disc-type" value={koType} onChange={(e) => setKoType(e.target.value)}>
              <option value="">Any type</option>
              {KO_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="jose-field">
            <label htmlFor="disc-status">Status</label>
            <select id="disc-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Any status</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="disc-index">
            <button
              type="button"
              className="jose-toggle"
              aria-pressed={index === 'restricted'}
              onClick={toggleRestricted}
              disabled={!mayRestrict}
              aria-label="Toggle restricted index"
              title={mayRestrict ? 'Search the restricted index (role-gated)' : 'Restricted index requires editor or steward role'}
            >
              <span className="box" />Restricted index
            </button>
            <span className="jose-mono">{mayRestrict ? `searching: ${index}` : 'public index'}</span>
          </div>
        </div>
      </div>

      {/* Count strip */}
      <div className="disc-count">
        {searchQ.isLoading ? 'Searching…' : `${docs.length} result${docs.length === 1 ? '' : 's'}`}
        {searchQ.isFetching && !searchQ.isLoading && <span className="jose-mono">updating…</span>}
        <span className="disc-non">finite list · no infinite scroll</span>
      </div>

      {/* Results */}
      {restrictedDenied ? (
        <div className="disc-err">
          <b>Restricted index not permitted</b>
          The server declined access to the restricted index (403). This index is gated to editors and stewards. Showing nothing — switch back to the public index to continue.
        </div>
      ) : searchQ.isError ? (
        <div className="disc-err">
          <b>Search failed</b>
          We couldn’t complete that search. Check your connection and try again, or adjust your filters.
          <button className="jose-btn" style={{ marginTop: 10 }} onClick={() => searchQ.refetch()}>Try again</button>
        </div>
      ) : searchQ.isLoading ? (
        <div className="jose-loading">Searching the graph…</div>
      ) : docs.length === 0 ? (
        <div className="disc-empty">
          No objects match these anchors and filters. Broaden the text, clear a filter, or pick a different anchor kind.
        </div>
      ) : (
        <div className="disc-grid">
          {docs.map((doc) => <ObjectCard key={doc.id} doc={doc} />)}
        </div>
      )}

      {toastNode}
    </div>
  );
}
