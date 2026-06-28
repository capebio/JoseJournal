import { useToast } from '../common/useToast';
import { useFocusTrap } from '../common/useFocusTrap';
import { LightboxViewer } from './LightboxViewer';

/**
 * In-Reader JXL lightbox (FE1 × FE7). Opens over the reading frame when a figure
 * is clicked, so verification zoom happens without leaving the treatment. Wraps
 * the shared LightboxViewer in an accessible dialog (Esc / backdrop close).
 */
interface LightboxModalProps {
  mediaId: string;
  koId?: string;
  obsId?: string;
  taxon?: string;
  caption?: string;
  onClose: () => void;
}

export function LightboxModal({ mediaId, koId, obsId, taxon, caption, onClose }: LightboxModalProps) {
  const { flash, node: toastNode } = useToast();
  const dialogRef = useFocusTrap<HTMLDivElement>(onClose);

  return (
    <div className="lb-modal-back" onMouseDown={onClose}>
      <div ref={dialogRef} className="lb-modal" role="dialog" aria-modal="true" aria-label="Image lightbox" onMouseDown={(e) => e.stopPropagation()}>
        <div className="lb-modal-head">
          <span className="lb-evtag">evidence</span>
          <span className="lb-modal-cap">{caption ?? 'Organism image'}</span>
          <span className="spacer" />
          <button className="lb-modal-close" aria-label="Close lightbox" onClick={onClose}>×</button>
        </div>
        <LightboxViewer mediaId={mediaId} koId={koId} obsId={obsId} taxon={taxon} caption={caption} flash={flash} />
        {toastNode}
      </div>
    </div>
  );
}
