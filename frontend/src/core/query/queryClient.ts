import { QueryClient } from '@tanstack/react-query';

/**
 * Server state via TanStack Query (Frontend Spec §2, §9). Cache key includes the
 * lens, so toggling a lens is instant after first load. Release/VoR mutations are
 * never optimistic — they await the authoritative server response (§9).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

/** Query-key helpers keyed by (entity|version, lensState) per §9. */
export const qk = {
  read: (koId: string, lensKey: string) => ['ko', koId, lensKey] as const,
  version: (koId: string, verId: string) => ['ko', koId, 'v', verId] as const,
  history: (koId: string) => ['ko', koId, 'history'] as const,
  reviews: (koId: string) => ['ko', koId, 'reviews'] as const,
  coauthors: (koId: string) => ['ko', koId, 'coauthors'] as const,
  provenance: (koId: string) => ['ko', koId, 'provenance'] as const,
  map: (koId: string) => ['map', koId] as const,
  aiDecl: (koId: string) => ['ko', koId, 'ai'] as const,
  search: (key: string) => ['search', key] as const,
  snippet: (id: string) => ['snippet', id] as const,
};
