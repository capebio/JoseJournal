import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useSeed } from '../core/seed';
import { useToast } from '../components/common/useToast';
import { LightboxViewer } from '../components/media/LightboxViewer';

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

  // Resolve a media id: route param, else the seeded observation's first media,
  // else nothing (the viewer still renders the free-verification principle).
  const mediaId = mediaIdParam ?? seed?.obsId ?? '';
  const koId = seed?.koId;
  const obsId = mediaIdParam ? undefined : seed?.obsId;
  const taxon = seed?.name;
  const caption = useMemo(() => (taxon ? `${taxon} — habit` : undefined), [taxon]);

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
        <LightboxViewer mediaId={mediaId} koId={koId} obsId={obsId} taxon={taxon} caption={caption} flash={flash} />
      )}

      {toastNode}
    </div>
  );
}
