import { Injectable, NotFoundException } from '@nestjs/common';
import type { ContentBlock, ContentSection, KnowledgeObjectContent, VersionDoc } from '@core/types';
import { KnowledgeObjectService } from '@modules/knowledge-object/knowledge-object.service';
import { ProvenanceService } from '@modules/provenance/provenance.service';

/**
 * §7 export formats. md/jats/json are the fully-supported v1 formats; docx
 * returns the WordprocessingML `document.xml` body string only (see renderDocx).
 */
export type ExportFormat = 'md' | 'docx' | 'jats' | 'json';

export const EXPORT_FORMATS: ExportFormat[] = ['md', 'docx', 'jats', 'json'];

/** Content-Type per format — the controller mirrors this onto the response. */
export const EXPORT_CONTENT_TYPE: Record<ExportFormat, string> = {
  md: 'text/markdown; charset=utf-8',
  docx: 'application/xml; charset=utf-8',
  jats: 'application/xml; charset=utf-8',
  json: 'application/json; charset=utf-8',
};

export interface ExportResult {
  format: ExportFormat;
  contentType: string;
  body: string;
}

export interface ExportActor {
  ref: string; // acct:… | idrec:…
  role: 'author' | 'contributor' | 'reviewer' | 'steward' | 'editor' | 'ai' | 'system';
}

/** Escape the five XML predefined entities for safe embedding in JATS/WordML. */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Pick the caption a reader sees at surface depth (falls back to verbose). */
function surfaceCaption(block: ContentBlock): string | undefined {
  return block.captions?.surface ?? block.captions?.verbose;
}

/**
 * §7 + §9.8 + §11 "no cage": frictionless export of any version at ANY
 * visibility/status (draft included). This service is deliberately ungated on
 * release — it renders the loaded version's canonical content to a standard,
 * portable format so an author can always walk away with their work.
 *
 * Access control to the underlying version stays with the route guard (@Roles)
 * and the KnowledgeObjectService read path; this renderer never gates on status.
 */
@Injectable()
export class ExportService {
  constructor(
    private readonly ko: KnowledgeObjectService,
    private readonly provenance: ProvenanceService,
  ) {}

  /**
   * Load the requested version (explicit `versionId` or the KO's current tip)
   * and render it to `format`. Works for raw private drafts — there is no
   * release/visibility gate here by design.
   */
  async export(koId: string, format: ExportFormat, versionId: string | null, actor: ExportActor): Promise<ExportResult> {
    const version = await this.loadVersion(koId, versionId);
    const body = this.render(version, format);
    await this.provenance.record({
      subjectRef: version._id,
      actorRef: actor.ref,
      actorRole: actor.role,
      action: 'exported',
      detail: { koId, format },
    });
    return { format, contentType: EXPORT_CONTENT_TYPE[format], body };
  }

  /** Resolve the target version: explicit id, else the entity's current tip. */
  private async loadVersion(koId: string, versionId: string | null): Promise<VersionDoc> {
    if (versionId) {
      const v = await this.ko.getVersion(versionId);
      if (!v) throw new NotFoundException(`unknown version ${versionId}`);
      if (v.ko !== koId) throw new NotFoundException(`version ${versionId} does not belong to ${koId}`);
      return v;
    }
    const entity = await this.ko.getEntity(koId);
    if (!entity) throw new NotFoundException(`unknown KO ${koId}`);
    const tip = entity.refs.tip;
    if (!tip) throw new NotFoundException(`KO ${koId} has no committed version`);
    const v = await this.ko.getVersion(tip);
    if (!v) throw new NotFoundException(`unknown version ${tip}`);
    return v;
  }

  /** Dispatch to the per-format renderer. */
  render(version: VersionDoc, format: ExportFormat): string {
    switch (format) {
      case 'json':
        return this.renderJson(version);
      case 'md':
        return this.renderMarkdown(version.content);
      case 'jats':
        return this.renderJats(version.content);
      case 'docx':
        return this.renderDocx(version.content);
    }
  }

  /** Canonical VersionDoc, pretty-printed. */
  renderJson(version: VersionDoc): string {
    return JSON.stringify(version, null, 2);
  }

  /**
   * Markdown: '# '+title, then for each section a '## '+(title||path) heading and
   * its blocks — paragraph text verbatim, figures as '![caption]' at surface depth.
   */
  renderMarkdown(content: KnowledgeObjectContent): string {
    const lines: string[] = [`# ${content.title}`];
    for (const section of content.sections) {
      lines.push('', `## ${section.title ?? section.path}`);
      for (const block of section.blocks) {
        const rendered = this.markdownBlock(block);
        if (rendered !== null) lines.push('', rendered);
      }
    }
    return lines.join('\n') + '\n';
  }

  private markdownBlock(block: ContentBlock): string | null {
    if (block.type === 'figure') {
      return `![${surfaceCaption(block) ?? ''}]`;
    }
    if (block.type === 'caption') {
      return surfaceCaption(block) ?? block.text ?? null;
    }
    return block.text ?? null;
  }

  /**
   * Minimal but well-formed JATS XML. Sections map to <sec> with a <title> and
   * one <p> per paragraph block; figure captions become a <p>. All text escaped.
   */
  renderJats(content: KnowledgeObjectContent): string {
    const body = content.sections.map((s) => this.jatsSection(s)).join('');
    return (
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<article>' +
      '<front><article-meta><title-group>' +
      `<article-title>${escapeXml(content.title)}</article-title>` +
      '</title-group></article-meta></front>' +
      `<body>${body}</body>` +
      '</article>'
    );
  }

  private jatsSection(section: ContentSection): string {
    const title = `<title>${escapeXml(section.title ?? section.path)}</title>`;
    const paras = section.blocks
      .map((b) => this.blockText(b))
      .filter((t): t is string => t !== null)
      .map((t) => `<p>${escapeXml(t)}</p>`)
      .join('');
    return `<sec>${title}${paras}</sec>`;
  }

  /**
   * Minimal WordprocessingML `document.xml` body string. v1 LIMITATION: this is
   * the bare WordML document, NOT a zipped .docx OOXML container — md/jats/json
   * are the fully-supported formats; docx is a convenience body for downstream
   * packaging. The title and each block become a <w:p> paragraph.
   */
  renderDocx(content: KnowledgeObjectContent): string {
    const paras: string[] = [this.wordPara(content.title)];
    for (const section of content.sections) {
      paras.push(this.wordPara(section.title ?? section.path));
      for (const block of section.blocks) {
        const text = this.blockText(block);
        if (text !== null) paras.push(this.wordPara(text));
      }
    }
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      `<w:body>${paras.join('')}</w:body>` +
      '</w:document>'
    );
  }

  private wordPara(text: string): string {
    return `<w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
  }

  /** Reader-facing text for a block (paragraph text or surface caption), else null. */
  private blockText(block: ContentBlock): string | null {
    if (block.type === 'figure' || block.type === 'caption') {
      return surfaceCaption(block) ?? block.text ?? null;
    }
    return block.text ?? null;
  }
}
