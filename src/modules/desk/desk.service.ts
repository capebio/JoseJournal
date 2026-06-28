import { Inject, Injectable } from '@nestjs/common';
import { PORTS, type AuditRepo, type SearchPort } from '@core/ports';
import type { Principal } from '@core/types';
import { KnowledgeObjectService } from '@modules/knowledge-object/knowledge-object.service';
import { ReviewService } from '@modules/review/review.service';
import { LocalityService } from '@modules/locality/locality.service';

/**
 * M7 Desk — read-only per-user aggregation (SPEC-RECONCILED §10). No new domain
 * concepts: it enumerates objects via the search index and reads LIVE state from
 * the existing services (review release-blockers, co-author consent, observation
 * verification, the audit ledger). Resolving the underlying state (e.g. an author
 * reply that clears a thread) removes the corresponding Desk item on the next read.
 */
export type Lifecycle = 'draft' | 'under-review' | 'published';

export interface DeskObject { koId: string; title: string; lifecycle: Lifecycle; tier: string; status: string }
export interface DeskAttention { kind: 'review-reply' | 'coauthor-confirm' | 'verify-obs'; koId: string; title: string; detail: string; route: string }
export interface DeskFeedItem { id: number; ts: string; action: string; objectRef: string | null }
export interface DeskView {
  account: string;
  objects: DeskObject[];
  attention: DeskAttention[];
  feed: DeskFeedItem[];
  stats: { objects: number; published: number; underReview: number; attention: number };
}

function lifecycleOf(tier: string, status: string, hasVor: boolean): Lifecycle {
  if (hasVor || status === 'vor' || tier === 'journal') return 'published';
  if (status === 'reviewed' || status === 'verified') return 'under-review';
  return 'draft';
}

@Injectable()
export class DeskService {
  constructor(
    @Inject(PORTS.SearchPort) private readonly search: SearchPort,
    @Inject(PORTS.AuditRepo) private readonly audit: AuditRepo,
    private readonly ko: KnowledgeObjectService,
    private readonly review: ReviewService,
    private readonly locality: LocalityService,
  ) {}

  async forUser(principal: Principal): Promise<DeskView> {
    const me = principal.accountId;
    const canCurate = principal.roles.some((r) => r === 'author' || r === 'editor' || r === 'steward');

    // Enumerate candidate objects from the index (public + restricted; the latter
    // only surfaces objects the user authored, below — never leaks others' drafts).
    const docs = [...(await this.search.search({ index: 'public' })), ...(await this.search.search({ index: 'restricted' }))];
    const seen = new Set<string>();
    const objects: DeskObject[] = [];
    const attention: DeskAttention[] = [];

    for (const d of docs) {
      if (seen.has(d.koId)) continue;
      seen.add(d.koId);
      const entity = await this.ko.getEntity(d.koId);
      if (!entity) continue;
      const tip = entity.refs.tip ? await this.ko.getVersion(entity.refs.tip) : null;
      if (!tip) continue;
      const mine = tip.authors.includes(me);
      const title = tip.content.title;

      if (mine) {
        objects.push({ koId: d.koId, title, lifecycle: lifecycleOf(entity.tier, tip.status, !!entity.refs.vor), tier: entity.tier, status: tip.status });

        const blockers = await this.review.releaseBlockers(d.koId);
        if (blockers.length > 0) {
          attention.push({ kind: 'review-reply', koId: d.koId, title, detail: `${blockers.length} reviewer ${blockers.length === 1 ? 'thread needs' : 'threads need'} your reply before release`, route: `/review/${d.koId}` });
        }
        if (canCurate) {
          const pending = (await this.locality.map(d.koId)).filter((o) => o.verification === 'raw').length;
          if (pending > 0) attention.push({ kind: 'verify-obs', koId: d.koId, title, detail: `${pending} observation${pending === 1 ? '' : 's'} awaiting verification`, route: `/map/${d.koId}` });
        }
      }

      // Co-author confirmation owed by THIS user (whether or not they authored it).
      const consents = await this.review.listCoauthors(d.koId);
      if (consents.some((c) => c.candidate === me && (c.state === 'named-unconfirmed' || c.state === 'negotiating'))) {
        attention.push({ kind: 'coauthor-confirm', koId: d.koId, title, detail: 'Confirm or decline your named co-authorship', route: `/review/${d.koId}` });
      }
    }

    const feed: DeskFeedItem[] = (await this.audit.list({ actorRef: me }))
      .sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : b.id - a.id))
      .slice(0, 20)
      .map((e) => ({ id: e.id, ts: e.ts, action: e.action, objectRef: e.objectRef ?? null }));

    return {
      account: me,
      objects,
      attention,
      feed,
      stats: {
        objects: objects.length,
        published: objects.filter((o) => o.lifecycle === 'published').length,
        underReview: objects.filter((o) => o.lifecycle === 'under-review').length,
        attention: attention.length,
      },
    };
  }
}
