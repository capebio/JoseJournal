import { useOnline } from '../../core/offline/offline';

/**
 * Online/offline indicator for the field app (Frontend Spec §5.5, §8). Offline,
 * the smallest citable knowledge object — a micro-observation — is still authored
 * locally; it queues and syncs as a QDS public projection + precise-to-server when
 * the connection returns. We never lose the capture for want of a network.
 */
export function OfflineBadge() {
  const online = useOnline();
  return (
    <span
      className={`cap-net ${online ? 'on' : 'off'}`}
      role="status"
      aria-live="polite"
      aria-label={online ? 'Online — observations sync immediately' : 'Offline — observations will sync when reconnected'}
      title={online ? 'Online — observations sync immediately' : 'Offline — captures queue locally and sync later'}
    >
      <span className="dot" aria-hidden />
      {online ? 'Online' : 'Offline — will sync'}
    </span>
  );
}
