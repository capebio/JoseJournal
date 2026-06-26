import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import configuration from '@src/config/configuration';
import { PersistenceModule } from '@persistence/persistence.module';
import { ProvenanceModule } from '@modules/provenance/provenance.module';
import { KnowledgeObjectModule } from '@modules/knowledge-object/knowledge-object.module';
import { VersioningModule } from '@modules/versioning/versioning.module';
import { PORTS, type KnowledgeObjectRepo } from '@core/ports';
import type { ContentBlock, KnowledgeObjectContent, VersionDoc } from '@core/types';
import { KnowledgeObjectService } from '@modules/knowledge-object/knowledge-object.service';
import { VersioningService } from '@modules/versioning/versioning.service';
import { CitationModule } from './citation.module';
import { CitationService } from './citation.service';

const ACTOR = { ref: 'acct:author1', role: 'author' as const };

/** A treatment whose first block has a stable id we can amend across versions. */
function content(text: string, title = 'Mesembryanthemum treatment'): KnowledgeObjectContent {
  return {
    title,
    sections: [
      {
        path: 'description',
        blocks: [{ blockId: 'blk:cited', type: 'paragraph', text } as ContentBlock],
      },
    ],
    claims: {},
  };
}

/**
 * Build the DI context for citation specs. makeContext() does not register
 * CitationModule, so we wire the same in-memory stack plus CitationModule here —
 * still deterministic and service-free.
 */
async function makeCitationContext(): Promise<TestingModule> {
  process.env.PERSISTENCE = 'memory';
  return Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, load: [configuration], ignoreEnvFile: true }),
      PersistenceModule.forRoot(),
      ProvenanceModule,
      KnowledgeObjectModule,
      VersioningModule,
      CitationModule,
    ],
  }).compile();
}

describe('§9.4 Citation / three identifiers + snippet anchoring', () => {
  let mod: TestingModule;
  let citation: CitationService;
  let ko: KnowledgeObjectService;
  let versioning: VersioningService;
  let repo: KnowledgeObjectRepo;

  beforeEach(async () => {
    mod = await makeCitationContext();
    await mod.init();
    citation = mod.get(CitationService);
    ko = mod.get(KnowledgeObjectService);
    versioning = mod.get(VersioningService);
    repo = mod.get(PORTS.KnowledgeObjectRepo);
  });
  afterEach(async () => mod.close());

  describe('three identifiers', () => {
    it('entity returns a navigation-only entity URL with metadata from the tip', async () => {
      const { entity } = await ko.createKo({ koType: 'treatment', content: content('Leaves succulent.'), actor: ACTOR });
      const cite = await citation.cite(entity._id, 'entity');
      expect(cite.entityUrl).toBe(`/ko/${entity._id}`);
      expect(cite.versionUrl).toBeUndefined();
      expect(cite.doi).toBeUndefined();
      expect(cite.title).toBe('Mesembryanthemum treatment');
      expect(cite.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('version pins the immutable URL to the current tip (no redirect)', async () => {
      const { entity, version } = await ko.createKo({ koType: 'treatment', content: content('v1'), actor: ACTOR });
      const cite = await citation.cite(entity._id, 'version');
      expect(cite.versionUrl).toBe(`/ko/${entity._id}/v/${version._id}`);
      expect(cite.versionUrl).toContain(version._id); // the exact pinned ver id, not a redirect
      expect(cite.authors).toEqual(version.authors);
    });

    it('doi resolves the VoR DOI and a pinned version URL once a VoR exists', async () => {
      const { entity, version } = await ko.createKo({
        koType: 'treatment',
        content: content('to be released'),
        actor: ACTOR,
        visibility: 'public',
      });
      const { doi, version: vor } = await versioning.tagVoR(entity._id, version._id, ACTOR);
      const cite = await citation.cite(entity._id, 'doi');
      expect(cite.doi).toBe(doi);
      expect(cite.versionUrl).toBe(`/ko/${entity._id}/v/${vor._id}`);
      expect(cite.note).toBeUndefined();
    });

    it('doi falls back to a version URL with a note when there is no VoR', async () => {
      const { entity, version } = await ko.createKo({ koType: 'treatment', content: content('no vor'), actor: ACTOR });
      const cite = await citation.cite(entity._id, 'doi');
      expect(cite.doi).toBeUndefined();
      expect(cite.versionUrl).toBe(`/ko/${entity._id}/v/${version._id}`);
      expect(cite.note).toMatch(/version of record/i);
    });
  });

  describe('snippet anchoring + drift', () => {
    it('uses the block text when quotedText is omitted, and pins an immutable versionId', async () => {
      const { version } = await ko.createKo({ koType: 'treatment', content: content('Leaves opposite, succulent.'), actor: ACTOR });
      const snip = await citation.createSnippet({
        versionId: version._id,
        sectionPath: 'description',
        blockId: 'blk:cited',
        actorRef: 'acct:r1',
        actorRole: 'reviewer',
      });
      expect(snip.versionId).toBe(version._id); // anchors an immutable version, never an entity
      expect(snip.versionId.startsWith('ver:')).toBe(true);
      expect(snip.quotedText).toBe('Leaves opposite, succulent.');
    });

    it('a later amend that leaves the cited block untouched resolves drift:false', async () => {
      const { entity, version } = await ko.createKo({ koType: 'treatment', content: content('original text'), actor: ACTOR });
      const snip = await citation.createSnippet({
        versionId: version._id,
        sectionPath: 'description',
        blockId: 'blk:cited',
        quotedText: 'original text',
        actorRef: 'acct:r1',
        actorRole: 'reviewer',
      });

      // Amend something ELSE (the title) — the cited block keeps its exact text in
      // the new tip, so there is no drift.
      const amended = await versioning.amend({
        koId: entity._id,
        baseVersionId: version._id,
        content: content('original text', 'Mesembryanthemum treatment (rev. 2)'),
        actor: ACTOR,
        amendClass: 'substantive',
      });
      expect(amended._id).not.toBe(version._id);

      const resolved = await citation.resolveSnippet(snip.id);
      expect(resolved.drift).toBe(false);
      expect(resolved.block?.text).toBe('original text');
    });

    it('a later amend that changes the cited block resolves drift:true with BOTH states', async () => {
      const { entity, version } = await ko.createKo({ koType: 'treatment', content: content('cited sentence'), actor: ACTOR });
      const snip = await citation.createSnippet({
        versionId: version._id,
        sectionPath: 'description',
        blockId: 'blk:cited',
        quotedText: 'cited sentence',
        actorRef: 'acct:r1',
        actorRole: 'reviewer',
      });

      // A later version amends the SAME blockId to carry different text. The pinned
      // (cited) version is untouched; drift surfaces against the live tip (§9.4).
      const amended = await versioning.amend({
        koId: entity._id,
        baseVersionId: version._id,
        content: content('amended sentence'),
        actor: ACTOR,
        amendClass: 'substantive',
      });
      expect(amended.content.sections[0].blocks[0].text).toBe('amended sentence');

      const resolved = await citation.resolveSnippet(snip.id);
      expect(resolved.drift).toBe(true);
      expect(resolved.citedText).toBe('cited sentence'); // the cited state is preserved
      expect(resolved.currentBlock?.text).toBe('amended sentence'); // the current state is offered too
      expect(resolved.note).toMatch(/amended in a later version/i);
    });

    it('rejects a snippet whose block is not in the version', async () => {
      const { version } = await ko.createKo({ koType: 'treatment', content: content('x'), actor: ACTOR });
      await expect(
        citation.createSnippet({
          versionId: version._id,
          sectionPath: 'description',
          blockId: 'blk:does-not-exist',
          actorRef: 'acct:r1',
          actorRole: 'reviewer',
        }),
      ).rejects.toThrow(/not found/i);
    });
  });
});
