import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import * as ep from '../core/api/endpoints';
import { useSeed } from '../core/seed';
import { useToast } from '../components/common/useToast';
import {
  LightboxStage, ObservationLink, VERIFICATION_MAX_EDGE, type MediaResolution,
} from '../components/media/LightboxStage';

/**
 * JXL Lightbox (FE7 · Frontend Spec §5.9 · AC 11.8).
 *
 * A full-screen lightbox over an organism image. v1 backend media is
 * descriptor-level, so the image itself is a CSS placeholder (cool herbarium
 * texture, mirroring the Reader figbox) — but the metering principle is real and
 * exercised against ep.getMedia(mediaId, res):
 *
 *   VERIFICATION ZOOM IS FREE AND UNMETERED (AC 11.8): at or below the
 *   verification resolution there is NO paywall and NO watermark; the badge reads
 *   "verification resolution — free". Deep zoom above it is the metered tier and
 *   may carry a preview watermark (we honour the server's `watermark` flag). The
 *   ONLY mark on the full-screen image is a small "Casabio" attribution.
 *
 * The screen links BOTH the image (here) and its observation (a link to /map/…).
 * If mediaId is missing or media is not found, it still renders the stage and the
 * free-verification message so the principle is always demonstrable.
 */
export function Lightbox() {
  const { mediaId: mediaIdParam } = useParams();
  const seed = useSeed();
  const { flash, node: toastNode } = useToast();

  // Slider 0..100. The free verification window is the lower portion; above
  // `freeStop` the request crosses into the metered tier.
  const [zoom, setZoom] = useState(28);
  const freeStop = 60;
  const inFreeWindow = zoom <= freeStop;

  // Resolve a media id: route param, else the seeded observation's first media,
  // else nothing (still render the principle).
  const mediaId = mediaIdParam ?? seed?.obsId ?? '';
  const koId = seed?.koId;
  const obsId = mediaIdParam ? undefined : seed?.obsId;

  // The resolution we request scales with the slider. At/below the free window we
  // request the verification edge; above it we request a larger edge (metered).
  const reqRes: number | 'verification' = inFreeWindow
    ? 'verification'
    : Math.round(VERIFICATION_MAX_EDGE * (1 + ((zoom - freeStop) / (100 - freeStop)) * 3));

  const mediaQ = useQuery({
    queryKey: ['media', mediaId, String(reqRes)],
    queryFn: () => ep.getMedia(mediaId, reqRes),
    enabled: !!mediaId,
    retry: 0,
  });

  const res = mediaQ.data as MediaResolution | undefined;
  // Effective edge for the badge/KV: prefer the server's maxEdge, else derive it.
  const edgePx = res?.maxEdge ?? (typeof reqRes === 'number' ? reqRes : VERIFICATION_MAX_EDGE);
  // Free is driven by the window (the AC 11.8 guarantee); the server flag confirms it.
  const free = inFreeWindow || (res?.free ?? false);

  const taxon = seed?.name;
  const caption = useMemo(
    () => (taxon ? `${taxon} — habit` : 'Organism image — habit'),
    [taxon],
  );

  const notFound = !!mediaId && mediaQ.isError;
  // Mirror LightboxStage: watermark NEVER in the free window; above it, honour the server flag.
  const watermarked = !inFreeWindow && (res?.watermark ?? true);
  const tierNote = res?.tierNote
    ?? (free
      ? 'Verification resolution: free and unmetered (AC 11.8).'
      : 'Deep zoom is the metered tier — preview only without access.');

  return (
    <div className="lb-page">
      <div className="lb-head">
        <div>
          <h1>Image lightbox</h1>
          <div className="sub">
            <span className="lb-evtag">evidence</span> &nbsp;an organism image backing a micro-observation
          </div>
        </div>
        <div className="spacer" />
        <span className="lb-id" aria-label="Media identifier">
          {mediaId ? mediaId : 'no media id'}
        </span>
      </div>

      {seed === undefined && !mediaIdParam ? (
        <div className="jose-loading">Loading media…</div>
      ) : (
        <div className="lb-grid">
          <div>
            <LightboxStage
              mediaId={mediaId}
              zoom={zoom}
              freeStop={freeStop}
              edgePx={edgePx}
              inFreeWindow={inFreeWindow}
              res={res}
              caption={notFound ? 'Image unavailable — descriptor only' : caption}
              taxon={taxon}
            />

            {/* zoom control: a slider */}
            <div className="lb-zoom">
              <span className="lb-zlabel">Zoom</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                aria-label="Image zoom"
                aria-valuetext={inFreeWindow ? 'verification resolution, free' : 'deep zoom, metered tier'}
                list="lb-zoom-ticks"
              />
              <datalist id="lb-zoom-ticks">
                <option value={freeStop} label="verification" />
              </datalist>
              <span className="lb-zval">{Math.round(edgePx)}px</span>
              <button
                className="jose-btn"
                onClick={() => setZoom(Math.min(zoom, freeStop))}
                disabled={inFreeWindow}
                aria-label="Reset to free verification resolution"
              >
                Fit to verification
              </button>
            </div>

            {/* the free-zone window made legible */}
            <div className="lb-zonebar" aria-hidden>
              <div className="free-zone" style={{ width: `${freeStop}%` }} />
            </div>
            <div className="lb-zonelegend">
              <span className="k"><span className="sw free" /> free · unmetered (verification)</span>
              <span className="k"><span className="sw metered" /> metered · deep zoom</span>
            </div>
          </div>

          <div>
            {/* The AC 11.8 statement — prominent, provenance-class red */}
            <div className="jose-card lb-freecard">
              <h3>Verification zoom is free</h3>
              <p>
                At or below the verification resolution, zoom is <span className="em">free and unmetered</span> —
                no paywall, no watermark. {free
                  ? 'You are within that window now.'
                  : 'Drag back below the verification tick to return to it.'}
              </p>
            </div>

            <div className="jose-card">
              <h3>Resolution</h3>
              <div className="lb-kv"><span className="k">tier</span><span className={`v ${free ? 'free' : ''}`}>{free ? 'verification — free' : 'deep zoom — metered'}</span></div>
              <div className="lb-kv"><span className="k">max edge</span><span className="v">{Math.round(edgePx)} px</span></div>
              <div className="lb-kv"><span className="k">watermark</span><span className="v">{watermarked ? 'preview' : 'none'}</span></div>
              <div className="lb-kv"><span className="k">attribution</span><span className="v">Casabio</span></div>
              {res?.mime ? <div className="lb-kv"><span className="k">type</span><span className="v">{res.mime}</span></div> : null}
              <p className="lb-note" style={{ marginTop: 10 }}>{tierNote}</p>
            </div>

            <div className="jose-card">
              <h3>Linked</h3>
              <ObservationLink koId={koId} obsId={obsId} />
              <button
                className="jose-btn"
                style={{ marginTop: 10 }}
                onClick={() => {
                  try { navigator.clipboard?.writeText(mediaId); } catch { /* clipboard blocked */ }
                  flash('Media id copied');
                }}
                disabled={!mediaId}
              >
                Copy media id
              </button>
            </div>

            <div className="jose-card">
              <h3>Deep zoom</h3>
              <p className="lb-note">
                IIIF tiles — regions never encode precise locality (§6). Tile requests
                expose only the generalised view; the exact coordinate stays behind the
                policy engine, the same as the distribution map.
              </p>
            </div>

            {notFound ? (
              <div className="jose-card">
                <h3>Media</h3>
                <p className="lb-note">
                  No media object for <span className="lb-mono">{mediaId}</span>. v1 media is
                  descriptor-level; the free-verification principle above still holds.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {toastNode}
    </div>
  );
}
