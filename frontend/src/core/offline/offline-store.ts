/**
 * Offline public-projection store (Frontend Spec §2, §8). Split out from
 * `offline.ts` so the heavyweight `pouchdb-browser` dependency is NOT pulled into
 * the main bundle by every component that only needs `useOnline`. PouchDB is
 * dynamic-imported on first use (and replication is started off the critical path
 * from main.tsx), so a first-time read-only visitor on a slow connection doesn't
 * download/parse PouchDB before first paint.
 *
 * The local store replicates ONLY public projections (QDS-generalised); there is
 * no code path that writes or renders sub-QDS coordinates from it (AC 11.5).
 */
import type PouchDB from 'pouchdb-browser';

const COUCH_PUBLIC = (import.meta.env.VITE_COUCH_PUBLIC as string) || 'http://localhost:5984/jose_public';

// pouchdb-browser is published with an `export =` default; the dynamic import's
// namespace exposes the constructor as `.default` under esModuleInterop. Typed
// loosely here (the public API is re-tightened via PouchDB.Database below).
type PouchCtor = new (name?: string, opts?: Record<string, unknown>) => PouchDB.Database;
let pouchMod: Promise<{ default: PouchCtor }> | null = null;
function loadPouch(): Promise<{ default: PouchCtor }> {
  if (!pouchMod) pouchMod = import('pouchdb-browser') as unknown as Promise<{ default: PouchCtor }>;
  return pouchMod;
}

let localPublic: PouchDB.Database | null = null;
export async function getPublicStore(): Promise<PouchDB.Database> {
  if (localPublic) return localPublic;
  const Pouch = (await loadPouch()).default;
  const store: PouchDB.Database = new Pouch('jose_public_local');
  localPublic = store;
  return store;
}

/** One-way replication of public projections couch → local. Best-effort; needs Couch CORS. */
export async function startPublicReplication(): Promise<PouchDB.Replication.Replication<{}> | null> {
  try {
    const Pouch = (await loadPouch()).default;
    const remote = new Pouch(COUCH_PUBLIC, { skip_setup: true });
    const store = await getPublicStore();
    return store.replicate.from(remote, { live: true, retry: true });
  } catch {
    return null;
  }
}

/** Read a cached public projection by id (e.g. an observation) when offline. */
export async function getCachedPublic<T = unknown>(id: string): Promise<T | null> {
  try {
    const store = await getPublicStore();
    return (await store.get(id)) as unknown as T;
  } catch {
    return null;
  }
}
