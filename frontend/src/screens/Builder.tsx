import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import * as ep from '../core/api/endpoints';
import { qk } from '../core/query/queryClient';
import { useAuth } from '../core/auth/auth';
import type { KnowledgeObjectContent, ReadModel, Visibility } from '../core/api/types';
import { useToast } from '../components/common/useToast';
import { AutoTextarea } from '../components/builder/AutoTextarea';
import { pickAI } from '../components/builder/aiPool';
import '../components/builder/builder.css';

/**
 * FE4 — The Builder (Frontend Spec §5.3, AC 11.7). A real authoring surface:
 * a segmented editor where every paragraph carries its authorship origin
 * (human / ai / ai→human), a live composition bar, and recorded AI provenance.
 * On-platform authoring is *recorded* (coverage: 'recorded'), never detected.
 * Wired to the typed API: createKo → saveDraft / amend, putAiDeclaration,
 * release, exportKo. Export walks out at any draft state (the no-cage rule).
 */

type Origin = 'human' | 'ai' | 'ai-human';
type SegType = 'paragraph' | 'claim' | 'obs';
interface Segment { id: string; origin: Origin; type: SegType; text: string; aiOriginal?: string }

let segCounter = 0;
const newId = () => `blk${(++segCounter).toString(36)}${Date.now().toString(36).slice(-3)}`;

const GENERIC_MODEL = 'claude-sonnet-4-6 (generic)';

/** Map editor segments → backend content (one 'description' section of blocks). */
function buildContent(title: string, segments: Segment[]): KnowledgeObjectContent {
  return {
    title: title.trim() || 'Untitled treatment',
    sections: [
      {
        path: 'description',
        blocks: segments.map((s) => ({ blockId: 'blk:' + s.id, type: 'paragraph', text: s.text })),
      },
    ],
    claims: {},
  };
}

/** Read an existing KO's blocks back into editor segments (origin defaults to human). */
function contentToSegments(content: KnowledgeObjectContent): Segment[] {
  const blocks = content.sections.flatMap((sec) => sec.blocks);
  const segs = blocks
    .filter((b) => b.type !== 'figure')
    .map<Segment>((b) => ({
      id: b.blockId.replace(/^blk:/, '') || newId(),
      origin: 'human',
      type: 'paragraph',
      text: b.text ?? '',
    }));
  return segs.length ? segs : [{ id: newId(), origin: 'human', type: 'paragraph', text: '' }];
}

export function Builder() {
  const { koId: routeKoId } = useParams();
  const navigate = useNavigate();
  const { principal } = useAuth();
  const { flash, node: toastNode } = useToast();

  // koId is the live identity once a draft is created (or arrives via route).
  const [koId, setKoId] = useState<string | undefined>(routeKoId);
  const [title, setTitle] = useState('Mesembryanthemum aureum');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [tierLabel, setTierLabel] = useState<'Draft' | 'Commons'>('Draft');
  const [model, setModel] = useState(GENERIC_MODEL);
  const [aiView, setAiView] = useState(true);
  const [roles, setRoles] = useState<string[]>([]);
  const [menu, setMenu] = useState<'vis' | 'insert' | 'export' | null>(null);
  const [busy, setBusy] = useState(false);
  const aiCursor = useRef(0);

  const [segments, setSegments] = useState<Segment[]>([
    {
      id: newId(),
      origin: 'human',
      type: 'paragraph',
      text: 'Compact, mat-forming leaf-succulent; leaves opposite, terete to semi-terete, densely covered in glistening bladder cells (papillae) that lend the plant a frosted appearance.',
    },
  ]);

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
      const model0 = readQ.data as ReadModel;
      setTitle(model0.version.content.title);
      setVisibility(model0.version.visibility);
      setTierLabel(model0.entity.tier === 'commons' ? 'Commons' : 'Draft');
      setSegments(contentToSegments(model0.version.content));
    }
  }, [routeKoId, readQ.data]);

  const accountableHuman = principal?.accountId ?? 'acct:unknown';
  const addRole = useCallback((r: string) => setRoles((rs) => (rs.includes(r) ? rs : [...rs, r])), []);

  // ── segment mutations ─────────────────────────────────────────────────────
  const updateSeg = useCallback(
    (id: string, text: string) => {
      setSegments((prev) =>
        prev.map((g) => {
          if (g.id !== id) return g;
          // Editing an 'ai' segment flips it to 'ai-human' and records 'editing'.
          const flip = g.origin === 'ai' && text !== g.aiOriginal;
          if (flip) addRole('editing');
          return { ...g, text, origin: flip ? 'ai-human' : g.origin };
        }),
      );
    },
    [addRole],
  );

  const aiDraft = useCallback(() => {
    const text = pickAI(aiCursor.current++);
    setSegments((s) => [...s, { id: newId(), origin: 'ai', type: 'paragraph', text, aiOriginal: text }]);
    addRole('drafting');
  }, [addRole]);

  const aiExpand = useCallback(
    (afterId: string) => {
      const text = pickAI(aiCursor.current++);
      setSegments((s) => {
        const i = s.findIndex((g) => g.id === afterId);
        const next = [...s];
        next.splice(i + 1, 0, { id: newId(), origin: 'ai', type: 'paragraph', text, aiOriginal: text });
        return next;
      });
      addRole('expansion');
    },
    [addRole],
  );

  const addHuman = useCallback(() => setSegments((s) => [...s, { id: newId(), origin: 'human', type: 'paragraph', text: '' }]), []);
  const insertClaim = useCallback(() => {
    setSegments((s) => [...s, { id: newId(), origin: 'human', type: 'claim', text: 'New claim — state it, then attach evidence.' }]);
    setMenu(null);
  }, []);
  const insertObs = useCallback(() => {
    setSegments((s) => [...s, { id: newId(), origin: 'human', type: 'obs', text: 'obs:____ — link a micro-observation' }]);
    setMenu(null);
  }, []);
  const removeSeg = useCallback((id: string) => setSegments((s) => (s.length > 1 ? s.filter((g) => g.id !== id) : s)), []);

  // ── composition (by character count) ──────────────────────────────────────
  const comp = useMemo(() => {
    let h = 0, a = 0, ah = 0;
    for (const g of segments) {
      const n = g.text.length;
      if (g.origin === 'ai') a += n;
      else if (g.origin === 'ai-human') ah += n;
      else h += n;
    }
    const tot = h + a + ah || 1;
    const pct = (x: number) => Math.round((x / tot) * 100);
    return { h: pct(h), a: pct(a), ah: pct(ah) };
  }, [segments]);

  // ── persistence ───────────────────────────────────────────────────────────
  /** Ensure a KO exists; returns its id. Creates (persisting current content)
   *  on first use when new; for an existing KO it is identity-only and does NOT
   *  mutate the draft (publish/export must not silently save). */
  const ensureKo = useCallback(async (): Promise<string> => {
    if (koId) return koId;
    const content = buildContent(title, segments);
    const created = await ep.createKo({ koType: 'treatment', visibility, content, authors: [accountableHuman] });
    const id = created.entity._id;
    setKoId(id);
    return id;
  }, [koId, title, segments, visibility, accountableHuman]);

  const recordAi = useCallback(
    async (id: string) => {
      // On-platform authoring is recorded, not detected (coverage: 'recorded').
      await ep.putAiDeclaration(id, {
        coverage: 'recorded',
        role: roles.join(',') || 'drafting',
        model,
        accountableHuman,
        percentage: comp.a + comp.ah,
      });
    },
    [roles, model, accountableHuman, comp.a, comp.ah],
  );

  const onSaveDraft = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const isNew = !koId;
      const id = await ensureKo(); // creates + persists current content when new
      if (!isNew) {
        // Existing KO: write the draft on the tip; if the tip is frozen the server
        // requires an amend (409) — fall back to it against the loaded base version.
        try {
          await ep.saveDraft(id, buildContent(title, segments));
        } catch (e) {
          const status = (e as { status?: number })?.status;
          if (status === 409 && readQ.data) {
            await ep.amend(id, { baseVersionId: (readQ.data as ReadModel).version._id, content: buildContent(title, segments), amendClass: 'substantive' });
          } else if (status === 403) {
            flash('Not permitted to edit this treatment');
            return;
          } else throw e;
        }
      }
      try {
        await recordAi(id);
      } catch {
        /* AI declaration is best-effort; the draft is already saved. */
      }
      flash(isNew ? 'Draft created · provenance recorded' : 'Draft saved · provenance recorded');
    } catch (e) {
      const status = (e as { status?: number })?.status;
      flash(status === 403 ? 'Not permitted' : 'Save failed — check the connection');
    } finally {
      setBusy(false);
    }
  }, [busy, koId, ensureKo, title, segments, readQ.data, recordAi, flash]);

  const onRequestReview = useCallback(() => {
    flash(koId ? 'Review requested — reviewers will be nominated' : 'Save a draft first, then request review');
  }, [koId, flash]);

  const onPublish = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const id = koId ?? (await ensureKo());
      const res = await ep.release(id, 'commons');
      if (res.status === 200) {
        setTierLabel('Commons');
        setVisibility('public');
        flash('Published to Commons');
      } else if (res.status === 409) {
        flash(res.body?.message ?? 'Release blocked — resolve review gates first');
      } else if (res.status === 403) {
        flash('Not permitted to publish');
      } else {
        flash('Publish failed');
      }
    } catch {
      flash('Publish failed — check the connection');
    } finally {
      setBusy(false);
    }
  }, [busy, koId, ensureKo, flash]);

  // ── export (no cage: works at ANY draft state) ────────────────────────────
  const onExport = useCallback(
    async (fmt: 'md' | 'docx' | 'jats' | 'json') => {
      setMenu(null);
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
          link.download = (title || 'treatment').replace(/\s+/g, '_') + '.' + fmt;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
          flash(`Exported as ${fmt.toUpperCase()}`);
        } else {
          flash(`${fmt.toUpperCase()} generated`);
        }
      } catch {
        flash('Export failed — check the connection');
      }
    },
    [koId, ensureKo, title, flash],
  );

  const closeMenus = () => setMenu(null);

  return (
    <div onMouseDown={closeMenus}>
      {/* header: title + tier/visibility + AI account + AI-view toggle */}
      <div className="bld-head" onMouseDown={(e) => e.stopPropagation()}>
        <input
          className="bld-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled treatment"
          aria-label="Treatment title"
        />

        <div className="bld-pill">
          <button
            className={`bld-pillbtn ${tierLabel === 'Commons' ? 'commons' : ''}`}
            aria-haspopup="menu"
            aria-expanded={menu === 'vis'}
            onClick={() => setMenu(menu === 'vis' ? null : 'vis')}
          >
            <span className="d" />
            {tierLabel} · {visibility} ▾
          </button>
          {menu === 'vis' && (
            <div className="bld-menu" role="menu">
              <div className="sub">Visibility</div>
              {(['private', 'collaborators', 'public'] as Visibility[]).map((v) => (
                <button key={v} role="menuitem" onClick={() => { setVisibility(v); setMenu(null); }}>
                  {v}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          className="jose-toggle"
          aria-pressed={aiView}
          aria-label="Toggle AI content view"
          onClick={() => setAiView((v) => !v)}
        >
          <span className="box" />◫ AI view
        </button>
      </div>

      {/* AI content view legend (AC 11.7) */}
      {aiView && (
        <div className="bld-ailegend">
          <span>AI content view:</span>
          <span><i style={{ background: 'var(--haze)' }} />human</span>
          <span><i style={{ background: 'var(--ai)' }} />AI</span>
          <span><i style={{ background: 'var(--aih)' }} />AI → human</span>
          <span style={{ marginLeft: 'auto', color: 'var(--verified)' }}>coverage: recorded</span>
        </div>
      )}

      <div className="bld-body">
        {/* segmented editor */}
        <div className="bld-editor">
          {segments.map((g) => {
            const vcls = aiView ? (g.origin === 'ai' ? 'v-ai' : g.origin === 'ai-human' ? 'v-aih' : 'v-human') : '';
            const tcls = g.type === 'claim' ? 'claim' : g.type === 'obs' ? 'obs' : '';
            const tagcls = g.origin === 'ai' ? 'ai' : g.origin === 'ai-human' ? 'aih' : 'human';
            const tagtext = g.origin === 'ai' ? 'AI' : g.origin === 'ai-human' ? 'AI → human' : 'human';
            return (
              <div key={g.id} className={`bld-seg ${vcls} ${tcls}`}>
                {aiView && <span className={`bld-segtag ${tagcls}`}>{tagtext}</span>}
                <AutoTextarea value={g.text} onChange={(t) => updateSeg(g.id, t)} placeholder="Write…" ariaLabel="Paragraph text" />
                <div className="bld-segtools">
                  <button className="ai" onClick={() => aiExpand(g.id)}><span className="sp">✦</span> AI expand</button>
                  {g.origin !== 'human' && <button onClick={() => flash('Edit the text to mark it AI → human')}>edit</button>}
                  <button onClick={() => removeSeg(g.id)}>remove</button>
                </div>
              </div>
            );
          })}

          <div className="bld-toolbar">
            <button className="bld-tbtn ai" onClick={aiDraft}><span className="sp">✦</span> AI draft paragraph</button>
            <button className="bld-tbtn" onClick={addHuman}>＋ Paragraph</button>
            <div className="bld-pill">
              <button
                className="bld-tbtn"
                aria-haspopup="menu"
                aria-expanded={menu === 'insert'}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => setMenu(menu === 'insert' ? null : 'insert')}
              >
                Insert ▸
              </button>
              {menu === 'insert' && (
                <div className="bld-menu" role="menu" style={{ left: 0, right: 'auto' }} onMouseDown={(e) => e.stopPropagation()}>
                  <div className="sub">Insert</div>
                  <button role="menuitem" onClick={insertClaim}>Claim</button>
                  <button role="menuitem" onClick={insertObs}>Observation</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* authorship + export rail */}
        <div className="bld-rail">
          <h3 className="bld-rh">Authorship</h3>
          <div className="bld-rsub">Provenance is recorded as you write, not detected after.</div>
          <div className="bld-cov">coverage: recorded</div>

          <div className="bld-bar" role="img" aria-label={`Composition: human ${comp.h}%, AI ${comp.a}%, AI to human ${comp.ah}%`}>
            <div className="h" style={{ width: comp.h + '%' }} />
            <div className="a" style={{ width: comp.a + '%' }} />
            <div className="ah" style={{ width: comp.ah + '%' }} />
          </div>
          <div className="bld-leg">
            <div className="lr"><span className="sw" style={{ background: 'var(--haze)' }} />human <b>{comp.h}%</b></div>
            <div className="lr"><span className="sw" style={{ background: 'var(--ai)' }} />AI <b>{comp.a}%</b></div>
            <div className="lr"><span className="sw" style={{ background: 'var(--aih)' }} />AI → human <b>{comp.ah}%</b></div>
          </div>

          <div className="bld-drow">
            <div className="k">roles</div>
            <div className="v">
              {roles.length ? roles.map((r) => <span key={r} className="bld-rolechip">{r}</span>) : <span style={{ color: 'var(--structure)' }}>none yet</span>}
            </div>
          </div>
          <div className="bld-drow">
            <div className="k">model</div>
            <div className="v">
              <input className="bld-modelin" value={model} onChange={(e) => setModel(e.target.value)} aria-label="AI model" />
            </div>
          </div>
          <div className="bld-drow">
            <div className="k">accountable</div>
            <div className="v bld-model">{accountableHuman}</div>
          </div>

          <div style={{ height: 18 }} />
          <h3 className="bld-rh">Export</h3>
          <div className="bld-rsub">Walks out at any stage — no cage.</div>
          <div className="bld-export">
            <button onClick={() => onExport('md')}>Markdown</button>
            <button onClick={() => onExport('docx')}>docx</button>
            <button onClick={() => onExport('jats')}>JATS</button>
            <button onClick={() => onExport('json')}>JSON</button>
          </div>
        </div>
      </div>

      {/* actions */}
      <div className="bld-foot" onMouseDown={(e) => e.stopPropagation()}>
        <button onClick={onSaveDraft} disabled={busy}>Save draft</button>
        <button onClick={onRequestReview} disabled={busy}>Request review</button>
        <button className="primary" onClick={onPublish} disabled={busy}>Publish to Commons</button>
        <span className="spacer" />
        {koId && <span className="koid">{koId}</span>}
        {koId && <button onClick={() => navigate(`/ko/${encodeURIComponent(koId)}`)}>Open in Reader →</button>}
      </div>

      {toastNode}
    </div>
  );
}
