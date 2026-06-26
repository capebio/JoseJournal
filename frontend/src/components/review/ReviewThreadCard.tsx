import { useState } from 'react';
import type { ReviewThread, ReviewerDisposition } from '../../core/api/types';

const DISPOSITIONS: ReviewerDisposition[] = ['green', 'yellow', 'orange', 'red'];

/** The human gloss for a disposition (mirrors Reader.tsx dispWord, §5.4). */
export function dispWord(d: ReviewerDisposition): string {
  return d === 'green'
    ? 'incorporated'
    : d === 'yellow'
      ? 'minor — not blocking'
      : d === 'orange'
        ? 'seen, not incorporated'
        : 'disagree';
}

/** A thread on an orange/red disposition with no author reply is a release blocker (AC 11.6). */
export function isUnresolvedBlocker(t: ReviewThread): boolean {
  return (t.disposition === 'orange' || t.disposition === 'red') && !t.authorReply;
}

interface Props {
  thread: ReviewThread;
  /** principal may act as the reviewer on this thread (has the 'reviewer' role) */
  canReview: boolean;
  /** principal is the author/editor and may reply */
  canReply: boolean;
  onSubmitReview: (threadId: string, disposition: ReviewerDisposition, comment: string) => Promise<void>;
  onReply: (threadId: string, reply: string) => Promise<void>;
}

export function ReviewThreadCard({ thread: t, canReview, canReply, onSubmitReview, onReply }: Props) {
  const [disp, setDisp] = useState<ReviewerDisposition>(t.disposition);
  const [comment, setComment] = useState(t.comment ?? '');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const orcid = t.reviewer.replace('acct:', '');
  const unresolved = isUnresolvedBlocker(t);
  // an author reply is only needed (the gate, §9.6) on orange/red threads
  const replyable = canReply && (t.disposition === 'orange' || t.disposition === 'red');

  const submitDisp = async () => {
    setBusy(true);
    try {
      await onSubmitReview(t.id, disp, comment.trim());
    } finally {
      setBusy(false);
    }
  };

  const submitReply = async () => {
    if (!reply.trim()) return;
    setBusy(true);
    try {
      await onReply(t.id, reply.trim());
      setReply('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`jose-rev ${t.disposition}`}>
      <div className="who">
        <span className="disp">{t.disposition} · {dispWord(t.disposition)}</span>
        <span className="orcid">{orcid}</span>
        {typeof t.relevanceScore === 'number' && (
          <span className="rel" title="advisory relevance — never gates">relevance {t.relevanceScore.toFixed(2)}</span>
        )}
      </div>
      <div className="note">{t.comment || '—'}</div>

      {t.authorReply && (
        <div className="reply"><b>Author reply:</b> {t.authorReply}</div>
      )}
      {unresolved && (
        <div className="needs-reply"><i />awaiting author reply — blocks release</div>
      )}

      {canReview && (
        <div className="act">
          <div className="seg" role="group" aria-label="Disposition">
            {DISPOSITIONS.map((d) => (
              <button
                key={d}
                type="button"
                className={`${d} ${disp === d ? 'on' : ''}`}
                aria-pressed={disp === d}
                onClick={() => setDisp(d)}
              >
                {d}
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Reviewer comment (open, attributable)…"
            aria-label="Reviewer comment"
          />
          <div className="arow">
            <button type="button" className="jose-btn primary" onClick={submitDisp} disabled={busy}>
              {busy ? 'Submitting…' : 'Submit disposition'}
            </button>
          </div>
        </div>
      )}

      {replyable && (
        <div className="act">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={t.authorReply ? 'Add to your reply…' : 'Author reply — required to clear this thread for release…'}
            aria-label="Author reply"
          />
          <div className="arow">
            <button type="button" className="jose-btn" onClick={submitReply} disabled={busy || !reply.trim()}>
              {busy ? 'Posting…' : t.authorReply ? 'Update reply' : 'Post reply'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
