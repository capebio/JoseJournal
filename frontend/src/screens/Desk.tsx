import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import * as ep from '../core/api/endpoints';
import { useAuth } from '../core/auth/auth';
import type { DeskLifecycle, DeskView } from '../core/api/types';
import '../components/desk/desk.css';

/**
 * M7 Desk (Frontend Spec §10) — the front door / default view. Four regions over
 * live per-user state: objects by lifecycle, an attention queue, quick actions,
 * and an activity feed from the audit ledger. Read-only aggregation + routing.
 */

const LIFECYCLE: Array<{ key: DeskLifecycle; label: string }> = [
  { key: 'published', label: 'Published · living' },
  { key: 'under-review', label: 'Under review' },
  { key: 'draft', label: 'Drafts' },
];

const ATTENTION_ICON: Record<string, string> = { 'review-reply': '◷', 'coauthor-confirm': '◑', 'verify-obs': '◰' };

const FEED_VERB: Record<string, string> = {
  'release-vor': 'Released a Version of Record',
  'grant-issued': 'Issued a precise-access grant',
  'grant-revoked': 'Revoked a precise-access grant',
  retract: 'Retracted a version',
  'release-commons': 'Published to Commons',
};
const verb = (action: string) => FEED_VERB[action] ?? action.replace(/-/g, ' ');
const shorten = (ref: string) => (ref.length > 26 ? `${ref.slice(0, 24)}…` : ref);

export function Desk() {
  const { principal } = useAuth();
  const deskQ = useQuery({ queryKey: ['desk', principal?.accountId], queryFn: ep.getDesk, enabled: !!principal });

  if (!principal) {
    return (
      <div className="jose-page desk">
        <h1>Desk</h1>
        <p className="lede">Your working surface. Sign in (dev sign-in in the left nav) to see your objects, what needs you, and recent activity.</p>
        <section className="jose-card">
          <h2>Meanwhile</h2>
          <div className="desk-actions">
            <Link className="jose-btn" to="/reader">❑ Open the flagship treatment</Link>
            <Link className="jose-btn" to="/explore">◎ Explore the graph</Link>
          </div>
        </section>
      </div>
    );
  }

  if (deskQ.isLoading) return <div className="jose-loading">Loading your desk…</div>;
  if (deskQ.isError || !deskQ.data) return <div className="jose-stub"><h2>Desk unavailable</h2><p className="jose-mono">{principal.accountId}</p></div>;
  const d = deskQ.data as DeskView;

  return (
    <div className="jose-page desk">
      <h1>Desk</h1>
      <p className="lede">Your objects, what needs you, and recent activity — for {principal.accountId.replace('acct:', '')}.</p>

      <div className="desk-stats">
        <div className="desk-stat"><b>{d.stats.objects}</b><span>objects</span></div>
        <div className="desk-stat"><b>{d.stats.published}</b><span>published</span></div>
        <div className="desk-stat"><b>{d.stats.underReview}</b><span>under review</span></div>
        <div className={`desk-stat ${d.stats.attention > 0 ? 'red' : ''}`}><b>{d.stats.attention}</b><span>need you</span></div>
      </div>

      <div className="desk-grid">
        <div className="desk-col">
          <section className="jose-card desk-attention">
            <h2>Needs your attention</h2>
            {d.attention.length === 0 ? (
              <p className="desk-empty">Nothing is waiting on you right now.</p>
            ) : (
              d.attention.map((a, i) => (
                <Link key={`${a.koId}-${a.kind}-${i}`} to={a.route} className="desk-att">
                  <span className="ic" aria-hidden>{ATTENTION_ICON[a.kind] ?? '•'}</span>
                  <span className="body">
                    <span className="t">{a.title || '(untitled)'}</span>
                    <span className="s">{a.detail}</span>
                  </span>
                  <span className="go" aria-hidden>→</span>
                </Link>
              ))
            )}
          </section>

          {LIFECYCLE.map(({ key, label }) => {
            const items = d.objects.filter((o) => o.lifecycle === key);
            if (items.length === 0) return null;
            return (
              <section className="jose-card" key={key}>
                <h2>{label}</h2>
                {items.map((o) => (
                  <Link key={o.koId} to={`/ko/${encodeURIComponent(o.koId)}`} className="desk-obj">
                    <span className="t">{o.title || '(untitled)'}</span>
                    <span className="m">
                      <span className={`desk-pill ${o.tier === 'journal' ? 'journal' : ''}`}>{o.tier === 'journal' ? 'Journal' : 'Commons'}</span>
                      <span className="status">{o.status}</span>
                    </span>
                  </Link>
                ))}
              </section>
            );
          })}
          {d.objects.length === 0 && (
            <section className="jose-card">
              <h2>Your objects</h2>
              <p className="desk-empty">No objects yet — start a manuscript or capture an observation.</p>
            </section>
          )}
        </div>

        <div className="desk-col side">
          <section className="jose-card">
            <h2>Quick actions</h2>
            <div className="desk-actions">
              <Link className="jose-btn" to="/builder">✎ New manuscript</Link>
              <Link className="jose-btn" to="/capture">✛ Capture observation</Link>
              <Link className="jose-btn" to="/explore">◎ Explore</Link>
            </div>
          </section>

          <section className="jose-card">
            <h2>Recent activity</h2>
            {d.feed.length === 0 ? (
              <p className="desk-empty">No recorded activity yet.</p>
            ) : (
              <ul className="desk-feed">
                {d.feed.map((f) => (
                  <li key={f.id}>
                    <span className="act">{verb(f.action)}</span>
                    {f.objectRef && <span className="ref jose-mono">{shorten(f.objectRef)}</span>}
                    <span className="ts">{f.ts.slice(0, 10)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
