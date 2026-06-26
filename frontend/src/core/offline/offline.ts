/**
 * Offline-first layer (Frontend Spec §2, §8). The local store replicates ONLY
 * public projections (QDS-generalised) — there is no client code path that writes
 * or renders sub-QDS coordinates from it (the anti-poaching guarantee, AC 11.5).
 * Precise data, when granted, is held in React state in memory and never put here.
 */
import PouchDB from 'pouchdb-browser';
import { useEffect, useState } from 'react';

const COUCH_PUBLIC = (import.meta.env.VITE_COUCH_PUBLIC as string) || 'http://localhost:5984/jose_public';

let localPublic: PouchDB.Database | null = null;
export function publicStore(): PouchDB.Database {
  if (!localPublic) localPublic = new PouchDB('jose_public_local');
  return localPublic;
}

/** One-way replication of public projections couch → local. Best-effort; needs Couch CORS. */
export function startPublicReplication(): PouchDB.Replication.Replication<{}> | null {
  try {
    const remote = new PouchDB(COUCH_PUBLIC, { skip_setup: true });
    return publicStore().replicate.from(remote, { live: true, retry: true });
  } catch {
    return null;
  }
}

/** Read a cached public projection by id (e.g. an observation) when offline. */
export async function getCachedPublic<T = unknown>(id: string): Promise<T | null> {
  try {
    return (await publicStore().get(id)) as unknown as T;
  } catch {
    return null;
  }
}

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
