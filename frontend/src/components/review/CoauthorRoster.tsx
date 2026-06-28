import { useState } from 'react';
import type { CoauthorConsent } from '../../core/api/types';

const STATE_LABEL: Record<CoauthorConsent['state'], string> = {
  'named-unconfirmed': 'named · unconfirmed',
  confirmed: 'confirmed',
  declined: 'declined',
  negotiating: 'negotiating',
};

interface Props {
  coauthors: CoauthorConsent[];
  /** principal is the author/editor and may add candidates */
  canAdd: boolean;
  /** the principal's own account id, to surface respond controls on their own candidacy */
  selfAccountId?: string;
  onAdd: (candidate: string) => Promise<void>;
  onRespond: (id: string, response: 'confirmed' | 'declined' | 'negotiating') => Promise<void>;
}

export function CoauthorRoster({ coauthors, canAdd, selfAccountId, onAdd, onRespond }: Props) {
  const [candidate, setCandidate] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!candidate.trim()) return;
    setBusy(true);
    try {
      await onAdd(candidate.trim());
      setCandidate('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="jose-card">
      <h2>Co-authors</h2>
      {coauthors.length === 0 && <div className="jose-revempty">No co-authors named yet.</div>}

      {coauthors.map((c) => {
        const isCandidate = !!selfAccountId && c.candidate === selfAccountId;
        const pending = c.state === 'named-unconfirmed' || c.state === 'negotiating';
        return (
          <div key={c.id} className="jose-coauthor">
            <span className="id">{c.candidate.replace('acct:', '')}</span>
            <span className={`cstate ${c.state}`} title={c.state === 'named-unconfirmed' ? 'Named by the author — consent not yet given' : undefined}>
              {STATE_LABEL[c.state]}
            </span>
            {isCandidate && pending && (
              <span className="resp">
                <button type="button" onClick={() => onRespond(c.id, 'confirmed')}>Confirm</button>
                <button type="button" onClick={() => onRespond(c.id, 'negotiating')}>Negotiate</button>
                <button type="button" onClick={() => onRespond(c.id, 'declined')}>Decline</button>
              </span>
            )}
          </div>
        );
      })}

      {canAdd && (
        <div className="jose-field" style={{ marginTop: 14, marginBottom: 0 }}>
          <label htmlFor="coauthor-add">Add co-author</label>
          <div className="jose-row">
            <input
              id="coauthor-add"
              value={candidate}
              onChange={(e) => setCandidate(e.target.value)}
              placeholder="acct:smith"
              style={{ flex: 1, minWidth: 160 }}
              onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
            />
            <button type="button" className="jose-btn" onClick={add} disabled={busy || !candidate.trim()}>
              {busy ? 'Adding…' : 'Add'}
            </button>
          </div>
          <div className="jose-revhint" style={{ margin: '6px 0 0' }}>
            Added as <span className="jose-mono" style={{ fontSize: 11 }}>named-unconfirmed</span> — they must consent before it counts.
          </div>
        </div>
      )}
    </div>
  );
}
