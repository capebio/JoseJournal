import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import configuration from '@src/config/configuration';
import { PersistenceModule } from '@persistence/persistence.module';
import { ProvenanceModule } from '@modules/provenance/provenance.module';
import { KnowledgeObjectModule } from '@modules/knowledge-object/knowledge-object.module';
import { VersioningModule } from '@modules/versioning/versioning.module';
import { LocalityModule } from '@modules/locality/locality.module';
import { ReviewModule } from '@modules/review/review.module';
import { KnowledgeObjectService } from '@modules/knowledge-object/knowledge-object.service';
import { ReviewService } from '@modules/review/review.service';
import { VersioningService } from '@modules/versioning/versioning.service';
import { sampleContent } from '@src/test-support/make-context';
import type { Principal } from '@core/types';
import { DeskModule } from './desk.module';
import { DeskService } from './desk.service';

const AUTHOR: Principal = { sub: 'kc-a', accountId: 'acct:author1', assurance: 'certified', roles: ['author'], orcid: null };

describe('M7 Desk aggregation (§10)', () => {
  let mod: TestingModule;
  let ko: KnowledgeObjectService;
  let review: ReviewService;
  let versioning: VersioningService;
  let desk: DeskService;

  beforeEach(async () => {
    process.env.PERSISTENCE = 'memory';
    mod = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [configuration], ignoreEnvFile: true }),
        PersistenceModule.forRoot(),
        ProvenanceModule,
        KnowledgeObjectModule,
        VersioningModule,
        LocalityModule,
        ReviewModule,
        DeskModule,
      ],
    }).compile();
    await mod.init();
    ko = mod.get(KnowledgeObjectService);
    review = mod.get(ReviewService);
    versioning = mod.get(VersioningService);
    desk = mod.get(DeskService);
  });
  afterEach(async () => mod.close());

  it('lists the user objects + an attention item that clears when the author reply lands', async () => {
    const { entity } = await ko.createKo({ koType: 'treatment', content: sampleContent('My treatment'), actor: { ref: AUTHOR.accountId, role: 'author' }, visibility: 'public' });

    const thread = await review.addReviewer(entity._id, 'acct:rev', AUTHOR.accountId);
    await review.submitReview(entity._id, 'acct:rev', 'orange', 'needs work', thread.id); // orange + no reply = blocking

    let view = await desk.forUser(AUTHOR);
    expect(view.objects.some((o) => o.koId === entity._id)).toBe(true);
    const item = view.attention.find((a) => a.koId === entity._id && a.kind === 'review-reply');
    expect(item).toBeDefined();
    expect(item!.route).toBe(`/review/${entity._id}`);
    expect(view.stats.attention).toBeGreaterThanOrEqual(1);

    // The author exercises right-of-reply → the gate clears → the Desk item disappears.
    await review.reply(entity._id, thread.id, 'addressed in v2', AUTHOR.accountId);
    view = await desk.forUser(AUTHOR);
    expect(view.attention.some((a) => a.koId === entity._id && a.kind === 'review-reply')).toBe(false);
  });

  it('the feed is the audit ledger filtered to the user', async () => {
    const mine = await ko.createKo({ koType: 'treatment', tier: 'commons', content: sampleContent('mine'), actor: { ref: AUTHOR.accountId, role: 'author' }, visibility: 'public' });
    const myVor = await versioning.tagVoR(mine.entity._id, null, { ref: AUTHOR.accountId, role: 'author' });

    const theirs = await ko.createKo({ koType: 'treatment', tier: 'commons', content: sampleContent('theirs'), actor: { ref: 'acct:other', role: 'author' }, visibility: 'public' });
    await versioning.tagVoR(theirs.entity._id, null, { ref: 'acct:other', role: 'editor' });

    const view = await desk.forUser(AUTHOR);
    const release = view.feed.find((f) => f.action === 'release-vor');
    expect(release).toBeDefined();
    // it is OUR release, not the other actor's (the ledger is filtered by actorRef).
    expect(release!.objectRef).toBe(myVor.version._id);
  });
});
