import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CoauthorConsent, ReviewThread } from '../../core/api/types';
import * as ep from '../../core/api/endpoints';
import { isUnresolvedBlocker } from './ReviewThreadCard';

interface Props {
  koId: string;
  reviews: ReviewThread[];
  coauthors: CoauthorConsent[];
  /** principal may release (author/editor/steward) */
  canRelease: boolean;
  flash: (m: string) => void;
  /** let the parent refetch reviews/history after a successful release */
  onReleased?: () => void;
}

/**
 * Release-readiness card (Frontend Spec §5.4; prototype 3.jsx). Makes the §9.6
 * gate explicit: every orange/red thread needs an author reply (BLOCKS), while
 * named-unconfirmed co-authors are flagged on the record (WARN, never block).
 */
export function ReleaseButton({ koId, reviews, coauthors, canRelease, flash, onReleased }: Props) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [doi, setDoi] = useState<string | null>(null);
  const [released, setReleased] = useState(false);
  const [blockers, setBlockers] = useState<string[] | null>(null);

  const unresolved = reviews.filter(isUnresolvedBlocker);
  const gated = unresolved.length > 0;
  const unconfirmed = coauthors.filter((c) => c.state === 'named-unconfirmed');
  const disabled = busy || gated || !canRelease || released;

  const doRelease = async () => {
    setBusy(true);
    setBlockers(null);
    try {
      const { status, body } = await ep.release(koId, 'journal');
      if (status === 200 || status === 201) {
        if (body.doi) setDoi(body.doi);
        setReleased(true);
        flash(body.doi ? 'Released — DOI minted' : 'Released as Version of Record');
        onReleased?.();
      } else if (status === 409) {
        const list = Array.isArray(body.blockers) ? body.blockers.map((b) => (typeof b === 'string' ? b : JSON.stringify(b))) : [];
        setBlockers(list.length ? list : [body.message ?? 'Release is gated by open review threads.']);
        flash('Release gated — see blockers');
      } else if (status === 403) {
        setBlockers(['Not permitted to release this object.']);
        flash('Not permitted');
      } else {
        setBlockers([body.message ?? `Release failed (${status}).`]);
        flash('Release failed');
      }
    } catch (e) {
      setBlockers([(e as Error).message || 'Release failed.']);
      flash('Release failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rr-card">
      <h2 className="rr-h">Release readiness</h2>

      <div className={`rr-check ${gated ? 'no' : 'ok'}`}>
        <span className="mk">{gated ? '✗' : '✓'}</span>
        <span>{gated ? `${unresolved.length} reviewer ${unresolved.length === 1 ? 'comment needs' : 'comments need'} your reply` : 'All reviewer comments addressed'}</span>
      </div>
      {unconfirmed.length > 0 && (
        <div className="rr-check warn">
          <span className="mk">⚠</span>
          <span>{unconfirmed.length} co-author {unconfirmed.length === 1 ? 'is' : 'are'} named-unconfirmed — flagged on the record, not blocked.</span>
        </div>
      )}
      {!canRelease && (
        <div className="rr-check no"><span className="mk">✗</span><span>You do not have permission to release this object.</span></div>
      )}

      <button type="button" className="rr-btn" onClick={doRelease} disabled={disabled} aria-disabled={disabled}>
        {busy ? 'Releasing…' : released ? 'Released' : 'Release as Version of Record'}
      </button>
      <div className="rr-note">Mints a DOI · freezes a citable snapshot</div>

      {blockers && (
        <div className="blockers">
          <div>Server blocked the release:</div>
          <ul>{blockers.map((b, i) => <li key={i}>{b}</li>)}</ul>
        </div>
      )}

      {released && (
        <div className="rr-done">
          Released to the journal tier
          {doi && <span className="doi">DOI {doi}</span>}
          <button onClick={() => navigate(`/ko/${encodeURIComponent(koId)}`)}>Open the VoR in Reader →</button>
        </div>
      )}
    </div>
  );
}
