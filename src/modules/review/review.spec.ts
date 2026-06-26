import { TestingModule } from '@nestjs/testing';
import { PORTS, type ConsentRepo, type ReviewRepo } from '@core/ports';
import { ProvenanceService } from '@modules/provenance/provenance.service';
import { ReviewService } from './review.service';
import { makeContext } from '@src/test-support/make-context';

const KO = 'ko:flagship';
const REVIEWER = 'acct:reviewer1';
const AUTHOR = 'acct:author1';
const CANDIDATE = 'acct:candidate1';

describe('§9.6 Review / disposition gate + co-author consent', () => {
  let mod: TestingModule;
  let review: ReviewService;
  let reviews: ReviewRepo;
  let consents: ConsentRepo;
  let provenance: ProvenanceService;

  beforeEach(async () => {
    // makeContext wires the @Global PersistenceModule (ReviewRepo/ConsentRepo) and
    // ProvenanceModule; ReviewService is constructed against those real adapters.
    mod = await makeContext();
    await mod.init();
    reviews = mod.get(PORTS.ReviewRepo);
    consents = mod.get(PORTS.ConsentRepo);
    provenance = mod.get(ProvenanceService);
    review = new ReviewService(reviews, consents, provenance);
  });
  afterEach(async () => mod.close());

  it('an assigned reviewer opens a yellow thread with an empty comment and advisory relevance score', async () => {
    const thread = await review.addReviewer(KO, REVIEWER, AUTHOR);
    expect(thread.id).toMatch(/^review:/);
    expect(thread.disposition).toBe('yellow');
    expect(thread.comment).toBe('');
    expect(thread.relevanceScore).toBeGreaterThanOrEqual(0);
    expect(thread.relevanceScore).toBeLessThanOrEqual(1);
    const prov = await provenance.allForSubject(KO);
    expect(prov.some((e) => e.detail.event === 'reviewer-assigned')).toBe(true);
  });

  it('an orange disposition with no reply is a release blocker; after the author replies it is not', async () => {
    const thread = await review.submitReview(KO, REVIEWER, 'orange', 'Methods section needs more detail');
    let blockers = await review.releaseBlockers(KO);
    expect(blockers.map((t) => t.id)).toContain(thread.id);
    expect(blockers.length).toBeGreaterThan(0);

    await review.reply(KO, thread.id, 'Expanded the methods in v2.', AUTHOR);
    blockers = await review.releaseBlockers(KO);
    expect(blockers).toHaveLength(0);
  });

  it('a red disposition with no reply blocks; an empty/whitespace reply does not clear it', async () => {
    const thread = await review.submitReview(KO, REVIEWER, 'red', 'Claim contradicts cited evidence');
    expect((await review.releaseBlockers(KO)).map((t) => t.id)).toContain(thread.id);

    await review.reply(KO, thread.id, '   ', AUTHOR); // whitespace is not a real reply
    expect((await review.releaseBlockers(KO)).map((t) => t.id)).toContain(thread.id);
  });

  it('green/yellow dispositions never block a release', async () => {
    await review.submitReview(KO, REVIEWER, 'green', 'Looks solid');
    await review.submitReview(KO, 'acct:reviewer2', 'yellow', 'Under review');
    expect(await review.releaseBlockers(KO)).toHaveLength(0);
  });

  it('changing a disposition to orange resets a prior reply so the new finding re-blocks', async () => {
    const thread = await review.submitReview(KO, REVIEWER, 'orange', 'First concern');
    await review.reply(KO, thread.id, 'Addressed.', AUTHOR);
    expect(await review.releaseBlockers(KO)).toHaveLength(0);

    // The reviewer escalates the same thread to red after a new amendment.
    const escalated = await review.submitReview(KO, REVIEWER, 'red', 'New concern', thread.id);
    expect(escalated.authorReply).toBeNull();
    expect((await review.releaseBlockers(KO)).map((t) => t.id)).toContain(thread.id);
  });

  it('a co-author candidate who has not responded reads state named-unconfirmed with a deadline', async () => {
    const consent = await review.addCoauthor(KO, CANDIDATE, AUTHOR);
    expect(consent.id).toMatch(/^consent:/);
    expect(consent.state).toBe('named-unconfirmed');
    expect(consent.resolvedAt).toBeNull();
    expect(consent.deadline).toBeTruthy();

    const stored = await consents.get(consent.id);
    expect(stored!.state).toBe('named-unconfirmed');

    const prov = await provenance.allForSubject(KO);
    expect(prov.some((e) => e.action === 'consent-requested')).toBe(true);
  });

  it('a candidate response updates the consent state and stamps resolvedAt', async () => {
    const consent = await review.addCoauthor(KO, CANDIDATE, AUTHOR);
    const resolved = await review.respondCoauthor(consent.id, 'confirmed', CANDIDATE);
    expect(resolved.state).toBe('confirmed');
    expect(resolved.resolvedAt).toBeTruthy();

    const prov = await provenance.allForSubject(KO);
    expect(prov.some((e) => e.action === 'consent-resolved')).toBe(true);
  });
});
