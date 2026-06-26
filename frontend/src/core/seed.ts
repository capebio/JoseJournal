import { useEffect, useState } from 'react';

/** The seeded flagship treatment ids (written by scripts/seed-flagship.mjs). The
 *  demo entry point so the app opens on a real, fully-exercised treatment. */
export interface Seed { koId: string; vorVersionId: string | null; doi: string | null; obsId: string; snippetId: string; name: string }

let cached: Promise<Seed | null> | null = null;
export function getSeed(): Promise<Seed | null> {
  if (!cached) cached = fetch('/seed.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return cached;
}

export function useSeed(): Seed | null | undefined {
  const [seed, setSeed] = useState<Seed | null | undefined>(undefined);
  useEffect(() => {
    getSeed().then(setSeed);
  }, []);
  return seed;
}
