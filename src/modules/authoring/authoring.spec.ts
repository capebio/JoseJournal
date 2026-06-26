import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import configuration from '@src/config/configuration';
import { PersistenceModule } from '@persistence/persistence.module';
import { ProvenanceModule } from '@modules/provenance/provenance.module';
import { ProvenanceService } from '@modules/provenance/provenance.service';
import { AuthoringService } from './authoring.service';
import { AuthoringModule } from './authoring.module';

/**
 * makeContext() wires the base modules but not AuthoringModule, so we build an
 * equivalent in-memory DI context here (still deterministic, service-free).
 * PersistenceModule and ProvenanceModule are @Global, so AuthoringModule reaches
 * the AiDeclarationRepo port and ProvenanceService without extra imports.
 */
async function makeAuthoringContext(): Promise<TestingModule> {
  process.env.PERSISTENCE = 'memory';
  return Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, load: [configuration], ignoreEnvFile: true }),
      PersistenceModule.forRoot(),
      ProvenanceModule,
      AuthoringModule,
    ],
  }).compile();
}

const ACTOR = 'acct:author1';

describe('§9.8 Authoring / AI provenance declaration', () => {
  let mod: TestingModule;
  let authoring: AuthoringService;
  let provenance: ProvenanceService;

  beforeEach(async () => {
    mod = await makeAuthoringContext();
    await mod.init();
    authoring = mod.get(AuthoringService);
    provenance = mod.get(ProvenanceService);
  });
  afterEach(async () => mod.close());

  it("an on-platform 'recorded' declaration is stored, surfaced, and marked authoritative", async () => {
    const koId = 'ko:recorded';
    await authoring.declare({ koId, coverage: 'recorded', role: 'drafting', model: 'gpt-x', percentage: 42, actorRef: ACTOR });

    const stored = await authoring.getForKo(koId);
    expect(stored).not.toBeNull();
    expect(stored!.coverage).toBe('recorded');
    expect(stored!.percentage).toBe(42); // honoured under 'recorded'
    expect(stored!.accountableHuman).toBe(ACTOR); // defaults to the caller
    expect(stored!.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // provenance: an AI authorship event was written for the KO.
    const events = await provenance.allForSubject(koId);
    const aiGen = events.find((e) => e.action === 'ai-generated');
    expect(aiGen).toBeDefined();
    expect(aiGen!.actorRole).toBe('ai');
    expect(aiGen!.detail.coverage).toBe('recorded');
    expect(aiGen!.detail.model).toBe('gpt-x');
  });

  it("an 'estimated' declaration is labelled inferred and never forensic", async () => {
    const koId = 'ko:estimated';
    await authoring.declare({ koId, coverage: 'estimated', role: 'drafting', model: 'guess-detector', percentage: 80, actorRef: ACTOR });

    const stored = await authoring.getForKo(koId);
    expect(stored!.coverage).toBe('estimated');
    // The label is applied at the read boundary (controller); assert the service
    // stored an estimate with no admissible percentage.
    expect(stored!.percentage).toBeNull(); // §9.8 — only 'recorded' may carry a percentage
  });

  it("a percentage is rejected (nulled) unless coverage is 'recorded'", async () => {
    const attested = await authoring.declare({ koId: 'ko:attested', coverage: 'attested', role: 'editing', percentage: 55, actorRef: ACTOR });
    expect(attested.percentage).toBeNull(); // attested cannot substantiate a number

    const estimated = await authoring.declare({ koId: 'ko:est', coverage: 'estimated', role: 'editing', percentage: 99, actorRef: ACTOR });
    expect(estimated.percentage).toBeNull();

    const recorded = await authoring.declare({ koId: 'ko:rec', coverage: 'recorded', role: 'editing', percentage: 30, actorRef: ACTOR });
    expect(recorded.percentage).toBe(30); // only instrumented 'recorded' keeps it

    // a non-drafting role records 'ai-edited'
    const events = await provenance.allForSubject('ko:rec');
    expect(events.some((e) => e.action === 'ai-edited')).toBe(true);
  });

  it('a custom accountableHuman is honoured; otherwise the caller is used', async () => {
    const withHuman = await authoring.declare({ koId: 'ko:h1', coverage: 'attested', role: 'drafting', accountableHuman: 'acct:supervisor', actorRef: ACTOR });
    expect(withHuman.accountableHuman).toBe('acct:supervisor');

    const withoutHuman = await authoring.declare({ koId: 'ko:h2', coverage: 'attested', role: 'drafting', actorRef: ACTOR });
    expect(withoutHuman.accountableHuman).toBe(ACTOR);
  });
});
