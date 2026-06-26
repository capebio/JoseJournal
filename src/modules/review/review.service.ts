import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PORTS, type ConsentRepo, type ReviewRepo } from '@core/ports';
import type { CoauthorConsent, ReviewerDisposition, ReviewThread } from '@core/types';
import { mintId } from '@core/ids';
import { ProvenanceService } from '@modules/provenance/provenance.service';

/** Co-author consent runway before a named-unconfirmed candidate lapses (§3.8). */
const CONSENT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Advisory reviewer↔subject relevance (§3.10). The real signal is an AI-assessed
 * score; v1 emits a deterministic stub in [0,1) so the field is populated and the
 * UI/relevance plumbing exists without coupling to a model. Never gates anything.
 */
function stubRelevanceScore(koId: string, reviewer: string): number {
  let h = 0;
  for (const ch of `${koId}|${reviewer}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h % 1000) / 1000;
}

/**
 * §3.10 / §7 continuous, transparent review. Dispositions are a traffic-light
 * (green/yellow/orange/red), reviewer identity is open, and orange/red findings
 * become RELEASE BLOCKERS until the author exercises their right-of-reply. Also
 * owns co-author consent: a named candidate starts 'named-unconfirmed' and must
 * affirmatively resolve. Every action is recorded in provenance.
 */
@Injectable()
export class ReviewService {
  constructor(
    @Inject(PORTS.ReviewRepo) private readonly reviews: ReviewRepo,
    @Inject(PORTS.ConsentRepo) private readonly consents: ConsentRepo,
    private readonly provenance: ProvenanceService,
  ) {}

  /**
   * §7 assign a reviewer — opens a ReviewThread in 'yellow' (under review) with an
   * empty comment and an advisory relevance score. Reviewer identity is open.
   */
  async addReviewer(koId: string, reviewer: string, actorRef: string): Promise<ReviewThread> {
    const thread: ReviewThread = {
      id: mintId('review'),
      koId,
      reviewer,
      relevanceScore: stubRelevanceScore(koId, reviewer),
      disposition: 'yellow',
      comment: '',
      authorReply: null,
      ts: new Date().toISOString(),
    };
    await this.reviews.create(thread);
    await this.provenance.record({
      subjectRef: koId,
      actorRef,
      actorRole: 'editor',
      action: 'reviewed',
      detail: { event: 'reviewer-assigned', threadId: thread.id, reviewer },
    });
    return thread;
  }

  /**
   * §7 submit/update a disposition + comment. With a threadId the reviewer's own
   * thread is updated in place; without one a fresh open thread is created. The
   * reviewer identity is the caller (open). Changing the disposition resets the
   * author reply so a prior reply can't silently clear a new orange/red finding.
   */
  async submitReview(
    koId: string,
    reviewer: string,
    disposition: ReviewerDisposition,
    comment: string,
    threadId?: string,
  ): Promise<ReviewThread> {
    let thread: ReviewThread | null = null;
    if (threadId) {
      thread = await this.reviews.get(threadId);
      if (!thread) throw new NotFoundException(`no review thread ${threadId}`);
    }
    if (thread) {
      const dispositionChanged = thread.disposition !== disposition;
      thread = {
        ...thread,
        reviewer,
        disposition,
        comment,
        authorReply: dispositionChanged ? null : thread.authorReply,
        ts: new Date().toISOString(),
      };
      await this.reviews.update(thread);
    } else {
      thread = {
        id: mintId('review'),
        koId,
        reviewer,
        relevanceScore: stubRelevanceScore(koId, reviewer),
        disposition,
        comment,
        authorReply: null,
        ts: new Date().toISOString(),
      };
      await this.reviews.create(thread);
    }
    await this.provenance.record({
      subjectRef: koId,
      actorRef: reviewer,
      actorRole: 'reviewer',
      action: 'reviewed',
      detail: { event: 'disposition', threadId: thread.id, disposition },
    });
    return thread;
  }

  /**
   * §7 author right-of-reply — required to exist for orange/red before release
   * (§9.6). Recorded against the thread's KO so the dialogue is fully provenanced.
   */
  async reply(koId: string, threadId: string, reply: string, actorRef: string): Promise<ReviewThread> {
    const existing = await this.reviews.get(threadId);
    if (!existing || existing.koId !== koId) throw new NotFoundException(`no review thread ${threadId} on ${koId}`);
    const updated: ReviewThread = { ...existing, authorReply: reply, ts: new Date().toISOString() };
    await this.reviews.update(updated);
    await this.provenance.record({
      subjectRef: koId,
      actorRef,
      actorRole: 'author',
      action: 'reviewed',
      detail: { event: 'author-reply', threadId },
    });
    return updated;
  }

  /** §7 read: all review threads for a KO (open identity; the Reader overlay + Review Panel). */
  listReviews(koId: string): Promise<ReviewThread[]> {
    return this.reviews.listForKo(koId);
  }

  /** §7 read: all co-author consents for a KO (named-unconfirmed surfaces here). */
  listCoauthors(koId: string): Promise<CoauthorConsent[]> {
    return this.consents.listForKo(koId);
  }

  /**
   * §9.6 release gate. Returns the threads that BLOCK a release: disposition is
   * orange or red AND the author has not yet replied. The orchestrator calls this
   * before allowing a release; a non-empty result means "blocked".
   */
  async releaseBlockers(koId: string): Promise<ReviewThread[]> {
    const threads = await this.reviews.listForKo(koId);
    return threads.filter(
      (t) => (t.disposition === 'orange' || t.disposition === 'red') && !(t.authorReply ?? '').trim(),
    );
  }

  /**
   * §7 name a co-author candidate. Consent starts 'named-unconfirmed' with a
   * 14-day deadline — nobody is silently enrolled as an author; the candidate must
   * affirmatively resolve their own state.
   */
  async addCoauthor(koId: string, candidate: string, actorRef: string): Promise<CoauthorConsent> {
    const now = Date.now();
    const consent: CoauthorConsent = {
      id: mintId('consent'),
      koId,
      candidate,
      state: 'named-unconfirmed',
      requestedAt: new Date(now).toISOString(),
      deadline: new Date(now + CONSENT_WINDOW_MS).toISOString(),
      resolvedAt: null,
    };
    await this.consents.create(consent);
    await this.provenance.record({
      subjectRef: koId,
      actorRef,
      actorRole: 'author',
      action: 'consent-requested',
      detail: { consentId: consent.id, candidate },
    });
    return consent;
  }

  /**
   * §7 the candidate resolves their consent (confirmed | declined | negotiating).
   * Stamps resolvedAt and records a 'consent-resolved' provenance event.
   */
  async respondCoauthor(
    consentId: string,
    response: 'confirmed' | 'declined' | 'negotiating',
    actorRef: string,
  ): Promise<CoauthorConsent> {
    const existing = await this.consents.get(consentId);
    if (!existing) throw new NotFoundException(`no consent ${consentId}`);
    const updated: CoauthorConsent = { ...existing, state: response, resolvedAt: new Date().toISOString() };
    await this.consents.update(updated);
    await this.provenance.record({
      subjectRef: existing.koId,
      actorRef,
      actorRole: 'contributor',
      action: 'consent-resolved',
      detail: { consentId, response },
    });
    return updated;
  }
}
