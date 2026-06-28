/**
 * Offline-first hooks (Frontend Spec §2, §8). This module is intentionally
 * PouchDB-free so importing `useOnline` (which the always-loaded shell does)
 * does not pull the heavy pouchdb-browser dependency into the main bundle. The
 * actual public-projection store lives in `offline-store.ts` and lazy-loads
 * PouchDB on demand.
 */
import { useEffect, useState } from 'react';

export function useOnline(): boolean {
  const [online, setOnline] = useState<boolean>(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}
