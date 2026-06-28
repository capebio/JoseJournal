import { Link } from 'react-router-dom';
import type { SnippetResolution } from '../../core/api/types';
import { DriftNotice } from './DriftNotice';

type View = 'snippet' | 'treatment';

/**
 * The resolved snippet card (Frontend Spec §5.6, AC 11.4). Renders the hardened
 * anchor, then either:
 *   - drift === false → the cited block with a "hash ok" assurance, or
 *   - drift === true  → a DriftNotice plus a side-by-side of the cited text (what
 *     was anchored) and currentBlock.text (what the treatment now says).
 *
 * The anchor is the load-bearing identity: versionId / sectionPath / blockId /
 * contentHash, all mono. Visual line numbers are NEVER the anchor.
 */
export function SnippetCard({
  resolution,
  view,
  onView,
}: {
  resolution: SnippetResolution;
  view: View;
  onView: (v: View) => void;
}) {
  const { drift, koId, snippet, block, citedText, currentBlock, note } = resolution;
  // What was cited (anchored) vs. what the treatment currently shows.
  const cited = citedText ?? block?.text ?? snippet.quotedText ?? '';
  const current = currentBlock?.text ?? '';
  const treatmentHref = `/ko/${encodeURIComponent(koId)}/v/${encodeURIComponent(snippet.versionId)}`;

  return (
    <div className="jose-card jose-snip">
      {/* View switch — radio-like, AC 11.4: snippet vs entire treatment */}
      <div className="jose-snip-views" role="radiogroup" aria-label="Snippet view">
        <button
          type="button"
          role="radio"
          aria-checked={view === 'snippet'}
          className={`jose-snip-view ${view === 'snippet' ? 'on' : ''}`}
          onClick={() => onView('snippet')}
        >
          <span className="r" aria-hidden>{view === 'snippet' ? '◉' : '○'}</span> View snippet
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={view === 'treatment'}
          className={`jose-snip-view ${view === 'treatment' ? 'on' : ''}`}
          onClick={() => onView('treatment')}
        >
          <span className="r" aria-hidden>{view === 'treatment' ? '◉' : '○'}</span> View entire treatment
        </button>
      </div>

      {/* Hardened anchor — the immutable identity (§3.9). Mono throughout. */}
      <div className="jose-anchor" aria-label="Hardened snippet anchor">
        version <b>{snippet.versionId}</b><br />
        section <b>§{snippet.sectionPath}</b><br />
        block <b>{snippet.blockId}</b><br />
        hash <b>{snippet.contentHash}</b>
        <div className="jose-anchor-note">Visual line numbers are never the anchor.</div>
      </div>

      {view === 'treatment' ? (
        <div className="jose-snip-treatment">
          <p className="jose-mono">
            This snippet anchors version <b>{snippet.versionId}</b>. Open the full living treatment
            at that immutable version:
          </p>
          <Link to={treatmentHref} className="jose-btn">Open treatment at this version →</Link>
          <p className="jose-snip-hint">
            The immutable version id is the durable handle — opening it pins the treatment to exactly this state.
          </p>
        </div>
      ) : drift ? (
        <>
          <DriftNotice note={note} />
          <div className="jose-snip-compare">
            <div className="jose-snip-side">
              <div className="jose-snip-lbl cited">As cited <span className="hash">contentHash {short(snippet.contentHash)}</span></div>
              <div className="jose-quote">“{cited || '—'}”</div>
            </div>
            <div className="jose-snip-side">
              <div className="jose-snip-lbl current">Current text {currentBlock ? <span className="hash">block {currentBlock.blockId}</span> : null}</div>
              <div className="jose-quote current">“{current || '—'}”</div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="jose-snip-ok" role="status"><span aria-hidden>✓ </span>hash ok — the cited block is unchanged.</div>
          <div className="jose-quote">“{cited || '—'}”</div>
          {note ? <p className="jose-snip-hint">{note}</p> : null}
        </>
      )}
    </div>
  );
}

function short(hash: string): string {
  return hash.length > 18 ? hash.slice(0, 18) + '…' : hash;
}
