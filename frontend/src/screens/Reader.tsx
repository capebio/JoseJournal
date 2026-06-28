import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useLens } from '../core/lens/lens-url';
import { qk } from '../core/query/queryClient';
import * as ep from '../core/api/endpoints';
import type { ContentBlock, ReadModel, ReviewThread, VersionDoc } from '../core/api/types';
import { LensBar, type VersionEntry } from '../components/lens/LensBar';
import { useToast } from '../components/common/useToast';
import { useSeed } from '../core/seed';
import { LightboxModal } from '../components/media/LightboxModal';

/** Parse a heterogeneous evidence ref (IS §3.2) into a labelled row. */
function evidenceRow(ref: string): { k: string; label: string } {
  if (ref.startsWith('obs:')) return { k: 'micro-obs', label: ref };
  if (ref.startsWith('specimen:')) return { k: 'specimen', label: ref.slice('specimen:'.length) };
  if (ref.startsWith('figure:')) return { k: 'figure', label: ref.slice('figure:'.length) };
  if (ref.startsWith('seq:') || ref.includes('GenBank')) return { k: 'sequence', label: ref };
  if (ref.startsWith('ver:')) return { k: 'snippet', label: `${ref.slice(0, 22)}…` };
  return { k: 'ref', label: ref };
}

/**
 * Render an evidence ref against a real target where v1 has one:
 *   obs:…          → the distribution map (where accepted observations live)
 *   seq/GenBank    → the NCBI nucleotide record (external)
 * Everything else (specimen/figure/snippet/generic) stays non-interactive text —
 * there is no v1 screen for it, so it must not look clickable.
 */
function EvidenceRef({ refStr, label, koId }: { refStr: string; label: string; koId: string }) {
  if (refStr.startsWith('obs:')) {
    return <Link className="jose-evref link" to={`/map/${encodeURIComponent(koId)}`}>{label}</Link>;
  }
  if (refStr.startsWith('seq:') || refStr.includes('GenBank')) {
    const acc = refStr.match(/[A-Z]{1,3}\d{4,}(?:\.\d+)?/)?.[0];
    if (acc) {
      return <a className="jose-evref link" href={`https://www.ncbi.nlm.nih.gov/nuccore/${acc}`} target="_blank" rel="noopener noreferrer">{label}</a>;
    }
  }
  return <span className="jose-evref">{label}</span>;
}

function QDSMini() {
  const cells = [[1, 0], [2, 1], [0, 2], [2, 2], [3, 1], [1, 3], [3, 3]];
  return (
    <svg width="150" height="92" viewBox="0 0 150 92" style={{ marginTop: 6 }} aria-hidden>
      {[...Array(5)].map((_, i) => <line key={'v' + i} x1={i * 30} y1="0" x2={i * 30} y2="92" style={{ stroke: 'var(--rule)' }} />)}
      {[...Array(4)].map((_, i) => <line key={'h' + i} x1="0" y1={i * 23} x2="150" y2={i * 23} style={{ stroke: 'var(--rule)' }} />)}
      {cells.map(([x, y], i) => <rect key={i} x={x * 30 + 3} y={y * 23 + 3} width="24" height="17" style={{ fill: 'var(--verified)' }} opacity="0.32" />)}
      <circle cx="78" cy="40" r="4" style={{ fill: 'var(--type-red)' }} /><circle cx="78" cy="40" r="8" fill="none" style={{ stroke: 'var(--type-red)' }} opacity="0.5" />
    </svg>
  );
}

export function Reader() {
  const { koId = '', verId } = useParams();
  const [lens, setLens] = useLens();
  const navigate = useNavigate();
  const location = useLocation();
  const { flash, node: toastNode } = useToast();
  const seed = useSeed();
  const bodyRef = useRef<HTMLDivElement>(null);

  const [claimsOpen, setClaimsOpen] = useState<Record<string, boolean>>({});
  const [lightbox, setLightbox] = useState<{ mediaId: string; obsId?: string; caption: string } | null>(null);
  const [citer, setCiter] = useState<{ x: number; y: number; text: string; block: string; section: string } | null>(null);
  const [card, setCard] = useState<{ x: number; y: number; text: string; block: string; section: string; anchor?: { id: string; contentHash: string } } | null>(null);

  const lensKey = `${verId ?? 'tip'}|${lens.depth}|${lens.register}|${lens.lang}`;
  const readQ = useQuery({
    queryKey: qk.read(koId, lensKey),
    queryFn: () => (verId ? ep.getVersion(koId, verId, { depth: lens.depth, register: lens.register, lang: lens.lang }) : ep.getReadModel(koId, { depth: lens.depth, register: lens.register, lang: lens.lang })),
    enabled: !!koId,
  });
  // history feeds the visible version chrome (chip label, DAG, banner) — keep eager.
  const historyQ = useQuery({ queryKey: qk.history(koId), queryFn: () => ep.getHistory(koId), enabled: !!koId });
  // Supplementary panels (reviewer annotations, provenance overlay, map count) are
  // deferred until the read resolves so they don't compete with the critical read
  // for bandwidth on a slow connection (FE9 low-bandwidth; first paint is gated on readQ).
  const reviewsQ = useQuery({ queryKey: qk.reviews(koId), queryFn: () => ep.getReviews(koId), enabled: !!koId && !!readQ.data });
  const provQ = useQuery({ queryKey: qk.provenance(koId), queryFn: () => ep.getProvenance(koId), enabled: !!koId && !!readQ.data });
  const mapQ = useQuery({ queryKey: qk.map(koId), queryFn: () => ep.getMap(koId), enabled: !!koId && !!readQ.data });
  const aiQ = useQuery({ queryKey: qk.aiDecl(koId), queryFn: () => ep.getAiDeclaration(koId), enabled: !!koId && lens.annotations.ai && !!readQ.data });

  const versions: VersionEntry[] = useMemo(
    () => (historyQ.data ?? []).map((v) => ({ _id: v._id, status: v.status, createdAt: v.createdAt, doi: v.doi })),
    [historyQ.data],
  );

  const goVersion = useCallback(
    (target: string | null) => {
      const base = target ? `/ko/${encodeURIComponent(koId)}/v/${encodeURIComponent(target)}` : `/ko/${encodeURIComponent(koId)}`;
      navigate({ pathname: base, search: location.search });
    },
    [koId, navigate, location.search],
  );

  // selection → snippet citer (anchors against the IMMUTABLE version, §3.9)
  const onMouseUp = useCallback(() => {
    try {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !bodyRef.current) return setCiter(null);
      const txt = sel.toString().trim();
      if (txt.length < 4) return setCiter(null);
      let node = sel.anchorNode as Node | null;
      if (!node || !bodyRef.current.contains(node)) return setCiter(null);
      let el: HTMLElement | null = node.nodeType === 3 ? (node.parentElement as HTMLElement) : (node as HTMLElement);
      while (el && !el.getAttribute?.('data-block') && el !== bodyRef.current) el = el.parentElement;
      const block = el?.getAttribute?.('data-block') || 'body';
      const section = el?.getAttribute?.('data-section') || 'description';
      const r = sel.getRangeAt(0).getBoundingClientRect();
      setCard(null);
      setCiter({ x: Math.min(r.left + r.width / 2, window.innerWidth - 90), y: Math.max(r.top - 44, 8), text: txt, block, section });
    } catch {
      setCiter(null);
    }
  }, []);

  const openCard = async () => {
    if (!citer) return;
    const model = readQ.data as ReadModel | undefined;
    const verIdForAnchor = model?.version._id;
    setCard({ x: Math.min(citer.x, window.innerWidth - 340), y: Math.min(citer.y + 48, window.innerHeight - 280), text: citer.text, block: citer.block, section: citer.section });
    setCiter(null);
    if (verIdForAnchor) {
      try {
        const anchor = await ep.createSnippet({ versionId: verIdForAnchor, sectionPath: citer.section, blockId: citer.block, quotedText: citer.text });
        setCard((c) => (c ? { ...c, anchor: { id: anchor.id, contentHash: anchor.contentHash } } : c));
      } catch { /* block may be 'body' (not a real block id) — still show the local card */ }
    }
  };

  const copyCite = (model: ReadModel) => {
    const v = model.version;
    const label = `v${versions.findIndex((x) => x._id === v._id) + 1 || ''}`.replace('v0', 'v');
    const cite = `${v.authors[0] ?? 'Author'} ${v.createdAt.slice(0, 4)}, §${card?.section} (JOSE ${label}, ${v.createdAt}; ${v._id}#${card?.block})`;
    try { navigator.clipboard?.writeText(cite); } catch { /* clipboard blocked */ }
    setCard(null);
    flash('Citation copied');
  };

  // Escape dismisses the snippet citer / anchor card (keyboard parity with the
  // outside-click close, and basic dialog behaviour for the anchor card).
  useEffect(() => {
    if (!card && !citer) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setCard(null); setCiter(null); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card, citer]);

  if (readQ.isLoading) return <div className="jose-loading">Loading treatment…</div>;
  if (readQ.isError || !readQ.data) {
    const status = (readQ.error as { status?: number })?.status;
    return <div className="jose-stub"><h2>{status === 403 ? 'Not permitted' : 'Treatment unavailable'}</h2><p className="jose-mono">{koId}</p></div>;
  }

  const model = readQ.data as ReadModel;
  const v: VersionDoc = model.version;
  const tipId = model.relation.tip;
  const vorId = model.relation.vor;
  const isTip = model.relation.isLatest;
  const pop = lens.register === 'popular';
  const verbose = lens.depth === 'verbose';
  const { reviewer: showRev, provenance: showProv, ai: showAi } = lens.annotations;
  const reviews = reviewsQ.data ?? [];
  const authorLabel = v.authors[0]?.replace('acct:', '') ?? 'author';
  const verLabel = `v${versions.findIndex((x) => x._id === v._id) + 1 || versions.length}`;

  const ProvChip = ({ blockId }: { blockId: string }) =>
    showProv ? <div className="jose-prov">{verLabel} · {authorLabel}{blockId ? '' : ''}</div> : null;

  const renderBlock = (block: ContentBlock, sectionPath: string) => {
    if (block.restricted) return null; // never render restricted (precise) content (§6)
    // Shade by the RECORDED authorship origin (provenance observed at authoring),
    // not a placeholder — the AI overlay reflects what was actually recorded.
    const origin = block.origin;
    const aiOn = showAi && (origin === 'ai' || origin === 'ai-human');
    return (
      <div key={block.blockId} className={`jose-block ${aiOn ? 'ai-on' : ''}`} data-block={block.blockId} data-section={sectionPath}>
        {aiOn && <div className="jose-aitag"><i />{origin === 'ai' ? 'AI-drafted' : 'AI → human'}</div>}
        <ProvChip blockId={block.blockId} />
        {block.type === 'figure' ? (
          <div className="jose-fig">
            <button className="jose-figbox" onClick={() => setLightbox({ mediaId: block.media?.[0] ?? seed?.obsId ?? '', obsId: block.media?.[0] ? undefined : seed?.obsId, caption: block.captions?.surface ?? 'Figure' })}>image — {block.captions?.surface ?? 'Fig'} (JXL)</button>
            <div className="jose-cap">{verbose && block.captions?.verbose ? <span className="vb">{block.captions.verbose}</span> : <>{block.captions?.surface ?? ''}{block.captions?.verbose && <span className="more">+ verbose</span>}</>}</div>
          </div>
        ) : (
          <p className="jose-p">
            {block.text}
            {(block.claims ?? []).map((cid) => (
              <button key={cid} className="jose-claim-marker" onClick={() => setClaimsOpen((s) => ({ ...s, [cid]: !s[cid] }))}><span className="c" />claim</button>
            ))}
          </p>
        )}
        {(block.claims ?? []).map((cid) => {
          const claim = v.content.claims[cid];
          if (!claim || !claimsOpen[cid]) return null;
          return (
            <div key={cid} className="jose-evidence">
              <div className="et">Evidence — {claim.statement}</div>
              {claim.evidence.map((ref, i) => {
                const row = evidenceRow(ref);
                return <div key={i} className="jose-ev"><span className="k">{row.k}</span><EvidenceRef refStr={ref} label={row.label} koId={koId} /></div>;
              })}
              <div className="jose-conf">confidence: {claim.confidence}</div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div onMouseDown={() => setCard(null)}>
      <LensBar lens={lens} setLens={setLens} versions={versions} currentVersionId={v._id} tipId={tipId} vorId={vorId} onSelectVersion={goVersion} />

      {showAi && (
        <div className="jose-ailegend">
          <span>AI content view:</span>
          <span><i style={{ background: 'var(--haze)' }} />human</span>
          <span><i style={{ background: 'var(--ai)' }} />AI</span>
          <span><i style={{ background: 'var(--aih)' }} />AI → human</span>
          {aiQ.data?.status === 200 && <span style={{ marginLeft: 'auto', color: 'var(--verified)' }}>declaration: {aiQ.data.body.coverage}{aiQ.data.body.model ? ` · ${aiQ.data.body.model}` : ''}</span>}
        </div>
      )}

      <div className="jose-frame">
        <div className="jose-gutter">
          <div className="jose-strata" title="Active lens strata">
            <span className={showRev ? 'on-rev' : ''} /><span className={showProv ? 'on-prov' : ''} /><span className={showAi ? 'on-ai' : ''} /><span className={verbose ? 'on-prov' : ''} />
            <span className="lbl">lenses</span>
          </div>
        </div>

        <div className="jose-col" ref={bodyRef} onMouseUp={onMouseUp} onKeyUp={onMouseUp}>
          <div className="jose-meta">
            {model.entity.tier === 'commons' && <span className="jose-badge">Commons</span>}
            {model.entity.tier === 'journal' && <span className="jose-badge journal">Journal · VoR</span>}
            {v.doi && <button className="jose-doi" onClick={() => { try { navigator.clipboard?.writeText(v.doi!); } catch { /* */ } flash('DOI citation copied'); }}>{v.doi}</button>}
            <span className="jose-demo">{model.entity.koType}</span>
          </div>
          <h1 className="jose-title" dangerouslySetInnerHTML={{ __html: italiciseBinomial(v.content.title) }} />
          <div className="jose-sec">sec. <b>{authorLabel}</b> · {v.status} · a living treatment</div>

          {v.content.sections.map((section) => (
            <div key={section.path}>
              <h2 className="jose-h">{section.title ?? section.path}</h2>
              {pop && section.path === 'description'
                ? <div className="jose-block" data-block="blk:pop" data-section="description"><p className="jose-p jose-pop-lead">{section.blocks.find((b) => b.text)?.text}</p></div>
                : section.blocks.map((b) => renderBlock(b, section.path))}
            </div>
          ))}

          {showRev && reviews.length > 0 && (
            <>
              <h2 className="jose-h">Reviewer annotations</h2>
              {reviews.map((t: ReviewThread) => (
                <div key={t.id} className={`jose-rev ${t.disposition}`}>
                  <div className="who"><span className="disp">{t.disposition} · {dispWord(t.disposition)}</span> {t.reviewer.replace('acct:', '')}{typeof t.relevanceScore === 'number' ? ` · relevance ${t.relevanceScore.toFixed(2)}` : ''}</div>
                  <div className="note">{t.comment || '—'}</div>
                  {t.authorReply && <div className="reply"><b>Author reply:</b> {t.authorReply}</div>}
                </div>
              ))}
            </>
          )}

          {pop && (
            <div className="jose-news"><h5>In the news</h5>
              <span className="newslink">Quartz-field succulents and the poaching crisis <span>· Daily Maverick</span></span>
              <span className="newslink">New treatments from the Knersvlakte <span>· SANBI blog</span></span>
            </div>
          )}
        </div>

        <div className="jose-rail">
          <h2>Evidence</h2>
          <button className="jose-railitem" onClick={() => navigate(`/map/${encodeURIComponent(koId)}`)}>
            <span className="ic">◰</span><span><span className="t">Distribution (QDS) →</span><span className="s">{(mapQ.data?.length ?? 0)} obs · open map</span><div><QDSMini /></div></span>
          </button>
          <div className="jose-railitem static"><span className="ic">▤</span><span><span className="t">Specimens</span><span className="s">vouchers</span></span></div>
          <div className="jose-railitem static"><span className="ic">⛓</span><span><span className="t">Sequences</span><span className="s">GenBank links</span></span></div>
          <button className={`jose-railitem ${showProv ? 'active' : ''}`} onClick={() => setLens({ annotations: { provenance: !showProv } })}>
            <span className="ic">●</span><span><span className="t">Provenance overlay</span><span className="s">{showProv ? 'on' : 'off'} · {provQ.data?.length ?? 0} events</span></span>
          </button>
          <button className="jose-railitem" onClick={() => goVersion(vorId ?? null)} title="Jump to the Version of Record">
            <span className="ic">⟲</span>
            <span><span className="t">Versions{vorId ? ' → VoR' : ''}</span>
              <div className="jose-vdag">{versions.map((vv, i) => (<span key={vv._id} style={{ display: 'flex', alignItems: 'center' }}>{i > 0 && <span className="ed" />}<span className={`vn ${vv._id === vorId ? 'vor' : ''} ${vv._id === tipId ? 'tip' : ''}`} /></span>))}</div>
              <span className="s">{versions.map((vv, i) => `v${i + 1}`).join(' · ')}</span>
            </span>
          </button>
        </div>
      </div>

      {(model.relation.newerVersionExists || (vorId && v._id === vorId && !isTip)) && (
        <div className={`jose-banner ${vorId && v._id === vorId ? 'vor' : ''}`}>
          {vorId && v._id === vorId
            ? <>⚐ This is the Version of Record — frozen and citable. The living treatment has advanced since.</>
            : <>⚠ You opened {verLabel}. A newer version exists.</>}
          <button onClick={() => goVersion(null)}>View latest</button>
        </div>
      )}

      {citer && (
        <button className="jose-citebtn" style={{ left: citer.x - 58, top: citer.y }} onMouseDown={(e) => e.preventDefault()} onClick={openCard}>
          <span className="c" /> Cite this passage
        </button>
      )}
      {card && (
        <div className="jose-citecard" role="dialog" aria-modal="true" aria-label="Snippet anchor" style={{ left: card.x, top: card.y }} onMouseDown={(e) => e.stopPropagation()}>
          <h4>Snippet anchor</h4>
          <div className="jose-anchor">
            version <b>{verLabel}</b> · {v.createdAt}<br />
            section <b>§{card.section}</b><br />
            block <b>{card.block}</b><br />
            hash <b>{card.anchor ? card.anchor.contentHash.slice(0, 22) + '…' : 'computing…'}</b>
          </div>
          <div className="jose-quote">“{card.text.length > 120 ? card.text.slice(0, 120) + '…' : card.text}”</div>
          <div className="row">
            <button onClick={() => setCard(null)}>Cancel</button>
            <button className="primary" onClick={() => copyCite(model)}>Copy citation</button>
          </div>
        </div>
      )}
      {lightbox && (
        <LightboxModal
          mediaId={lightbox.mediaId}
          koId={koId}
          obsId={lightbox.obsId}
          taxon={v.content.title}
          caption={lightbox.caption}
          onClose={() => setLightbox(null)}
        />
      )}
      {toastNode}
    </div>
  );
}

function dispWord(d: string): string {
  return d === 'green' ? 'incorporated' : d === 'orange' ? 'seen, not incorporated' : d === 'red' ? 'disagree' : 'not seen';
}

/** Italicise a leading binomial (Genus species) — the body italic is doing taxonomy (§3). */
function italiciseBinomial(title: string): string {
  const esc = title.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return esc.replace(/^([A-Z][a-z]+)\s+([a-z-]+)/, '<i>$1 $2</i>');
}
