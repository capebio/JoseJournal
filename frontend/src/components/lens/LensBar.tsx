import { useEffect, useRef, useState } from 'react';
import type { LensPatch, LensState } from '../../core/lens/lens-url';

export interface VersionEntry { _id: string; status: string; createdAt: string; doi?: string | null }

interface Props {
  lens: LensState;
  setLens: (patch: LensPatch) => void;
  versions: VersionEntry[]; // sorted oldest→newest
  currentVersionId: string;
  tipId: string;
  vorId: string | null;
  onSelectVersion: (verId: string | null) => void; // null = tip (navigates to entity URL)
}

/**
 * The Lens Bar (Frontend Spec §4) — the signature control surface. Five composable
 * axes re-see one canonical object; state round-trips through the URL (AC 11.1).
 * Version selection navigates to an immutable /v/:verId URL (never a query redirect).
 */
export function LensBar({ lens, setLens, versions, currentVersionId, tipId, vorId, onSelectVersion }: Props) {
  const [verOpen, setVerOpen] = useState(false);
  const verRef = useRef<HTMLDivElement>(null);
  // Close the version popover on Escape or any click outside it. Capture phase is
  // required because the lens bar stops mousedown propagation (so a bubble-phase
  // document listener would never see in-bar clicks). (a11y: keyboard/touch dismiss.)
  useEffect(() => {
    if (!verOpen) return;
    const onDown = (e: MouseEvent) => {
      if (verRef.current && !verRef.current.contains(e.target as Node)) setVerOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setVerOpen(false); };
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [verOpen]);
  const label = (id: string) => {
    const i = versions.findIndex((v) => v._id === id);
    return i >= 0 ? `v${i + 1}` : 'version';
  };
  const cur = versions.find((v) => v._id === currentVersionId);
  const isTip = currentVersionId === tipId;
  const isVor = vorId != null && currentVersionId === vorId;

  return (
    <div className="jose-lensbar" onMouseDown={(e) => e.stopPropagation()}>
      <div className="jose-lensbar-inner">
        {/* Version */}
        <div className="jose-lens">
          <span className="jose-lens-label">⟲ Version</span>
          <div className="jose-verbtn" ref={verRef}>
            <button className="jose-chip" onClick={() => setVerOpen((o) => !o)} aria-expanded={verOpen} aria-haspopup="true">
              {label(currentVersionId)} · <span className="mono">{cur?.createdAt ?? ''}</span> ▾
              {isVor && <span style={{ color: 'var(--verified)', fontWeight: 600, fontSize: 11 }}> ⚐ VoR</span>}
              {isTip && <span style={{ color: 'var(--ink)', fontWeight: 600, fontSize: 11 }}> tip</span>}
            </button>
            {verOpen && (
              <div className="jose-pop">
                <h4>Version history</h4>
                {versions.map((v) => {
                  const vIsTip = v._id === tipId;
                  const vIsVor = vorId != null && v._id === vorId;
                  return (
                    <button
                      key={v._id}
                      className={`jose-vrow ${vIsTip ? 'tip' : ''} ${vIsVor ? 'vor' : ''}`}
                      aria-current={v._id === currentVersionId}
                      onClick={() => { onSelectVersion(vIsTip ? null : v._id); setVerOpen(false); }}
                    >
                      <span className="node" />
                      <span><span className="vlabel">{label(v._id)}</span> · <span className="vdate">{v.createdAt}</span></span>
                      {vIsTip && <span className="tag tip">tip</span>}
                      {vIsVor && <span className="tag vor">VoR · DOI</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Language (en only in v1, control present) */}
        <div className="jose-lens">
          <span className="jose-lens-label">🌐 Lang</span>
          <span className="jose-chip">{lens.lang} <span style={{ color: 'var(--structure)' }}>▾</span></span>
        </div>

        {/* Depth */}
        <div className="jose-lens">
          <span className="jose-lens-label">◑ Depth</span>
          <div className="jose-slider">
            <span className="ends">surface</span>
            <input
              type="range" min={0} max={100} value={lens.depth === 'verbose' ? 100 : 0}
              onChange={(e) => setLens({ depth: Number(e.target.value) > 50 ? 'verbose' : 'surface' })}
              aria-label="Depth lens"
            />
            <span className="ends">verbose</span>
          </div>
        </div>

        {/* Register */}
        <div className="jose-lens">
          <span className="jose-lens-label">Aa Register</span>
          <div className="jose-seg" role="group" aria-label="Register">
            <button aria-pressed={lens.register === 'academic'} onClick={() => setLens({ register: 'academic' })}>Academic</button>
            <button aria-pressed={lens.register === 'popular'} onClick={() => setLens({ register: 'popular' })}>Popular</button>
          </div>
        </div>

        {/* Annotations */}
        <div className="jose-lens">
          <span className="jose-lens-label">◫ Annotations</span>
          <button className="jose-toggle" aria-pressed={lens.annotations.reviewer} onClick={() => setLens({ annotations: { reviewer: !lens.annotations.reviewer } })}><span className="box" />Reviewer</button>
          <button className="jose-toggle" aria-pressed={lens.annotations.provenance} onClick={() => setLens({ annotations: { provenance: !lens.annotations.provenance } })}><span className="box" />Provenance</button>
          <button className="jose-toggle" aria-pressed={lens.annotations.ai} onClick={() => setLens({ annotations: { ai: !lens.annotations.ai } })}><span className="box" />AI</button>
        </div>
      </div>
    </div>
  );
}
