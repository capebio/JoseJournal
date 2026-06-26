import { useState } from 'react';

interface Props {
  onNominate: (reviewer: string) => Promise<void>;
}

/** Author/editor names a reviewer — open identity, attributable (§5.4). */
export function NominateReviewer({ onNominate }: Props) {
  const [reviewer, setReviewer] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reviewer.trim()) return;
    setBusy(true);
    try {
      await onNominate(reviewer.trim());
      setReviewer('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="jose-field" style={{ marginBottom: 0 }}>
      <label htmlFor="nominate-reviewer">Nominate reviewer</label>
      <div className="jose-row">
        <input
          id="nominate-reviewer"
          value={reviewer}
          onChange={(e) => setReviewer(e.target.value)}
          placeholder="acct:smith"
          style={{ flex: 1, minWidth: 160 }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        />
        <button type="button" className="jose-btn" onClick={submit} disabled={busy || !reviewer.trim()}>
          {busy ? 'Nominating…' : 'Nominate'}
        </button>
      </div>
    </div>
  );
}
