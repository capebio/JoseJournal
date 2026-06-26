import { Link } from 'react-router-dom';
import type { SearchDoc } from '../../core/api/types';

/** Display word for a version status (mirrors the Reader's vocabulary, IS §3). */
function statusWord(s: string): string {
  switch (s) {
    case 'vor': return 'Version of Record';
    case 'reviewed': return 'reviewed';
    case 'verified': return 'verified';
    case 'raw': return 'raw';
    case 'superseded': return 'superseded';
    case 'retracted': return 'retracted';
    default: return s;
  }
}

/**
 * A linked result card (Frontend Spec §5.7). Title, koType, status, and tier
 * badges; the whole card navigates into the Reader at /ko/:koId. The taxon/QDS
 * identifiers render in mono (§3 — identifiers are always mono).
 */
export function ObjectCard({ doc }: { doc: SearchDoc }) {
  const journal = doc.tier === 'journal';
  const restricted = doc.index === 'restricted';
  return (
    <Link
      className="disc-card"
      to={`/ko/${encodeURIComponent(doc.koId)}`}
      aria-label={`Open ${doc.title} — ${doc.koType}, ${statusWord(doc.status)}`}
    >
      <div className="disc-card-head">
        <span className="jose-badge">{doc.koType}</span>
        {journal ? <span className="jose-badge journal">Journal</span> : <span className="jose-badge">Commons</span>}
        {restricted && <span className="disc-restricted">restricted</span>}
      </div>
      <h3 className="disc-card-title">{doc.title || '(untitled)'}</h3>
      {doc.text && <p className="disc-card-snip">{doc.text.length > 180 ? doc.text.slice(0, 180) + '…' : doc.text}</p>}
      <div className="disc-card-foot">
        <span className={`disc-status s-${doc.status}`}>{statusWord(doc.status)}</span>
        {doc.taxon && <span className="jose-mono disc-taxon">{doc.taxon}</span>}
        {doc.localityQDS && <span className="jose-mono">{doc.localityQDS}</span>}
      </div>
    </Link>
  );
}
