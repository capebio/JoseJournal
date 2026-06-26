import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import configuration from '@src/config/configuration';
import { PORTS, type ProvenanceRepo, type TaxonomyRepo } from '@core/ports';
import { PersistenceModule } from '@persistence/persistence.module';
import { ProvenanceModule } from '@modules/provenance/provenance.module';
import { TaxonomyModule } from './taxonomy.module';
import { TaxonomyService, type Actor } from './taxonomy.service';

/**
 * makeContext() (the shared harness) does not wire TaxonomyModule, so this spec
 * stands up its own deterministic in-memory context the same way: the global
 * PersistenceModule (PERSISTENCE=memory) + the global ProvenanceModule + the
 * module under test. No network, no Date.now reliance beyond new Date().
 */
async function makeTaxonomyContext(): Promise<TestingModule> {
  process.env.PERSISTENCE = 'memory';
  return Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, load: [configuration], ignoreEnvFile: true }),
      PersistenceModule.forRoot(),
      ProvenanceModule,
      TaxonomyModule,
    ],
  }).compile();
}

const STEWARD: Actor = { ref: 'acct:steward1', role: 'steward' };
const AUTHOR_A: Actor = { ref: 'acct:authorA', role: 'author' };
const AUTHOR_B: Actor = { ref: 'acct:authorB', role: 'author' };

describe('§9.7 Taxonomy / TDWG concept model (Name ≠ Taxon)', () => {
  let mod: TestingModule;
  let taxonomy: TaxonomyService;
  let repo: TaxonomyRepo;
  let provenance: ProvenanceRepo;

  beforeEach(async () => {
    mod = await makeTaxonomyContext();
    await mod.init();
    taxonomy = mod.get(TaxonomyService);
    repo = mod.get(PORTS.TaxonomyRepo);
    provenance = mod.get(PORTS.ProvenanceRepo);
  });
  afterEach(async () => mod.close());

  it('creates a name with the name: prefix and records provenance on the new id', async () => {
    const name = await taxonomy.createName({ nameString: 'Mesembryanthemum', authorship: 'L.', rank: 'genus', code: 'ICN', actor: STEWARD });
    expect(name.id).toMatch(/^name:/);
    expect(name.nameString).toBe('Mesembryanthemum');
    expect(name.code).toBe('ICN');
    // unset optionals are normalised to null, not left undefined
    expect(name.nomStatus).toBeNull();
    expect(name.registration).toBeNull();

    const events = await provenance.listAllForSubject(name.id);
    expect(events.length).toBe(1);
    expect(events[0].action).toBe('created');
    expect(events[0].actorRef).toBe(STEWARD.ref);
  });

  it('creates a concept tied to its asserting sec treatment version', async () => {
    const name = await taxonomy.createName({ nameString: 'Lampranthus', actor: STEWARD });
    const concept = await taxonomy.createConcept({ nameId: name.id, secVersion: 'ver:sha256-aaa', actor: AUTHOR_A });
    expect(concept.id).toMatch(/^concept:/);
    expect(concept.nameId).toBe(name.id);
    expect(concept.secVersion).toBe('ver:sha256-aaa');

    const fetched = await taxonomy.getConcept(concept.id);
    expect(fetched.secVersion).toBe('ver:sha256-aaa');

    const events = await provenance.listAllForSubject(concept.id);
    expect(events.length).toBe(1);
    expect(events[0].detail).toMatchObject({ kind: 'taxon_concept', secVersion: 'ver:sha256-aaa' });
  });

  it('rejects a concept on a non-existent name', async () => {
    await expect(taxonomy.createConcept({ nameId: 'name:does-not-exist', secVersion: 'ver:sha256-x', actor: AUTHOR_A })).rejects.toThrow(/no such name/);
  });

  it('creates an assertion bound to a concept and defaults assertedBy to the actor', async () => {
    const name = await taxonomy.createName({ nameString: 'Drosanthemum', actor: STEWARD });
    const concept = await taxonomy.createConcept({ nameId: name.id, secVersion: 'ver:sha256-d', actor: AUTHOR_A });
    const assertion = await taxonomy.createAssertion({ conceptId: concept.id, subjectRef: 'obs:1234', actor: AUTHOR_A });
    expect(assertion.id).toMatch(/^assert:/);
    expect(assertion.conceptId).toBe(concept.id);
    expect(assertion.assertedBy).toBe(AUTHOR_A.ref);
    expect(assertion.evidenceRefs).toEqual([]);

    const events = await provenance.listAllForSubject(assertion.id);
    expect(events.length).toBe(1);
  });

  it('records a nomenclatural act on a name with the act: prefix', async () => {
    const name = await taxonomy.createName({ nameString: 'Ruschia', actor: STEWARD });
    const act = await taxonomy.createAct({ nameId: name.id, actType: 'new_combination', code: 'ICN', vorVersion: 'ver:sha256-proto', actor: STEWARD });
    expect(act.id).toMatch(/^act:/);
    expect(act.nameId).toBe(name.id);
    expect(act.actType).toBe('new_combination');
    expect(act.vorVersion).toBe('ver:sha256-proto');

    const events = await provenance.listAllForSubject(act.id);
    expect(events.length).toBe(1);
    expect(events[0].detail).toMatchObject({ kind: 'nomenclatural_act' });
  });

  // ── §9.7 acceptance: two treatments asserting DIFFERENT concepts for ONE name ──
  it('two treatments asserting different concepts on one name coexist — neither overwrites the other', async () => {
    const name = await taxonomy.createName({ nameString: 'Carpobrotus edulis', authorship: '(L.) N.E.Br.', actor: STEWARD });

    // Treatment A's circumscription (a broad concept) sec. its own version.
    const conceptA = await taxonomy.createConcept({
      nameId: name.id,
      secVersion: 'ver:sha256-treatmentA',
      circumscription: { scope: 'broad', includes: ['var. edulis', 'var. rubescens'] },
      actor: AUTHOR_A,
    });

    // Treatment B's competing circumscription (a narrow concept) sec. a DIFFERENT version.
    const conceptB = await taxonomy.createConcept({
      nameId: name.id,
      secVersion: 'ver:sha256-treatmentB',
      circumscription: { scope: 'narrow', includes: ['var. edulis'] },
      actor: AUTHOR_B,
    });

    // BOTH rows exist — they are distinct concepts on the same name.
    expect(conceptA.id).not.toBe(conceptB.id);

    // listConceptsForName returns 2 (§9.7): no last-writer-wins collapse.
    const competing = await taxonomy.listConceptsForName(name.id);
    expect(competing.length).toBe(2);
    expect(competing.map((c) => c.id).sort()).toEqual([conceptA.id, conceptB.id].sort());

    // Each is resolvable with its OWN sec treatment version, unmodified.
    const byId = new Map(competing.map((c) => [c.id, c]));
    expect(byId.get(conceptA.id)!.secVersion).toBe('ver:sha256-treatmentA');
    expect(byId.get(conceptB.id)!.secVersion).toBe('ver:sha256-treatmentB');

    // Direct resolution (GET /concepts/:id) yields each treatment's own view.
    expect((await taxonomy.getConcept(conceptA.id)).secVersion).toBe('ver:sha256-treatmentA');
    expect((await taxonomy.getConcept(conceptB.id)).secVersion).toBe('ver:sha256-treatmentB');

    // The repo agrees independently (no overwrite at the persistence layer).
    expect((await repo.listConceptsForName(name.id)).length).toBe(2);
  });

  it('returns an empty array of concepts for a name with none', async () => {
    const name = await taxonomy.createName({ nameString: 'Nameonly', actor: STEWARD });
    expect(await taxonomy.listConceptsForName(name.id)).toEqual([]);
  });

  it('GET /concepts/:id on a missing concept throws not-found', async () => {
    await expect(taxonomy.getConcept('concept:nope')).rejects.toThrow(/no such concept/);
  });
});
