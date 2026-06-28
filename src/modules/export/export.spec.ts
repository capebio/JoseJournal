import { TestingModule } from '@nestjs/testing';
import { PORTS, type AiDeclarationRepo } from '@core/ports';
import type { KnowledgeObjectContent, Principal } from '@core/types';
import { KnowledgeObjectService } from '@modules/knowledge-object/knowledge-object.service';
import { ProvenanceService } from '@modules/provenance/provenance.service';
import { makeContext, sampleContent } from '@src/test-support/make-context';
import { ExportService, escapeXml } from './export.service';

const author = (id = 'acct:author'): Principal => ({ sub: id, accountId: id, assurance: 'verified', roles: ['author'], orcid: null });

const TITLE = 'Aizoaceae draft treatment';

describe('§9.8 Export / no-cage', () => {
  let mod: TestingModule;
  let ko: KnowledgeObjectService;
  let aiDecl: AiDeclarationRepo;
  let exporter: ExportService;

  beforeEach(async () => {
    mod = await makeContext();
    await mod.init();
    ko = mod.get(KnowledgeObjectService);
    aiDecl = mod.get(PORTS.AiDeclarationRepo);
    // ExportModule is wired by the orchestrator; here we compose the service over
    // the same in-memory KnowledgeObjectService + (global) ProvenanceService + AI repo.
    exporter = new ExportService(ko, mod.get(ProvenanceService), aiDecl);
  });
  afterEach(async () => mod.close());

  /** Create a PRIVATE 'raw' draft KO and return its id + tip version id. */
  async function privateDraft() {
    const { entity, version } = await ko.createKo({
      koType: 'treatment',
      content: sampleContent(TITLE),
      actor: { ref: author().accountId, role: 'author' },
      visibility: 'private',
    });
    expect(version.visibility).toBe('private');
    expect(version.status).toBe('raw');
    return { koId: entity._id, versionId: version._id };
  }

  it('exports a private raw draft as markdown containing the title', async () => {
    const { koId } = await privateDraft();
    const { body, contentType } = await exporter.export(koId, 'md', null, { ref: author().accountId, role: 'author' });
    expect(body.length).toBeGreaterThan(0);
    expect(contentType).toMatch(/markdown/);
    expect(body).toContain(`# ${TITLE}`);
    // section heading + figure caption rendered at surface depth
    expect(body).toContain('## description');
    expect(body).toContain('Leaves opposite, succulent.');
    expect(body).toContain('![Fig 1. Habit.]');
  });

  it('exports a private raw draft as json (canonical VersionDoc) containing the title', async () => {
    const { koId, versionId } = await privateDraft();
    const { body, contentType } = await exporter.export(koId, 'json', null, { ref: author().accountId, role: 'author' });
    expect(body.length).toBeGreaterThan(0);
    expect(contentType).toMatch(/json/);
    const doc = JSON.parse(body);
    expect(doc._id).toBe(versionId);
    expect(doc['@type']).toBe('Version');
    expect(doc.content.title).toBe(TITLE);
  });

  it('exports a private raw draft as well-formed JATS containing the title', async () => {
    const { koId } = await privateDraft();
    const { body, contentType } = await exporter.export(koId, 'jats', null, { ref: author().accountId, role: 'author' });
    expect(body.length).toBeGreaterThan(0);
    expect(contentType).toMatch(/xml/);
    expect(body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(body).toContain(`<article-title>${TITLE}</article-title>`);
    expect(body).toContain('<sec><title>description</title>');
    expect(body).toContain('<p>Leaves opposite, succulent.</p>');
    // balanced article element
    expect(body.startsWith('<?xml')).toBe(true);
    expect(body.endsWith('</article>')).toBe(true);
  });

  it('exports a private raw draft as a WordprocessingML document body', async () => {
    const { koId } = await privateDraft();
    const { body } = await exporter.export(koId, 'docx', null, { ref: author().accountId, role: 'author' });
    expect(body.length).toBeGreaterThan(0);
    expect(body).toContain('<w:document');
    expect(body).toContain(`<w:t xml:space="preserve">${TITLE}</w:t>`);
    expect(body).toContain('<w:t xml:space="preserve">Leaves opposite, succulent.</w:t>');
  });

  it('pins an explicit version via the version param', async () => {
    const { koId, versionId } = await privateDraft();
    const { body } = await exporter.export(koId, 'json', versionId, { ref: author().accountId, role: 'author' });
    expect(JSON.parse(body)._id).toBe(versionId);
  });

  it('rejects an unknown KO', async () => {
    await expect(exporter.export('ko:does-not-exist', 'md', null, { ref: author().accountId, role: 'author' })).rejects.toThrow(/unknown KO/);
  });

  it('rejects a version that does not belong to the KO', async () => {
    const { koId } = await privateDraft();
    const other = await privateDraft();
    await expect(exporter.export(koId, 'json', other.versionId, { ref: author().accountId, role: 'author' })).rejects.toThrow(/does not belong/);
  });

  it('records an export provenance event against the version', async () => {
    const { koId, versionId } = await privateDraft();
    const provenance = mod.get(ProvenanceService);
    await exporter.export(koId, 'md', null, { ref: author().accountId, role: 'author' });
    const events = await provenance.allForSubject(versionId);
    expect(events.some((e) => e.action === 'exported')).toBe(true);
  });

  it('escapes XML entities in JATS output', async () => {
    expect(escapeXml('a & b < c > d "e" \'f\'')).toBe('a &amp; b &lt; c &gt; d &quot;e&quot; &apos;f&apos;');
  });

  describe('§5.3 bibliography-aware export', () => {
    /** Manuscript with an abstract, in-text [@key] tokens, and a bibliography. */
    function manuscript(): KnowledgeObjectContent {
      return {
        title: 'Pollinator record',
        abstract: 'First timed visit to *M. aureum* [@klak2012].',
        sections: [
          {
            path: 'introduction',
            title: 'Introduction',
            blocks: [
              { blockId: 'blk:1', type: 'paragraph', text: 'A mesemb radiation [@klak2012]; treated as a living object [@botha2026].' },
              { blockId: 'blk:2', type: 'claim-block', text: 'A bee was recorded [@unknownkey].' },
            ],
          },
        ],
        claims: {},
        references: [
          { id: 'ref:1', key: 'klak2012', type: 'article', short: 'Klak & Bruyns', authors: 'Klak, C. & Bruyns, P. V.', year: '2012', title: 'A phylogeny of Mesembryanthemoideae', source: 'Taxon 61', doi: '10.1002/tax.612009' },
          { id: 'ref:2', key: 'botha2026', type: 'jose', short: 'Botha', authors: 'Botha, R.', year: '2026', title: 'M. aureum — a living treatment', source: 'JOSE', jose: { concept: '10.59321/jose.aizo.0142', version: 'v2', isVoR: true, tip: 'v3', section: '§description', hash: '9f2ac1e7' } },
        ],
      };
    }

    async function manuscriptKo() {
      const { entity } = await ko.createKo({
        koType: 'treatment',
        content: manuscript(),
        actor: { ref: author().accountId, role: 'author' },
        visibility: 'private',
        authors: ['acct:botha', 'acct:dge'],
      });
      return entity._id;
    }

    it('markdown renders authors, abstract, numbered in-text cites and a reference list', async () => {
      const koId = await manuscriptKo();
      const { body } = await exporter.export(koId, 'md', null, { ref: author().accountId, role: 'author' });
      expect(body).toContain('*acct:botha · acct:dge*');
      expect(body).toContain('**Abstract.** First timed visit to *M. aureum* [1].');
      // klak2012 is cited first (in the abstract) → [1]; botha2026 → [2].
      expect(body).toContain('A mesemb radiation [1]; treated as a living object [2].');
      // claim block prefix + unresolved key renders as [?].
      expect(body).toContain('> **Claim.** A bee was recorded [?].');
      expect(body).toContain('## References');
      expect(body).toContain('[1] Klak, C. & Bruyns, P. V. (2012). A phylogeny of Mesembryanthemoideae. Taxon 61. https://doi.org/10.1002/tax.612009');
      expect(body).toContain('[2] Botha, R. (2026). M. aureum — a living treatment. JOSE v2 (Version of Record).');
    });

    it('JATS carries an <abstract> and a <ref-list> when present', async () => {
      const koId = await manuscriptKo();
      const { body } = await exporter.export(koId, 'jats', null, { ref: author().accountId, role: 'author' });
      expect(body).toContain('<abstract><p>First timed visit to *M. aureum* [1].</p></abstract>');
      expect(body).toContain('<back><ref-list>');
      expect(body).toContain('<ref id="ref-klak2012">');
      expect(body.endsWith('</article>')).toBe(true);
    });

    it('sampleContent (no abstract/refs) still renders without a References section', async () => {
      const { entity } = await ko.createKo({
        koType: 'treatment',
        content: sampleContent('Plain draft'),
        actor: { ref: author().accountId, role: 'author' },
        visibility: 'private',
      });
      const { body } = await exporter.export(entity._id, 'md', null, { ref: author().accountId, role: 'author' });
      expect(body).toContain('# Plain draft');
      expect(body).not.toContain('## References');
    });

    it('appends an AI provenance + composition footer when a declaration or AI content exists', async () => {
      const content: KnowledgeObjectContent = {
        title: 'AI-assisted note',
        sections: [{ path: 'body', blocks: [
          { blockId: 'blk:h', type: 'paragraph', text: 'A human-written sentence here.' },
          { blockId: 'blk:a', type: 'paragraph', text: 'An AI-drafted sentence.', origin: 'ai' },
        ] }],
        claims: {},
      };
      const { entity } = await ko.createKo({ koType: 'article', content, actor: { ref: author().accountId, role: 'author' }, visibility: 'private' });
      await aiDecl.put({ koId: entity._id, coverage: 'recorded', role: 'drafting,editing', model: 'claude-sonnet-4-6', accountableHuman: 'acct:botha', percentage: 50, recordedAt: new Date().toISOString() });

      const { body } = await exporter.export(entity._id, 'md', null, { ref: author().accountId, role: 'author' });
      expect(body).toContain('*AI provenance (recorded)* — roles: drafting,editing; model: claude-sonnet-4-6; accountable: acct:botha.');
      expect(body).toMatch(/\*Composition\* — human \d+% · AI \d+% · AI-edited \d+%\./);
    });

    it('a fully-human draft with no declaration exports without a provenance footer', async () => {
      const { entity } = await ko.createKo({ koType: 'treatment', content: sampleContent('Human only'), actor: { ref: author().accountId, role: 'author' }, visibility: 'private' });
      const { body } = await exporter.export(entity._id, 'md', null, { ref: author().accountId, role: 'author' });
      expect(body).not.toContain('AI provenance');
    });
  });
});
