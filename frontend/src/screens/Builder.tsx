import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import * as ep from '../core/api/endpoints';
import { qk } from '../core/query/queryClient';
import { useAuth } from '../core/auth/auth';
import type { ContentSection, KnowledgeObjectContent, ReadModel, Reference, Visibility } from '../core/api/types';
import { useToast } from '../components/common/useToast';
import { AutoTextarea } from '../components/builder/AutoTextarea';
import { pickAI } from '../components/builder/aiPool';
import {
  buildCites, fmtRef, genKey, plainRef, renderInline,
  DOI_DB, REF_SEED, type CiteStyle, type JoseObject, type RefInput,
} from '../components/builder/citations';
import { CitePicker, EMPTY_PICK, type PickState } from '../components/builder/CitePicker';
import '../components/builder/builder.css';

/**
 * FE4 — The Builder (Frontend Spec §5.3, AC 11.7). A citation-aware manuscript
 * authoring surface: a typed-block editor (heading / paragraph / figure / claim)
 * where every paragraph carries its authorship origin (human / ai / ai→human),
 * a live composition bar, recorded AI provenance, a synced bibliography with four
 * ways to add a reference, in-text `[@key]` citations rendered numbered or
 * author–date, JOSE living-object pinning, and a Write/Preview render.
 *
 * On-platform authoring is *recorded* (coverage: 'recorded'), never detected.
 * Wired to the typed API: createKo → saveDraft / amend, putAiDeclaration, release,
 * exportKo. References + abstract persist inside the version content (the server
 * content-addresses them); export renders the bibliography server-side.
 */

type Origin = 'human' | 'ai' | 'ai-human';
type BlockKind = 'heading' | 'para' | 'figure' | 'claim';
interface Block { id: string; type: BlockKind; text: string; origin?: Origin; aiOriginal?: string }

let uidCounter = 0;
const uid = () => `b${(++uidCounter).toString(36)}${Date.now().toString(36).slice(-3)}`;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const authorsToArray = (s: string): string[] => s.split(/[·,;]/).map((x) => x.trim()).filter(Boolean);

const GENERIC_MODEL = 'claude-sonnet-4-6 (generic)';

/** Map editor blocks → backend content: heading blocks open new titled sections;
 *  para/claim/figure blocks fill the current section. References + abstract ride
 *  along so the server can content-address and render them. */
function buildContent(title: string, abstract: string, blocks: Block[], refs: Reference[]): KnowledgeObjectContent {
  const sections: ContentSection[] = [];
  let current: ContentSection | null = null;
  const ensure = (): ContentSection => {
    if (!current) { current = { path: 'body', blocks: [] }; sections.push(current); }
    return current;
  };
  for (const b of blocks) {
    if (b.type === 'heading') {
      current = { path: slug(b.text) || `sec-${b.id}`, title: b.text || 'Section', blocks: [] };
      sections.push(current);
      continue;
    }
    const sec = ensure();
    const aiOrigin = b.origin && b.origin !== 'human' ? { origin: b.origin } : {};
    if (b.type === 'figure') {
      sec.blocks.push({ blockId: `blk:${b.id}`, type: 'figure', captions: { surface: b.text || '' }, ...aiOrigin });
    } else {
      sec.blocks.push({ blockId: `blk:${b.id}`, type: b.type === 'claim' ? 'claim-block' : 'paragraph', text: b.text, ...aiOrigin });
    }
  }
  if (!sections.length) sections.push({ path: 'body', blocks: [] });
  const content: KnowledgeObjectContent = { title: title.trim() || 'Untitled manuscript', sections, claims: {} };
  if (abstract.trim()) content.abstract = abstract.trim();
  if (refs.length) content.references = refs;
  return content;
}

/** Read a stored KO back into editor blocks: titled sections re-emit a heading. */
function contentToBlocks(content: KnowledgeObjectContent): Block[] {
  const blocks: Block[] = [];
  for (const sec of content.sections) {
    if (sec.title) blocks.push({ id: uid(), type: 'heading', text: sec.title });
    for (const b of sec.blocks) {
      const id = b.blockId.replace(/^blk:/, '') || uid();
      const origin = (b.origin as Origin | undefined) ?? 'human';
      if (b.type === 'figure') blocks.push({ id, type: 'figure', text: b.captions?.surface ?? b.text ?? '' });
      else if (b.type === 'claim-block') blocks.push({ id, type: 'claim', text: b.text ?? '', origin });
      else blocks.push({ id, type: 'para', text: b.text ?? '', origin });
    }
  }
  return blocks.length ? blocks : [{ id: uid(), type: 'para', text: '', origin: 'human' }];
}

const SEED_BLOCKS: Block[] = [
  { id: uid(), type: 'heading', text: 'Introduction' },
  { id: uid(), type: 'para', origin: 'human', text: 'The Mesembryanthemoideae are a largely southern African radiation of leaf-succulents [@klak2012]. *Mesembryanthemum aureum* is restricted to the quartz fields of the Knersvlakte, where it has recently been treated as a living object [@botha2026].' },
  { id: uid(), type: 'heading', text: 'Observations' },
  { id: uid(), type: 'para', origin: 'human', text: 'On 14 March 2026, a single female *Anthophora* sp. was recorded visiting flowers at 13h40. Visits lasted under five seconds; the bee contacted both anthers and stigma.' },
];

export function Builder() {
  const { koId: routeKoId } = useParams();
  const navigate = useNavigate();
  const { principal } = useAuth();
  const { flash, node: toastNode } = useToast();

  const [koId, setKoId] = useState<string | undefined>(routeKoId);
  const [title, setTitle] = useState('A first pollinator record for Mesembryanthemum aureum (Aizoaceae)');
  const [authors, setAuthors] = useState('R. Botha · D. Gwynne-Evans');
  const [abstract, setAbstract] = useState('We report the first timed pollinator visit to *Mesembryanthemum aureum*, a narrow Knersvlakte endemic, and place it within mesemb pollination ecology [@klak2012].');
  const [blocks, setBlocks] = useState<Block[]>(SEED_BLOCKS);
  const [refs, setRefs] = useState<Reference[]>(REF_SEED);
  const [style, setStyle] = useState<CiteStyle>('numbered');
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [railTab, setRailTab] = useState<'references' | 'authorship'>('references');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [tierLabel, setTierLabel] = useState<'Draft' | 'Commons'>('Draft');
  const [model, setModel] = useState(GENERIC_MODEL);
  const [aiView, setAiView] = useState(true);
  const [roles, setRoles] = useState<string[]>([]);
  const [menu, setMenu] = useState<'vis' | null>(null);
  const [pick, setPick] = useState<PickState | null>(null);
  const [busy, setBusy] = useState(false);
  const [publishArmed, setPublishArmed] = useState(false);
  const aiCursor = useRef(0);
  const focused = useRef<{ id: string; node: HTMLTextAreaElement } | null>(null);

  // Hydrate from the server when opened at /builder/:koId.
  const readQ = useQuery({
    queryKey: qk.read(routeKoId ?? '', 'builder'),
    queryFn: () => ep.getReadModel(routeKoId!),
    enabled: !!routeKoId,
  });
  const hydrated = useRef(false);
  useEffect(() => {
    if (routeKoId && readQ.data && !hydrated.current) {
      hydrated.current = true;
      const m = readQ.data as ReadModel;
      setTitle(m.version.content.title);
      setAuthors((m.version.authors ?? []).join(' · '));
      setAbstract(m.version.content.abstract ?? '');
      setVisibility(m.version.visibility);
      setTierLabel(m.entity.tier === 'commons' ? 'Commons' : 'Draft');
      setBlocks(contentToBlocks(m.version.content));
      if (m.version.content.references?.length) setRefs(m.version.content.references);
    }
  }, [routeKoId, readQ.data]);

  const accountableHuman = principal?.accountId ?? 'acct:unknown';
  const addRole = useCallback((r: string) => setRoles((rs) => (rs.includes(r) ? rs : [...rs, r])), []);
  const regFocus = useCallback((id: string, node: HTMLTextAreaElement) => { focused.current = { id, node }; }, []);

  // ── citation index (in-text [@key] ⇄ bibliography) ─────────────────────────
  const { citeMap, order, counts, byKey } = useMemo(
    () => buildCites([title, abstract, ...blocks.map((b) => b.text)], refs),
    [title, abstract, blocks, refs],
  );

  // ── text application + provenance flip ─────────────────────────────────────
  const applyText = useCallback((id: string, text: string) => {
    if (id === 'abstract') { setAbstract(text); return; }
    if (id === 'title') { setTitle(text); return; }
    setBlocks((prev) => prev.map((b) => {
      if (b.id !== id) return b;
      if (b.origin === 'ai' && text !== b.aiOriginal) { addRole('editing'); return { ...b, text, origin: 'ai-human' }; }
      return { ...b, text };
    }));
  }, [addRole]);

  // ── cursor-aware token insertion (Cite / Italic) ───────────────────────────
  const insertToken = useCallback((tok: string) => {
    const f = focused.current;
    if (!f || !f.node) {
      setBlocks((prev) => {
        const i = prev.map((b) => b.type).lastIndexOf('para');
        if (i < 0) return prev;
        const c = [...prev];
        c[i] = { ...c[i], text: `${c[i].text} ${tok}`.trim() };
        return c;
      });
      flash('Citation added to last paragraph');
      return;
    }
    const node = f.node;
    const s = node.selectionStart ?? node.value.length;
    const e = node.selectionEnd ?? s;
    const next = node.value.slice(0, s) + tok + node.value.slice(e);
    applyText(f.id, next);
    requestAnimationFrame(() => { try { node.focus(); const p = s + tok.length; node.selectionStart = node.selectionEnd = p; } catch { /* caret restore is best-effort */ } });
  }, [applyText, flash]);

  const wrapItalic = useCallback(() => {
    const f = focused.current;
    if (!f || !f.node) { flash('Select text in a paragraph first'); return; }
    const node = f.node;
    const s = node.selectionStart;
    const e = node.selectionEnd;
    if (s === e) {
      const next = node.value.slice(0, s) + '**' + node.value.slice(e);
      applyText(f.id, next);
      requestAnimationFrame(() => { try { node.focus(); node.selectionStart = node.selectionEnd = s + 1; } catch { /* best-effort */ } });
      return;
    }
    const next = node.value.slice(0, s) + '*' + node.value.slice(s, e) + '*' + node.value.slice(e);
    applyText(f.id, next);
    requestAnimationFrame(() => { try { node.focus(); node.selectionStart = s; node.selectionEnd = e + 2; } catch { /* best-effort */ } });
  }, [applyText, flash]);

  // ── blocks ─────────────────────────────────────────────────────────────────
  const updateBlockType = useCallback((id: string, t: BlockKind) => setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, type: t } : b))), []);
  const removeBlock = useCallback((id: string) => setBlocks((bs) => (bs.length > 1 ? bs.filter((b) => b.id !== id) : bs)), []);
  const addBlock = useCallback((t: BlockKind) => {
    setBlocks((bs) => [...bs,
      t === 'heading' ? { id: uid(), type: 'heading', text: 'New section' }
      : t === 'figure' ? { id: uid(), type: 'figure', text: '' }
      : t === 'claim' ? { id: uid(), type: 'claim', origin: 'human', text: 'State the claim, then attach evidence.' }
      : { id: uid(), type: 'para', origin: 'human', text: '' },
    ]);
  }, []);
  const aiDraft = useCallback(() => {
    const t = pickAI(aiCursor.current++);
    setBlocks((bs) => [...bs, { id: uid(), type: 'para', origin: 'ai', text: t, aiOriginal: t }]);
    addRole('drafting');
    flash('AI paragraph drafted — tagged AI');
  }, [addRole, flash]);
  const aiExpand = useCallback((afterId: string) => {
    const t = pickAI(aiCursor.current++);
    setBlocks((bs) => {
      const i = bs.findIndex((b) => b.id === afterId);
      const c = [...bs];
      c.splice(i + 1, 0, { id: uid(), type: 'para', origin: 'ai', text: t, aiOriginal: t });
      return c;
    });
    addRole('expansion');
  }, [addRole]);

  // ── references ─────────────────────────────────────────────────────────────
  const addAndInsert = useCallback((r: RefInput) => {
    let key: string;
    const existing = refs.find((x) =>
      (r.doi && x.doi && x.doi === r.doi) ||
      (r.jose && x.jose && x.jose.concept === r.jose.concept && x.jose.version === r.jose.version) ||
      (r.key && x.key === r.key),
    );
    if (existing) {
      key = existing.key;
    } else {
      key = r.key ?? genKey(r, refs);
      const nr: Reference = { ...r, key, id: r.id ?? uid() };
      setRefs((rs) => [...rs, nr]);
    }
    insertToken(`[@${key}]`);
    setPick(null);
    flash('Citation inserted');
  }, [refs, insertToken, flash]);

  const resolveDoi = useCallback(() => {
    const d = (pick?.doi || '').trim().replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
    if (!d) return;
    const hit = DOI_DB[d];
    const r: RefInput = hit
      ? { ...hit }
      : { type: 'article', short: (d.split('/')[1] || 'source').slice(0, 16), authors: '[author — resolved from DOI]', year: 'n.d.', title: `Work at ${d}`, source: '', doi: d };
    addAndInsert(r);
  }, [pick, addAndInsert]);

  const addJose = useCallback((obj: JoseObject, ver: string) => {
    const isVoR = !!obj.vor && ver === obj.vor;
    addAndInsert({
      type: 'jose', short: obj.short, authors: obj.authors, year: obj.year, title: obj.title, source: 'JOSE',
      jose: { concept: obj.concept, version: ver, isVoR, tip: obj.tip, section: obj.section, hash: obj.hash },
    });
  }, [addAndInsert]);

  const addManual = useCallback(() => {
    const m = pick?.manual || {};
    if (!m.title) { flash('A title is needed'); return; }
    addAndInsert({ type: m.type || 'article', short: (m.authors || 'Anon').split(/[ ,]/)[0], authors: m.authors || 'Anon.', year: m.year || 'n.d.', title: m.title, source: m.source || '', doi: m.doi || '' });
  }, [pick, addAndInsert, flash]);

  const insertExisting = useCallback((key: string) => { insertToken(`[@${key}]`); setPick(null); flash('Citation inserted'); }, [insertToken, flash]);

  // ── composition (by character count over para/claim blocks) ────────────────
  const comp = useMemo(() => {
    let h = 0, a = 0, ah = 0;
    for (const b of blocks) {
      if (b.type !== 'para' && b.type !== 'claim') continue;
      const n = b.text.length;
      if (b.origin === 'ai') a += n;
      else if (b.origin === 'ai-human') ah += n;
      else h += n;
    }
    const tot = h + a + ah || 1;
    const pct = (x: number) => Math.round((x / tot) * 100);
    return { h: pct(h), a: pct(a), ah: pct(ah) };
  }, [blocks]);

  const listKeys = useMemo(
    () => (style === 'numbered' ? order.slice() : order.slice().sort((x, y) => (byKey[x].short + byKey[x].year).localeCompare(byKey[y].short + byKey[y].year))),
    [style, order, byKey],
  );

  // ── persistence (all backend wiring preserved) ─────────────────────────────
  const ensureKo = useCallback(async (): Promise<string> => {
    if (koId) return koId;
    const content = buildContent(title, abstract, blocks, refs);
    const created = await ep.createKo({ koType: 'article', visibility, content, authors: authorsToArray(authors).length ? authorsToArray(authors) : [accountableHuman] });
    const id = created.entity._id;
    setKoId(id);
    return id;
  }, [koId, title, abstract, blocks, refs, visibility, authors, accountableHuman]);

  const recordAi = useCallback(async (id: string) => {
    await ep.putAiDeclaration(id, { coverage: 'recorded', role: roles.join(',') || 'drafting', model, accountableHuman, percentage: comp.a + comp.ah });
  }, [roles, model, accountableHuman, comp.a, comp.ah]);

  const onSaveDraft = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const isNew = !koId;
      const id = await ensureKo();
      if (!isNew) {
        try {
          await ep.saveDraft(id, buildContent(title, abstract, blocks, refs));
        } catch (e) {
          const status = (e as { status?: number })?.status;
          if (status === 409 && readQ.data) {
            await ep.amend(id, { baseVersionId: (readQ.data as ReadModel).version._id, content: buildContent(title, abstract, blocks, refs), amendClass: 'substantive' });
          } else if (status === 403) {
            flash('Not permitted to edit this treatment');
            return;
          } else throw e;
        }
      }
      try { await recordAi(id); } catch { /* AI declaration is best-effort; the draft is saved. */ }
      flash(isNew ? 'Draft created · provenance recorded' : 'Draft saved · provenance recorded');
    } catch (e) {
      const status = (e as { status?: number })?.status;
      flash(status === 403 ? 'Not permitted' : 'Save failed — check the connection');
    } finally {
      setBusy(false);
    }
  }, [busy, koId, ensureKo, title, abstract, blocks, refs, readQ.data, recordAi, flash]);

  const onRequestReview = useCallback(() => {
    if (!koId) { flash('Save a draft first, then request review'); return; }
    navigate(`/review/${encodeURIComponent(koId)}`);
  }, [koId, navigate, flash]);

  const onPublish = useCallback(async () => {
    if (busy) return;
    // Publishing to Commons makes the draft a public, citable object — confirm first.
    if (!publishArmed) { setPublishArmed(true); flash('Publishing makes this public on Commons — click Confirm to proceed.'); return; }
    setPublishArmed(false);
    setBusy(true);
    try {
      const id = koId ?? (await ensureKo());
      const res = await ep.release(id, 'commons');
      if (res.status === 200) { setTierLabel('Commons'); setVisibility('public'); flash('Published to Commons'); }
      else if (res.status === 409) flash(res.body?.message ?? 'Release blocked — resolve review gates first');
      else if (res.status === 403) flash('Not permitted to publish');
      else flash('Publish failed');
    } catch { flash('Publish failed — check the connection'); }
    finally { setBusy(false); }
  }, [busy, publishArmed, koId, ensureKo, flash]);

  const onExport = useCallback(async (fmt: 'md' | 'docx' | 'jats' | 'json') => {
    try {
      const id = koId ?? (await ensureKo());
      const res = await ep.exportKo(id, fmt);
      if (res.status === 403) return flash('Not permitted to export');
      if (res.status !== 200 || res.body == null) return flash('Export unavailable');
      if (fmt === 'md' || fmt === 'json') {
        const mime = fmt === 'md' ? 'text/markdown' : 'application/json';
        const blob = new Blob([res.body], { type: mime });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${(title || 'manuscript').replace(/\s+/g, '_')}.${fmt}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        flash(`Exported as ${fmt.toUpperCase()} · bibliography included`);
      } else {
        flash(`${fmt.toUpperCase()} generated`);
      }
    } catch { flash('Export failed — check the connection'); }
  }, [koId, ensureKo, title, flash]);

  const closeMenus = () => setMenu(null);

  return (
    <div onMouseDown={closeMenus}>
      {/* header: title + Write/Preview + tier/visibility + AI-view toggle */}
      <div className="bld-head" onMouseDown={(e) => e.stopPropagation()}>
        <input className="bld-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Manuscript title" aria-label="Manuscript title" />
        <div className="bld-modeseg" role="group" aria-label="Editor mode">
          <button aria-pressed={mode === 'write'} onClick={() => setMode('write')}>Write</button>
          <button aria-pressed={mode === 'preview'} onClick={() => setMode('preview')}>Preview</button>
        </div>
        <div className="bld-pill">
          <button className={`bld-pillbtn ${tierLabel === 'Commons' ? 'commons' : ''}`} aria-haspopup="menu" aria-expanded={menu === 'vis'} onClick={() => setMenu(menu === 'vis' ? null : 'vis')}>
            <span className="d" />{tierLabel} · {visibility} ▾
          </button>
          {menu === 'vis' && (
            <div className="bld-menu" role="menu">
              <div className="sub">Visibility</div>
              {(['private', 'collaborators', 'public'] as Visibility[]).map((v) => (
                <button key={v} role="menuitem" onClick={() => { setVisibility(v); setMenu(null); }}>{v}</button>
              ))}
            </div>
          )}
        </div>
        <button className="jose-toggle" aria-pressed={aiView} aria-label="Toggle AI content view" onClick={() => setAiView((v) => !v)}>
          <span className="box" />◫ AI view
        </button>
      </div>

      {aiView && (
        <div className="bld-ailegend">
          <span>AI content view:</span>
          <span><i style={{ background: 'var(--haze)' }} />human</span>
          <span><i style={{ background: 'var(--ai)' }} />AI</span>
          <span><i style={{ background: 'var(--aih)' }} />AI → human</span>
          <span style={{ marginLeft: 'auto', color: 'var(--verified)' }}>coverage: recorded</span>
        </div>
      )}

      {/* toolbar (write mode only) */}
      {mode === 'write' && (
        <div className="bld-toolbar" onMouseDown={(e) => e.stopPropagation()}>
          <button className="bld-tbtn" onMouseDown={(e) => e.preventDefault()} onClick={wrapItalic} title="Italicise selection (scientific names)"><span className="ital">I</span> Italic</button>
          <button className="bld-tbtn cite" onMouseDown={(e) => e.preventDefault()} onClick={() => setPick(EMPTY_PICK)}><span className="sp">❝</span> Cite</button>
          <span className="bld-div" />
          <button className="bld-tbtn" onClick={() => addBlock('para')}>＋ Paragraph</button>
          <button className="bld-tbtn" onClick={() => addBlock('heading')}>＋ Section</button>
          <button className="bld-tbtn" onClick={() => addBlock('figure')}>＋ Figure</button>
          <button className="bld-tbtn" onClick={() => addBlock('claim')}>＋ Claim</button>
          <span className="bld-div" />
          <button className="bld-tbtn ai" onClick={aiDraft}><span className="sp">✦</span> AI draft</button>
        </div>
      )}

      <div className="bld-body">
        <div className="bld-main">
          {mode === 'write' ? (
            <div className="bld-doc">
              <input className="bld-authors" value={authors} onChange={(e) => setAuthors(e.target.value)} placeholder="Authors" aria-label="Authors" />
              <div className="bld-absbox">
                <div className="bld-abslab">Abstract</div>
                <AutoTextarea className="bld-figcap" value={abstract} onChange={setAbstract} onFocusNode={(n) => regFocus('abstract', n)} placeholder="Abstract…" ariaLabel="Abstract" />
              </div>
              {blocks.map((b) => {
                const vcls = aiView ? (b.origin === 'ai' ? 'v-ai' : b.origin === 'ai-human' ? 'v-aih' : '') : '';
                return (
                  <div key={b.id} className={`bld-block ${b.type === 'claim' ? 'claim' : ''} ${vcls}`}>
                    {aiView && (b.origin === 'ai' || b.origin === 'ai-human') && (
                      <span className={`bld-segtag ${b.origin === 'ai' ? 'ai' : 'aih'}`}>{b.origin === 'ai' ? 'AI' : 'AI → human'}</span>
                    )}
                    <div className="bld-blocktools">
                      {(b.type === 'para' || b.type === 'claim') && <button className="ai" onMouseDown={(e) => e.preventDefault()} onClick={() => aiExpand(b.id)}>✦ expand</button>}
                      {b.type === 'para' && <button onClick={() => updateBlockType(b.id, 'heading')}>heading</button>}
                      {b.type === 'heading' && <button onClick={() => updateBlockType(b.id, 'para')}>text</button>}
                      <button onClick={() => removeBlock(b.id)}>remove</button>
                    </div>
                    {b.type === 'heading' ? (
                      <input className="bld-heading-in" value={b.text} onChange={(e) => applyText(b.id, e.target.value)} placeholder="Section heading" aria-label="Section heading" />
                    ) : b.type === 'figure' ? (
                      <div className="bld-figure">
                        <div className="bld-figbox">figure — drop image (JXL)</div>
                        <AutoTextarea className="bld-figcap" value={b.text} onChange={(t) => applyText(b.id, t)} onFocusNode={(n) => regFocus(b.id, n)} placeholder="Figure caption…" ariaLabel="Figure caption" />
                      </div>
                    ) : (
                      <AutoTextarea className="bld-para" value={b.text} onChange={(t) => applyText(b.id, t)} onFocusNode={(n) => regFocus(b.id, n)} placeholder="Write…  ( *italic*  ·  Cite inserts [@key] )" ariaLabel="Paragraph text" />
                    )}
                  </div>
                );
              })}
              <div className="bld-addrow">
                <button className="bld-addbtn" onClick={() => addBlock('para')}>＋ Paragraph</button>
                <button className="bld-addbtn" onClick={() => addBlock('heading')}>＋ Section</button>
                <button className="bld-addbtn ai" onClick={aiDraft}>✦ AI draft</button>
              </div>
            </div>
          ) : (
            <div className="bld-prev">
              <h1>{title}</h1>
              <div className="by">{authors}</div>
              {abstract && <div className="abs"><span className="lab">Abstract</span>{renderInline(abstract, citeMap, style)}</div>}
              {blocks.map((b) => b.type === 'heading' ? <h2 key={b.id}>{b.text}</h2>
                : b.type === 'figure' ? <div key={b.id} className="bld-figure"><div className="bld-figbox">figure</div><div className="bld-figcap-prev">{renderInline(b.text, citeMap, style)}</div></div>
                : b.type === 'claim' ? <p key={b.id} className="claim"><b>Claim.</b> {renderInline(b.text, citeMap, style)}</p>
                : <p key={b.id}>{renderInline(b.text, citeMap, style)}</p>)}
              <div className="bld-refs">
                <h2>References</h2>
                {listKeys.length === 0 && <div className="bld-rsub">No citations yet. Use <b>Cite</b> while writing.</div>}
                {listKeys.map((key) => {
                  const r = byKey[key];
                  return (
                    <div className={`bld-refitem ${style === 'numbered' ? '' : 'ad'}`} id={`ref-${key}`} key={key}>
                      {style === 'numbered' && <span className="rn">{order.indexOf(key) + 1}.</span>}
                      <span>{fmtRef(r)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* rail: References | Authorship */}
        <div className="bld-rail" onMouseDown={(e) => e.stopPropagation()}>
          <div className="bld-railtabs">
            <button aria-pressed={railTab === 'references'} onClick={() => setRailTab('references')}>References</button>
            <button aria-pressed={railTab === 'authorship'} onClick={() => setRailTab('authorship')}>Authorship</button>
          </div>
          <div className="bld-railbody">
            {railTab === 'references' ? (
              <>
                <h3 className="bld-rh">Bibliography</h3>
                <div className="bld-rsub">Cite while writing — the in-text marker and this list stay in sync.</div>
                <div className="bld-stylewrap">
                  <span className="lab">style</span>
                  <div className="bld-stoggle">
                    <button aria-pressed={style === 'numbered'} onClick={() => setStyle('numbered')}>[1]</button>
                    <button aria-pressed={style === 'authordate'} onClick={() => setStyle('authordate')}>Author–date</button>
                  </div>
                </div>
                <button className="bld-addref" onClick={() => setPick(EMPTY_PICK)}>＋ Add reference</button>
                {refs.map((r) => {
                  const used = counts[r.key] || 0;
                  return (
                    <div className="bld-refcard" key={r.id}>
                      <div className="rtop"><span className={`rt ${r.type === 'jose' ? 'jose' : ''}`}>{r.type === 'jose' ? 'JOSE' : r.type}</span><span className="rkey">@{r.key}</span></div>
                      <div className="rmeta">{fmtRef(r)}</div>
                      {r.type === 'jose' && r.jose && <div className="ver">cited at {r.jose.version}{r.jose.isVoR ? ' · VoR' : ''} · tip {r.jose.tip}</div>}
                      <div className="rfoot">
                        <span className={`used ${used === 0 ? 'zero' : ''}`}>{used ? `cited ${used}×` : 'not cited'}</span>
                        <button className="ins" onClick={() => insertToken(`[@${r.key}]`)}>Insert</button>
                      </div>
                    </div>
                  );
                })}
              </>
            ) : (
              <>
                <h3 className="bld-rh">Authorship</h3>
                <div className="bld-rsub">Provenance is recorded as you write, not detected after.</div>
                <div className="bld-cov">coverage: recorded</div>
                <div className="bld-bar" role="img" aria-label={`Composition: human ${comp.h}%, AI ${comp.a}%, AI to human ${comp.ah}%`}>
                  <div className="h" style={{ width: `${comp.h}%` }} />
                  <div className="a" style={{ width: `${comp.a}%` }} />
                  <div className="ah" style={{ width: `${comp.ah}%` }} />
                </div>
                <div className="bld-leg">
                  <div className="lr"><span className="sw" style={{ background: 'var(--haze)' }} />human <b>{comp.h}%</b></div>
                  <div className="lr"><span className="sw" style={{ background: 'var(--ai)' }} />AI <b>{comp.a}%</b></div>
                  <div className="lr"><span className="sw" style={{ background: 'var(--aih)' }} />AI → human <b>{comp.ah}%</b></div>
                </div>
                <div className="bld-drow"><div className="k">roles</div><div className="v">{roles.length ? roles.map((r) => <span key={r} className="bld-rolechip">{r}</span>) : <span style={{ color: 'var(--structure)' }}>none yet</span>}</div></div>
                <div className="bld-drow"><div className="k">model</div><div className="v"><input className="bld-modelin" value={model} onChange={(e) => setModel(e.target.value)} aria-label="AI model" /></div></div>
                <div className="bld-drow"><div className="k">accountable</div><div className="v bld-model">{accountableHuman}</div></div>

                <div style={{ height: 18 }} />
                <h3 className="bld-rh">Export</h3>
                <div className="bld-rsub">Walks out at any stage — no cage. Markdown carries the bibliography.</div>
                <div className="bld-export">
                  <button onClick={() => onExport('md')}>Markdown</button>
                  <button onClick={() => onExport('docx')}>docx</button>
                  <button onClick={() => onExport('jats')}>JATS</button>
                  <button onClick={() => onExport('json')}>JSON</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* actions */}
      <div className="bld-foot" onMouseDown={(e) => e.stopPropagation()}>
        <button onClick={onSaveDraft} disabled={busy}>Save draft</button>
        <button onClick={onRequestReview} disabled={busy}>Request review</button>
        <button onClick={() => onExport('md')} disabled={busy}>Export Markdown</button>
        <button className="primary" onClick={onPublish} disabled={busy}>{publishArmed ? 'Confirm publish →' : 'Publish to Commons'}</button>
        <span className="spacer" />
        {koId && <span className="koid">{koId}</span>}
        {koId && <button onClick={() => navigate(`/ko/${encodeURIComponent(koId)}`)}>Open in Reader →</button>}
      </div>

      {pick && (
        <CitePicker
          pick={pick}
          setPick={setPick}
          refs={refs}
          insertExisting={insertExisting}
          resolveDoi={resolveDoi}
          addJose={addJose}
          addManual={addManual}
          addAndInsert={addAndInsert}
        />
      )}
      {toastNode}
    </div>
  );
}
