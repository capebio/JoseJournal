import { TestingModule } from '@nestjs/testing';
import type { Principal } from '@core/types';
import { KnowledgeObjectService } from '@modules/knowledge-object/knowledge-object.service';
import { ProvenanceService } from '@modules/provenance/provenance.service';
import { makeContext, sampleContent } from '@src/test-support/make-context';
import { ExportService, escapeXml } from './export.service';

const author = (id = 'acct:author'): Principal => ({ sub: id, accountId: id, assurance: 'verified', roles: ['author'], orcid: null });

const TITLE = 'Aizoaceae draft treatment';

describe('§9.8 Export / no-cage', () => {
  let mod: TestingModule;
  let ko: KnowledgeObjectService;
  let exporter: ExportService;

  beforeEach(async () => {
    mod = await makeContext();
    await mod.init();
    ko = mod.get(KnowledgeObjectService);
    // ExportModule is wired by the orchestrator; here we compose the service over
    // the same in-memory KnowledgeObjectService + (global) ProvenanceService.
    exporter = new ExportService(ko, mod.get(ProvenanceService));
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
});
