import { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '../core/query/queryClient';
import * as ep from '../core/api/endpoints';
import type { ReviewerDisposition } from '../core/api/types';
import { useAuth } from '../core/auth/auth';
import { useSeed } from '../core/seed';
import { useToast } from '../components/common/useToast';
import { ReviewThreadCard } from '../components/review/ReviewThreadCard';
import { CoauthorRoster } from '../components/review/CoauthorRoster';
import { NominateReviewer } from '../components/review/NominateReviewer';
import { ReleaseButton } from '../components/review/ReleaseButton';
import '../components/review/review.css';

/**
 * FE5 — Review Panel (Frontend Spec §5.4, §7 F5, AC 11.6).
 * Continuous transparent review: open-identity dispositions, advisory relevance,
 * author replies, co-author consent, and the §9.6 release gate made visible.
 */
export function ReviewPanel() {
  const params = useParams();
  const seed = useSeed();
  const koId = params.koId ?? seed?.koId ?? '';

  const { principal } = useAuth();
  const { flash, node: toastNode } = useToast();
  const qc = useQueryClient();

  const roles = principal?.roles ?? [];
  const isAuthor = roles.includes('author') || roles.includes('contributor');
  const isEditor = roles.includes('editor') || roles.includes('steward');
  const isReviewer = roles.includes('reviewer');
  const canManage = isAuthor || isEditor; // nominate, add co-author
  const canReply = isAuthor || isEditor; // reply to threads
  const canRelease = isAuthor || isEditor;

  const reviewsQ = useQuery({ queryKey: qk.reviews(koId), queryFn: () => ep.getReviews(koId), enabled: !!koId });
  const coauthorsQ = useQuery({ queryKey: qk.coauthors(koId), queryFn: () => ep.getCoauthors(koId), enabled: !!koId });

  const reviews = reviewsQ.data ?? [];
  const coauthors = coauthorsQ.data ?? [];

  const invalidateReviews = useCallback(() => qc.invalidateQueries({ queryKey: qk.reviews(koId) }), [qc, koId]);
  const invalidateCoauthors = useCallback(() => qc.invalidateQueries({ queryKey: qk.coauthors(koId) }), [qc, koId]);

  // ── mutations (await + try/catch + toast; surface 403 clearly) ──────────────
  const nominate = useCallback(async (reviewer: string) => {
    try {
      await ep.nominateReviewer(koId, reviewer);
      flash(`Nominated ${reviewer.replace('acct:', '')}`);
      await invalidateReviews();
    } catch (e) {
      flash(actionError(e, 'nominate a reviewer'));
    }
  }, [koId, flash, invalidateReviews]);

  const submitReview = useCallback(async (threadId: string, disposition: ReviewerDisposition, comment: string) => {
    try {
      // empty threadId → new thread; the backend creates one (omit the field)
      await ep.submitReview(koId, { ...(threadId ? { threadId } : {}), disposition, comment });
      flash('Disposition recorded');
      await invalidateReviews();
    } catch (e) {
      flash(actionError(e, 'submit a review'));
    }
  }, [koId, flash, invalidateReviews]);

  const reply = useCallback(async (threadId: string, text: string) => {
    try {
      await ep.replyReview(koId, threadId, text);
      flash('Reply posted');
      await invalidateReviews();
    } catch (e) {
      flash(actionError(e, 'reply'));
    }
  }, [koId, flash, invalidateReviews]);

  const addCoauthor = useCallback(async (candidate: string) => {
    try {
      await ep.addCoauthor(koId, candidate);
      flash(`Named ${candidate.replace('acct:', '')} (unconfirmed)`);
      await invalidateCoauthors();
    } catch (e) {
      flash(actionError(e, 'add a co-author'));
    }
  }, [koId, flash, invalidateCoauthors]);

  const respondCoauthor = useCallback(async (id: string, response: 'confirmed' | 'declined' | 'negotiating') => {
    try {
      await ep.respondCoauthor(koId, id, response);
      flash(`Marked ${response}`);
      await invalidateCoauthors();
    } catch (e) {
      flash(actionError(e, 'respond'));
    }
  }, [koId, flash, invalidateCoauthors]);

  if (!koId) {
    return <div className="jose-stub"><h2>No object selected</h2><p>Open the review panel from a treatment.</p></div>;
  }
  if (reviewsQ.isLoading) return <div className="jose-loading">Loading review threads…</div>;
  if (reviewsQ.isError) {
    const status = (reviewsQ.error as { status?: number })?.status;
    return (
      <div className="jose-stub">
        <h2>{status === 403 ? 'Not permitted' : 'Review unavailable'}</h2>
        <p className="jose-mono">{koId}</p>
      </div>
    );
  }

  return (
    <div className="jose-page">
      <div className="jose-meta">
        <span className="jose-badge">Continuous review</span>
        <span className="jose-mono">{koId}</span>
      </div>
      <h1>Review &amp; consent</h1>
      <p className="lede">
        Review is open and attributable — dispositions stay visible, relevance is advisory, and an author reply is
        required to clear every orange or red thread before release (§9.6).
      </p>

      <div className="jose-revpanel">
        {/* ── threads ─────────────────────────────────────────────────── */}
        <div>
          <div className="jose-h">Reviewer dispositions</div>
          {reviews.length === 0 ? (
            <div className="jose-revempty">No reviews yet. {canManage ? 'Nominate a reviewer to begin.' : ''}</div>
          ) : (
            reviews.map((t) => (
              <ReviewThreadCard
                key={t.id}
                thread={t}
                canReview={isReviewer}
                canReply={canReply}
                onSubmitReview={submitReview}
                onReply={reply}
              />
            ))
          )}

          {isReviewer && (
            <div className="jose-card" style={{ marginTop: 16 }}>
              <h3>Open a new thread</h3>
              <p className="jose-revhint">As a reviewer you can also start a thread directly on the object.</p>
              <NewThread onSubmit={submitReview} />
            </div>
          )}
        </div>

        {/* ── side rail ───────────────────────────────────────────────── */}
        <div>
          {canManage && (
            <div className="jose-card">
              <h3>Reviewers</h3>
              <NominateReviewer onNominate={nominate} />
            </div>
          )}

          <CoauthorRoster
            coauthors={coauthors}
            canAdd={canManage}
            selfAccountId={principal?.accountId}
            onAdd={addCoauthor}
            onRespond={respondCoauthor}
          />

          <ReleaseButton
            koId={koId}
            reviews={reviews}
            coauthors={coauthors}
            canRelease={canRelease}
            flash={flash}
            onReleased={() => { invalidateReviews(); qc.invalidateQueries({ queryKey: qk.history(koId) }); }}
          />
        </div>
      </div>

      {toastNode}
    </div>
  );
}

/** A reviewer opens a brand-new thread (no threadId → server creates one). */
function NewThread({ onSubmit }: { onSubmit: (threadId: string, d: ReviewerDisposition, c: string) => Promise<void> }) {
  return (
    <ReviewThreadCard
      thread={{ id: '', koId: '', reviewer: 'you', disposition: 'yellow', comment: '', ts: '' }}
      canReview
      canReply={false}
      onSubmitReview={(_id, d, c) => onSubmit('', d, c)}
      onReply={async () => {}}
    />
  );
}

/** Map a thrown ApiError into a human action message, calling out 403/409. */
function actionError(e: unknown, action: string): string {
  const status = (e as { status?: number })?.status;
  if (status === 403) return `Not permitted to ${action}.`;
  if (status === 409) return `Could not ${action} — conflicts with current state.`;
  const msg = (e as Error)?.message;
  return msg ? `Could not ${action}: ${msg}` : `Could not ${action}.`;
}
