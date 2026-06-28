import { BadRequestException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import configuration from '@src/config/configuration';
import { PORTS, type KnowledgeObjectRepo } from '@core/ports';
import type { ObservationPublic } from '@core/types';
import { PersistenceModule } from '@persistence/persistence.module';
import { ProvenanceModule } from '@modules/provenance/provenance.module';
import { ProvenanceService } from '@modules/provenance/provenance.service';
import { KnowledgeObjectModule } from '@modules/knowledge-object/knowledge-object.module';
import { VersioningModule } from '@modules/versioning/versioning.module';
import { LocalityModule } from '@modules/locality/locality.module';
import { ObservationModule } from './observation.module';
import { ObservationService } from './observation.service';

/**
 * §9.2 (public micro-obs is citable; private content never public) and §9.5
 * (no precise leak) for the Observation module. Builds the same in-memory DI
 * context as the shared makeContext harness, plus ObservationModule.
 */
async function makeObservationContext(): Promise<TestingModule> {
  process.env.PERSISTENCE = 'memory';
  return Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, load: [configuration], ignoreEnvFile: true }),
      PersistenceModule.forRoot(),
      ProvenanceModule,
      KnowledgeObjectModule,
      VersioningModule,
      LocalityModule,
      ObservationModule,
    ],
  }).compile();
}

// A genuine South-African locality (Mesembryanthemum country): lat negative, lon positive.
const PRECISE = { lat: -33.9249, lon: 18.4241 };
const ACTOR = { ref: 'acct:contributor', role: 'contributor' as const };
const CURATOR = { ref: 'acct:editor', role: 'editor' as const };

describe('§9.2/§9.5 Observation / micro-observations', () => {
  let mod: TestingModule;
  let observations: ObservationService;
  let ko: KnowledgeObjectRepo;
  let provenance: ProvenanceService;

  beforeEach(async () => {
    mod = await makeObservationContext();
    await mod.init();
    observations = mod.get(ObservationService);
    ko = mod.get(PORTS.KnowledgeObjectRepo);
    provenance = mod.get(ProvenanceService);
  });
  afterEach(async () => mod.close());

  function createSensitive() {
    return observations.create({
      taxonConcept: 'concept:mesemb',
      lat: PRECISE.lat,
      lon: PRECISE.lon,
      sensitivity: 'highly-sensitive',
      source: { system: 'casabio', id: 'casabio:obs:1' },
      note: 'Single plant on a south-facing slope.',
      actor: ACTOR,
    });
  }

  it('elevates a Casabio observation to a citable public micro-observation KO that inherits its source id', async () => {
    const { koId, obsId, public: pub } = await createSensitive();

    const entity = await ko.getEntity(koId);
    expect(entity).not.toBeNull();
    expect(entity!.koType).toBe('micro-observation');
    expect(entity!.tier).toBe('commons');
    // inherits the source ref as its subject
    expect(entity!.subjectRefs).toEqual(['casabio:casabio:obs:1']);

    // the citable version is public (§9.2 — it can surface publicly)
    const tip = await ko.getVersion(entity!.refs.tip);
    expect(tip!.visibility).toBe('public');

    // the public projection exists and points back at the KO
    expect(pub.ko).toBe(koId);
    expect(obsId).toMatch(/^obs:/);
    const stored = await ko.getPublicProjection(`${obsId}:public`);
    expect(stored).not.toBeNull();
  });

  it('the public projection never carries a coordinate finer than QDS (§9.5 no precise leak)', async () => {
    const { obsId } = await createSensitive();
    const stored = (await ko.getPublicProjection(`${obsId}:public`)) as unknown as ObservationPublic;
    const json = JSON.stringify(stored);

    expect(stored.localityQDS).toMatch(/^[NS]\d{2}[EW]\d{3}[A-D]{2}$/);
    expect(json).not.toContain('33.9249');
    expect(json).not.toContain('18.4241');
    expect(json).not.toContain('"lat"');
    expect(json).not.toContain('"lon"');
  });

  it('accept sets verification=verified on the public projection', async () => {
    const { obsId } = await createSensitive();
    const before = (await ko.getPublicProjection(`${obsId}:public`)) as unknown as ObservationPublic;
    expect(before.verification).toBe('raw');

    const updated = await observations.decide({ obsId, decision: 'accept', actor: CURATOR });
    expect(updated.verification).toBe('verified');

    const reloaded = (await ko.getPublicProjection(`${obsId}:public`)) as unknown as ObservationPublic;
    expect(reloaded.verification).toBe('verified');

    const events = await provenance.allForSubject(obsId);
    expect(events.some((e) => e.action === 'reviewed' && e.detail.decision === 'accept')).toBe(true);
  });

  it('reject WITHOUT a comment throws BadRequestException and leaves the projection unchanged', async () => {
    const { obsId } = await createSensitive();
    await expect(observations.decide({ obsId, decision: 'reject', actor: CURATOR })).rejects.toThrow(BadRequestException);
    await expect(observations.decide({ obsId, decision: 'reject', comment: '   ', actor: CURATOR })).rejects.toThrow(BadRequestException);

    const reloaded = (await ko.getPublicProjection(`${obsId}:public`)) as unknown as ObservationPublic;
    expect(reloaded.verification).toBe('raw'); // untouched
  });

  it('reject WITH a comment sets verification=rejected and never leaks precise coordinates', async () => {
    const { obsId } = await createSensitive();
    const updated = await observations.decide({ obsId, decision: 'reject', comment: 'misidentified', actor: CURATOR });
    expect(updated.verification).toBe('rejected');

    const reloaded = (await ko.getPublicProjection(`${obsId}:public`)) as unknown as ObservationPublic;
    expect(reloaded.verification).toBe('rejected');
    const json = JSON.stringify(reloaded);
    expect(json).not.toContain('33.9249');
    expect(json).not.toContain('18.4241');
  });
});
