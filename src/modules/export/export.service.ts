import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AiDeclaration, ContentBlock, ContentSection, KnowledgeObjectContent, Reference, VersionDoc } from '@core/types';
import { PORTS, type AiDeclarationRepo } from '@core/ports';
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

const CITE_RE = /\[@([^\]]+)\]/g;

/** Split a `[@a;b,c]` token's inner text into bare citation keys. */
function citeKeys(inner: string): string[] {
  return inner
    .split(/[;,]/)
    .map((s) => s.trim().replace(/^@/, ''))
    .filter(Boolean);
}

/**
 * First-appearance citation order across the whole manuscript (title, abstract,
 * every block). Only keys that resolve to a stored reference are numbered — this
 * is what lets in-text `[@key]` tokens render as `[1]` and the reference list
 * appear in citation order, mirroring the Builder's preview (§5.3).
 */
function buildCiteOrder(content: KnowledgeObjectContent): { order: string[]; numByKey: Record<string, number> } {
  const known = new Set((content.references ?? []).map((r) => r.key));
  const order: string[] = [];
  const texts = [content.title, content.abstract ?? '', ...content.sections.flatMap((s) => s.blocks.map((b) => b.text ?? ''))];
  for (const t of texts) {
    let m: RegExpExecArray | null;
    const re = new RegExp(CITE_RE);
    while ((m = re.exec(t)) !== null) {
      for (const key of citeKeys(m[1])) {
        if (known.has(key) && !order.includes(key)) order.push(key);
      }
    }
  }
  const numByKey: Record<string, number> = {};
  order.forEach((k, i) => (numByKey[k] = i + 1));
  return { order, numByKey };
}

/** Replace in-text `[@key]` tokens with numbered `[n]` (or `[?]` when unresolved). */
function resolveCites(text: string, numByKey: Record<string, number>): string {
  return text.replace(CITE_RE, (_full, inner: string) => {
    const nums = citeKeys(inner).map((k) => numByKey[k]).filter((n): n is number => typeof n === 'number');
    return nums.length ? `[${nums.join(', ')}]` : '[?]';
  });
}

/** Plain-text formatter for one reference (mirrors the Builder's `plainRef`). */
function plainRef(r: Reference): string {
  if (r.type === 'book' || r.type === 'web') return `${r.authors} (${r.year}). ${r.title}. ${r.source ?? ''}.`;
  if (r.type === 'jose' && r.jose) {
    const vor = r.jose.isVoR ? ' (Version of Record)' : ' (living tip)';
    const anchor = `${r.jose.concept} [${r.jose.section ?? ''}; ver:sha256-${r.jose.hash ?? ''}…]`;
    return `${r.authors} (${r.year}). ${r.title}. JOSE ${r.jose.version}${vor}. ${anchor}.`;
  }
  return `${r.authors} (${r.year}). ${r.title}. ${r.source ?? ''}.${r.doi ? ` https://doi.org/${r.doi}` : ''}`;
}

interface Composition { human: number; ai: number; aiHuman: number; hasAi: boolean }

/** Three-way authorship composition by character count over para/claim blocks (§5.3 / D3). */
function composition(content: KnowledgeObjectContent): Composition {
  let h = 0;
  let a = 0;
  let ah = 0;
  for (const s of content.sections) {
    for (const b of s.blocks) {
      if (b.type !== 'paragraph' && b.type !== 'claim-block') continue;
      const n = (b.text ?? '').length;
      if (b.origin === 'ai') a += n;
      else if (b.origin === 'ai-human') ah += n;
      else h += n;
    }
  }
  const tot = h + a + ah || 1;
  const pct = (x: number) => Math.round((x / tot) * 100);
  return { human: pct(h), ai: pct(a), aiHuman: pct(ah), hasAi: a > 0 || ah > 0 };
}

/**
 * The "AI provenance + composition" export footer (§5.3 / M4) — built from the
 * recorded AiDeclaration (coverage/roles/model/accountable) and the per-block
 * origin tally. Returns null when there is nothing to declare (no declaration and
 * no AI-origin content) so a fully-human draft exports without a footer.
 */
function provenanceFooter(version: VersionDoc, decl: AiDeclaration | null): { coverage: string; roles: string; model: string; accountable: string; comp: Composition } | null {
  const comp = composition(version.content);
  if (!decl && !comp.hasAi) return null;
  return {
    coverage: decl?.coverage ?? 'recorded',
    roles: decl?.role || 'recorded',
    model: decl?.model || '(unspecified)',
    accountable: decl?.accountableHuman || version.authors[0] || '(unknown)',
    comp,
  };
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
    @Inject(PORTS.AiDeclarationRepo) private readonly aiDecl: AiDeclarationRepo,
  ) {}

  /**
   * Load the requested version (explicit `versionId` or the KO's current tip)
   * and render it to `format`. Works for raw private drafts — there is no
   * release/visibility gate here by design.
   */
  async export(koId: string, format: ExportFormat, versionId: string | null, actor: ExportActor): Promise<ExportResult> {
    const version = await this.loadVersion(koId, versionId);
    const decl = await this.aiDecl.getForKo(koId);
    const body = this.render(version, format, decl);
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
  render(version: VersionDoc, format: ExportFormat, decl: AiDeclaration | null = null): string {
    switch (format) {
      case 'json':
        return this.renderJson(version);
      case 'md':
        return this.renderMarkdown(version, decl);
      case 'jats':
        return this.renderJats(version, decl);
      case 'docx':
        return this.renderDocx(version, decl);
    }
  }

  /** Canonical VersionDoc, pretty-printed. */
  renderJson(version: VersionDoc): string {
    return JSON.stringify(version, null, 2);
  }

  /**
   * Markdown (Pandoc-style): '# '+title, optional '*authors*' and '**Abstract.**'
   * lines, then each section as '## '+(title||path) with its blocks — paragraph
   * text, claim blocks as '> **Claim.**', figures as '![caption]'. In-text
   * `[@key]` tokens resolve to numbered `[n]`, and a '## References' list is
   * appended in citation order when the manuscript carries a bibliography (§5.3).
   * `*italic*` is left intact (valid Markdown).
   */
  renderMarkdown(version: VersionDoc, decl: AiDeclaration | null = null): string {
    const content = version.content;
    const { order, numByKey } = buildCiteOrder(content);
    const lines: string[] = [`# ${resolveCites(content.title, numByKey)}`];
    if (version.authors?.length) lines.push('', `*${version.authors.join(' · ')}*`);
    if (content.abstract) lines.push('', `**Abstract.** ${resolveCites(content.abstract, numByKey)}`);
    for (const section of content.sections) {
      lines.push('', `## ${section.title ?? section.path}`);
      for (const block of section.blocks) {
        const rendered = this.markdownBlock(block, numByKey);
        if (rendered !== null) lines.push('', rendered);
      }
    }
    if (order.length) {
      lines.push('', '## References');
      order.forEach((key, i) => {
        const ref = (content.references ?? []).find((r) => r.key === key);
        if (ref) lines.push('', `[${i + 1}] ${plainRef(ref)}`);
      });
    }
    const f = provenanceFooter(version, decl);
    if (f) {
      lines.push(
        '',
        '---',
        '',
        `*AI provenance (${f.coverage})* — roles: ${f.roles}; model: ${f.model}; accountable: ${f.accountable}.`,
        '',
        `*Composition* — human ${f.comp.human}% · AI ${f.comp.ai}% · AI-edited ${f.comp.aiHuman}%.`,
      );
    }
    return lines.join('\n') + '\n';
  }

  private markdownBlock(block: ContentBlock, numByKey: Record<string, number>): string | null {
    if (block.type === 'figure') {
      const cap = surfaceCaption(block);
      return `![${cap ? resolveCites(cap, numByKey) : ''}]`;
    }
    if (block.type === 'caption') {
      const cap = surfaceCaption(block) ?? block.text;
      return cap != null ? resolveCites(cap, numByKey) : null;
    }
    if (block.text == null) return null;
    const text = resolveCites(block.text, numByKey);
    if (block.type === 'claim-block') return `> **Claim.** ${text}`;
    return text;
  }

  /**
   * Minimal but well-formed JATS XML. Sections map to <sec> with a <title> and
   * one <p> per paragraph block; figure captions become a <p>. All text escaped.
   */
  renderJats(version: VersionDoc, decl: AiDeclaration | null = null): string {
    const content = version.content;
    const { order, numByKey } = buildCiteOrder(content);
    const body = content.sections.map((s) => this.jatsSection(s, numByKey)).join('');
    const abstract = content.abstract
      ? `<abstract><p>${escapeXml(resolveCites(content.abstract, numByKey))}</p></abstract>`
      : '';
    const refList = order.length
      ? '<ref-list>' +
        order
          .map((key, i) => {
            const ref = (content.references ?? []).find((r) => r.key === key);
            return ref
              ? `<ref id="ref-${escapeXml(ref.key)}"><label>${i + 1}</label><mixed-citation>${escapeXml(plainRef(ref))}</mixed-citation></ref>`
              : '';
          })
          .join('') +
        '</ref-list>'
      : '';
    const f = provenanceFooter(version, decl);
    const notes = f
      ? `<notes notes-type="ai-provenance"><p>AI provenance (${escapeXml(f.coverage)}) — roles: ${escapeXml(f.roles)}; model: ${escapeXml(f.model)}; accountable: ${escapeXml(f.accountable)}. Composition — human ${f.comp.human}%, AI ${f.comp.ai}%, AI-edited ${f.comp.aiHuman}%.</p></notes>`
      : '';
    const back = refList || notes ? `<back>${refList}${notes}</back>` : '';
    return (
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<article>' +
      '<front><article-meta><title-group>' +
      `<article-title>${escapeXml(content.title)}</article-title>` +
      '</title-group>' +
      abstract +
      '</article-meta></front>' +
      `<body>${body}</body>` +
      back +
      '</article>'
    );
  }

  private jatsSection(section: ContentSection, numByKey: Record<string, number>): string {
    const title = `<title>${escapeXml(section.title ?? section.path)}</title>`;
    const paras = section.blocks
      .map((b) => this.blockText(b, numByKey))
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
  renderDocx(version: VersionDoc, decl: AiDeclaration | null = null): string {
    const content = version.content;
    const { order, numByKey } = buildCiteOrder(content);
    const paras: string[] = [this.wordPara(content.title)];
    if (content.abstract) paras.push(this.wordPara('Abstract. ' + resolveCites(content.abstract, numByKey)));
    for (const section of content.sections) {
      paras.push(this.wordPara(section.title ?? section.path));
      for (const block of section.blocks) {
        const text = this.blockText(block, numByKey);
        if (text !== null) paras.push(this.wordPara(text));
      }
    }
    if (order.length) {
      paras.push(this.wordPara('References'));
      order.forEach((key, i) => {
        const ref = (content.references ?? []).find((r) => r.key === key);
        if (ref) paras.push(this.wordPara(`[${i + 1}] ${plainRef(ref)}`));
      });
    }
    const f = provenanceFooter(version, decl);
    if (f) {
      paras.push(this.wordPara(`AI provenance (${f.coverage}) — roles: ${f.roles}; model: ${f.model}; accountable: ${f.accountable}.`));
      paras.push(this.wordPara(`Composition — human ${f.comp.human}%, AI ${f.comp.ai}%, AI-edited ${f.comp.aiHuman}%.`));
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

  /** Reader-facing text for a block (paragraph/claim text or surface caption), else null. */
  private blockText(block: ContentBlock, numByKey: Record<string, number>): string | null {
    const raw = block.type === 'figure' || block.type === 'caption' ? surfaceCaption(block) ?? block.text : block.text;
    return raw != null ? resolveCites(raw, numByKey) : null;
  }
}
