import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as ep from '../../core/api/endpoints';
import { LightboxStage, ObservationLink, VERIFICATION_MAX_EDGE, type MediaResolution } from './LightboxStage';

/**
 * The shared JXL lightbox viewer (FE7 · §5.9 · AC 11.8): the metering-aware body
 * used by BOTH the /m/:mediaId route screen and the in-Reader LightboxModal.
 *
 * VERIFICATION ZOOM IS FREE AND UNMETERED: at/below the verification resolution
 * there is no paywall and no watermark; above it is the metered tier (the server's
 * `watermark` flag is honoured, but never inside the free window). Exercised live
 * against ep.getMedia(mediaId, res); v1 media is descriptor-level so the image is
 * a placeholder, but the principle is real.
 */
export interface LightboxViewerProps {
  mediaId: string;
  koId?: string;
  obsId?: string;
  taxon?: string;
  caption?: string;
  flash: (m: string) => void;
}

export function LightboxViewer({ mediaId, koId, obsId, taxon, caption, flash }: LightboxViewerProps) {
  const [zoom, setZoom] = useState(28);
  const freeStop = 60;
  const inFreeWindow = zoom <= freeStop;

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
  const edgePx = res?.maxEdge ?? (typeof reqRes === 'number' ? reqRes : VERIFICATION_MAX_EDGE);
  const free = inFreeWindow || (res?.free ?? false);
  const notFound = !!mediaId && mediaQ.isError;
  const watermarked = !inFreeWindow && (res?.watermark ?? true);
  const tierNote = res?.tierNote
    ?? (free
      ? 'Verification resolution: free and unmetered (AC 11.8).'
      : 'Deep zoom is the metered tier — preview only without access.');

  const figCaption = useMemo(
    () => (notFound ? 'Image unavailable — descriptor only' : caption ?? (taxon ? `${taxon} — habit` : 'Organism image — habit')),
    [notFound, caption, taxon],
  );

  return (
    <div className="lb-grid">
      <div>
        <LightboxStage
          mediaId={mediaId}
          zoom={zoom}
          freeStop={freeStop}
          edgePx={edgePx}
          inFreeWindow={inFreeWindow}
          res={res}
          caption={figCaption}
          taxon={taxon}
        />

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

        <div className="lb-zonebar" aria-hidden>
          <div className="free-zone" style={{ width: `${freeStop}%` }} />
        </div>
        <div className="lb-zonelegend">
          <span className="k"><span className="sw free" /> free · unmetered (verification)</span>
          <span className="k"><span className="sw metered" /> metered · deep zoom</span>
        </div>
      </div>

      <div>
        <div className="jose-card lb-freecard">
          <h2>Verification zoom is free</h2>
          <p>
            At or below the verification resolution, zoom is <span className="em">free and unmetered</span> —
            no paywall, no watermark. {free
              ? 'You are within that window now.'
              : 'Drag back below the verification tick to return to it.'}
          </p>
        </div>

        <div className="jose-card">
          <h2>Resolution</h2>
          <div className="lb-kv"><span className="k">tier</span><span className={`v ${free ? 'free' : ''}`}>{free ? 'verification — free' : 'deep zoom — metered'}</span></div>
          <div className="lb-kv"><span className="k">max edge</span><span className="v">{Math.round(edgePx)} px</span></div>
          <div className="lb-kv"><span className="k">watermark</span><span className="v">{watermarked ? 'preview' : 'none'}</span></div>
          <div className="lb-kv"><span className="k">attribution</span><span className="v">Casabio</span></div>
          {res?.mime ? <div className="lb-kv"><span className="k">type</span><span className="v">{res.mime}</span></div> : null}
          <p className="lb-note" style={{ marginTop: 10 }}>{tierNote}</p>
        </div>

        <div className="jose-card">
          <h2>Linked</h2>
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
          <h2>Deep zoom</h2>
          <p className="lb-note">
            IIIF tiles — regions never encode precise locality (§6). Tile requests
            expose only the generalised view; the exact coordinate stays behind the
            policy engine, the same as the distribution map.
          </p>
        </div>

        {notFound ? (
          <div className="jose-card">
            <h2>Media</h2>
            <p className="lb-note">
              No media object for <span className="lb-mono">{mediaId}</span>. v1 media is
              descriptor-level; the free-verification principle above still holds.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
