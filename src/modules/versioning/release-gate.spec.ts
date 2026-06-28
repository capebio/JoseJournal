import { ConfigModule } from '@nestjs/config';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import configuration from '@src/config/configuration';
import { PersistenceModule } from '@persistence/persistence.module';
import { ProvenanceModule } from '@modules/provenance/provenance.module';
import { KnowledgeObjectModule } from '@modules/knowledge-object/knowledge-object.module';
import { LocalityModule } from '@modules/locality/locality.module';
import { ReviewModule } from '@modules/review/review.module';
import { KnowledgeObjectService } from '@modules/knowledge-object/knowledge-object.service';
import { ReviewService } from '@modules/review/review.service';
import { sampleContent } from '@src/test-support/make-context';
import type { Principal } from '@core/types';
import { VersioningModule } from './versioning.module';
import { VersioningController } from './versioning.controller';
import type { ReleaseDto } from '@modules/knowledge-object/knowledge-object.dto';

const CERT_AUTHOR: Principal = { sub: 'kc', accountId: 'acct:author', assurance: 'certified', roles: ['author'], orcid: null };

/**
 * §9.6 + D7 release gate exercised through the controller (the path the audit
 * flagged as untested): the disposition gate (409) AND the certified capability
 * floor on a Journal VoR.
 */
describe('§9.6 release gate (controller integration)', () => {
  let mod: TestingModule;
  let ctrl: VersioningController;
  let ko: KnowledgeObjectService;
  let review: ReviewService;

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
      ],
    }).compile();
    await mod.init();
    ctrl = mod.get(VersioningController);
    ko = mod.get(KnowledgeObjectService);
    review = mod.get(ReviewService);
  });
  afterEach(async () => mod.close());

  const release = (koId: string, user: Principal) => ctrl.release(koId, { tier: 'journal' } as ReleaseDto, user);

  it('refuses a Journal VoR while an orange disposition lacks a reply, then allows it once cleared', async () => {
    const { entity } = await ko.createKo({ koType: 'treatment', tier: 'commons', content: sampleContent(), visibility: 'public', actor: { ref: CERT_AUTHOR.accountId, role: 'author' } });
    const thread = await review.addReviewer(entity._id, 'acct:rev', CERT_AUTHOR.accountId);
    await review.submitReview(entity._id, 'acct:rev', 'orange', 'needs work', thread.id);

    await expect(release(entity._id, CERT_AUTHOR)).rejects.toBeInstanceOf(ConflictException);

    await review.reply(entity._id, thread.id, 'addressed in v2', CERT_AUTHOR.accountId);
    const res = (await release(entity._id, CERT_AUTHOR)) as { doi: string; version: { _id: string } };
    expect(res.doi).toBeTruthy();
    const e = await ko.getEntity(entity._id);
    expect(e!.refs.vor).toBe(res.version._id);
  });

  it('refuses a Journal VoR to a verified-but-not-certified actor (D7 capability floor)', async () => {
    const verified: Principal = { sub: 'kc2', accountId: 'acct:verified', assurance: 'verified', roles: ['author'], orcid: null };
    const { entity } = await ko.createKo({ koType: 'treatment', tier: 'commons', content: sampleContent(), visibility: 'public', actor: { ref: verified.accountId, role: 'author' } });
    await expect(release(entity._id, verified)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
