import { TestingModule } from '@nestjs/testing';
import { PORTS, type KnowledgeObjectRepo } from '@core/ports';
import { computeVersionHash } from '@core/hash';
import { ProvenanceService } from '@modules/provenance/provenance.service';
import { KnowledgeObjectService } from '@modules/knowledge-object/knowledge-object.service';
import { VersioningService } from './versioning.service';
import { makeContext, sampleContent } from '@src/test-support/make-context';

const ACTOR = { ref: 'acct:author1', role: 'author' as const };

describe('§9.1 Versioning core (spike gate)', () => {
  let mod: TestingModule;
  let ko: KnowledgeObjectService;
  let versioning: VersioningService;
  let repo: KnowledgeObjectRepo;
  let provenance: ProvenanceService;

  beforeEach(async () => {
    mod = await makeContext();
    await mod.init();
    ko = mod.get(KnowledgeObjectService);
    versioning = mod.get(VersioningService);
    repo = mod.get(PORTS.KnowledgeObjectRepo);
    provenance = mod.get(ProvenanceService);
  });
  afterEach(async () => mod.close());

  it('a committed version is content-addressed and survives unrelated writes (compaction-independent)', async () => {
    const { entity, version } = await ko.createKo({ koType: 'treatment', content: sampleContent(), actor: ACTOR });

    // recomputed hash == ver id (identity is the content hash, not Couch _rev)
    const { versionId } = computeVersionHash(version.content, version);
    expect(versionId).toBe(version._id);

    // Many further commits (the moving tip advances) never alter the original doc.
    let base = version._id;
    for (let i = 0; i < 5; i++) {
      const v = await versioning.amend({
        koId: entity._id,
        baseVersionId: base,
        content: sampleContent(`edit ${i}`),
        actor: ACTOR,
        amendClass: 'substantive',
      });
      base = v._id;
    }
    const reloaded = await repo.getVersion(version._id);
    expect(reloaded).not.toBeNull();
    expect(computeVersionHash(reloaded!.content, reloaded!).versionId).toBe(version._id);
  });

  it('a VoR + DOI resolve byte-identically after the tip is amended N times', async () => {
    const { entity, version } = await ko.createKo({ koType: 'treatment', tier: 'commons', content: sampleContent(), visibility: 'public', actor: ACTOR });
    const { release, doi, version: vor } = await versioning.tagVoR(entity._id, version._id, { ref: 'acct:editor', role: 'editor' });

    const reloadedEntity = await repo.getEntity(entity._id);
    expect(reloadedEntity!.tier).toBe('journal'); // §9.2 graduation
    expect(reloadedEntity!.refs.vor).toBe(vor._id);

    // amend the living tip N times
    let base = vor._id;
    for (let i = 0; i < 4; i++) {
      const v = await versioning.amend({ koId: entity._id, baseVersionId: base, content: sampleContent(`post-vor ${i}`), actor: ACTOR, amendClass: 'substantive' });
      base = v._id;
    }

    const vorReloaded = await repo.getVersion(vor._id);
    expect(vorReloaded).not.toBeNull();
    expect(vorReloaded!.status).toBe('vor');
    expect(vorReloaded!.doi).toBe(doi);
    // recomputed hash of the VoR content+meta still equals the original ver id
    expect(computeVersionHash(vorReloaded!.content, vorReloaded!).versionId).toBe(vor._id);
    expect(release.versionId).toBe(vor._id);
  });

  it('amending the tip after a release does NOT move the frozen VoR pointer (M0 acceptance)', async () => {
    const { entity, version } = await ko.createKo({ koType: 'treatment', tier: 'commons', content: sampleContent(), visibility: 'public', actor: ACTOR });
    const { version: vor } = await versioning.tagVoR(entity._id, version._id, { ref: 'acct:editor', role: 'editor' });

    // After release the tip IS the vor version; amend it with no explicit status.
    const v3 = await versioning.amend({ koId: entity._id, baseVersionId: vor._id, content: sampleContent('post-release edit'), actor: ACTOR, amendClass: 'substantive' });

    const e = await repo.getEntity(entity._id);
    expect(e!.refs.tip).toBe(v3._id); // tip moves forward
    expect(e!.refs.vor).toBe(vor._id); // VoR pointer is UNCHANGED (the bug was it followed the tip)
    expect(v3.status).not.toBe('vor'); // the amended version is not a second, DOI-less "vor"
    expect(v3.doi).toBeNull();
  });

  it('identical content committed twice yields the same ver id (dedup)', async () => {
    const { entity, version } = await ko.createKo({ koType: 'treatment', content: sampleContent('dup'), actor: ACTOR });
    // commit identical content+meta again
    const again = await versioning.commit({
      koId: entity._id,
      content: version.content,
      meta: { parent: version.parent, branch: version.branch, authors: version.authors, status: version.status, visibility: version.visibility, lenses: version.lenses },
      actor: ACTOR,
    });
    expect(again._id).toBe(version._id);
    const all = await repo.listVersions(entity._id);
    expect(all.length).toBe(1); // no duplicate doc
  });

  it('a fork records parent = source ver and a provenance lineage event', async () => {
    const { entity, version } = await ko.createKo({ koType: 'treatment', content: sampleContent('forkable'), actor: ACTOR });
    const { entity: forkEntity, version: forkV1 } = await versioning.fork(entity._id, version._id, { ref: 'acct:forker', role: 'author' });

    expect(forkEntity._id).not.toBe(entity._id);
    expect(forkV1.parent).toBe(version._id); // cross-KO lineage
    const events = await provenance.allForSubject(forkV1._id);
    expect(events.some((e) => e.action === 'forked')).toBe(true);
    expect(events.find((e) => e.action === 'forked')!.detail.forkedFrom).toBe(version._id);
  });
});
