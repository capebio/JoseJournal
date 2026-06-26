import { Link } from 'react-router-dom';
import './lightbox.css';

/** The shape ep.getMedia(...) resolves to (IS §7 media route). */
export interface MediaResolution {
  free: boolean;
  watermark: boolean;
  address: string;
  mime: string;
  maxEdge?: number;
  tierNote?: string;
}

/** The verification resolution (max edge, px) — at/below this, zoom is FREE and
 *  UNMETERED (AC 11.8). v1 backend media is descriptor-level, so this is a sane
 *  default used to draw the free-zone window when the server omits maxEdge. */
export const VERIFICATION_MAX_EDGE = 1024;

export interface LightboxStageProps {
  mediaId: string;
  /** 0..100 slider value. The free window is [0, freeStop]; above it is metered. */
  zoom: number;
  freeStop: number;
  /** Effective edge (px) at the current zoom, used for the resolution badge + KV. */
  edgePx: number;
  /** Whether the current zoom is within the free verification window. */
  inFreeWindow: boolean;
  /** The resolution returned by ep.getMedia for the current zoom (may be undefined). */
  res?: MediaResolution;
  caption: string;
  taxon?: string;
}

/**
 * The full-screen lightbox stage: a descriptor-level placeholder image (cool
 * herbarium texture, mirroring the Reader figbox), a Casabio attribution mark
 * (the ONLY mark), a metered-tier watermark shown ONLY above the verification
 * resolution, and a resolution badge that reads "verification resolution — free"
 * inside the free window.
 */
export function LightboxStage({ zoom, freeStop, edgePx, inFreeWindow, res, caption, taxon }: LightboxStageProps) {
  // map the slider to a visual scale; the free window tops out at ~1.6×, metered keeps climbing.
  const scale = 1 + (zoom / 100) * 1.6;
  // Per AC 11.8: watermark NEVER appears in the free window; above it, honour the server flag.
  const watermarked = !inFreeWindow && (res?.watermark ?? true);

  return (
    <div className="lb-stage" role="img" aria-label={`Organism image${taxon ? ` of ${taxon}` : ''} — ${caption}`}>
      <div className={`lb-resbadge ${inFreeWindow ? 'free' : 'metered'}`}>
        <span className="dot" />
        {inFreeWindow
          ? <span>verification resolution — free</span>
          : <span>deep zoom — metered tier</span>}
        <span className="lb-mono" style={{ color: 'inherit', opacity: 0.85 }}>· {Math.round(edgePx)}px</span>
      </div>

      <div className="lb-viewport">
        <div className="lb-figure" style={{ transform: `scale(${scale})` }} aria-hidden>
          <span className="lb-figlabel">{caption}</span>
          <span className="lb-figsub">descriptor-level placeholder · JXL</span>
        </div>
        {watermarked && <div className="lb-watermark" aria-hidden />}
      </div>

      {/* the single permitted mark */}
      <div className="lb-attribution" aria-label="Image courtesy of Casabio">
        <span className="dot" />Casabio
      </div>

      <span className="sr-only">
        Zoom {zoom} of 100. {inFreeWindow
          ? 'Within verification resolution: free and unmetered, no watermark.'
          : 'Above verification resolution: metered tier, preview watermark applied.'}
        {' '}Free window ends at slider {freeStop}.
      </span>
    </div>
  );
}

/** The links row — BOTH the image (this lightbox) and its observation (§5.9). */
export function ObservationLink({ koId, obsId }: { koId?: string; obsId?: string }) {
  return (
    <div className="lb-links">
      {koId ? (
        <Link className="lb-link" to={`/map/${encodeURIComponent(koId)}`}>
          <span className="ic">◰</span>
          <span>Open distribution map<span className="lb-obsid"> · {koId}</span></span>
        </Link>
      ) : null}
      {obsId ? (
        <span className="lb-link" aria-label="Source observation">
          <span className="ic">◎</span>
          <span>Source observation<span className="lb-obsid"> · {obsId}</span></span>
        </span>
      ) : null}
      {!koId && !obsId ? (
        <span className="lb-link" aria-disabled="true">
          <span className="ic">◎</span>
          <span>No linked observation</span>
        </span>
      ) : null}
    </div>
  );
}
