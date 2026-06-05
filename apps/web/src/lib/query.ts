import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';

/**
 * Cache-first everywhere (decision 0032). TanStack already serves cached data
 * and revalidates in the background; these two knobs make that survive
 * navigation + cold starts:
 *  - gcTime keeps an unused query's cache around long enough to re-render
 *    instantly on revisit (must be ≥ the persist maxAge or restored entries are
 *    GC'd immediately).
 *  - a longer default staleTime means fewer background revalidations; live
 *    surfaces (chat, voting, inbox) opt back into short windows + polling.
 */
const GC_TIME = 24 * 60 * 60_000; // 24h
const DEFAULT_STALE = 60_000; // 1 min

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      gcTime: GC_TIME,
      staleTime: DEFAULT_STALE,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Bump when a persisted DTO's *shape* changes (regenerated api-client), so stale
 * cache from an older bundle is discarded rather than rendered. A new deploy
 * with unchanged shapes keeps the cache (the whole point of persistence).
 */
// '2': Comment DTO gained reply_to + reactions (decision 0033).
const CACHE_VERSION = '2';
const PERSIST_KEY = 'voz.rq';

const persister =
  typeof window === 'undefined'
    ? undefined
    : createSyncStoragePersister({ storage: window.localStorage, key: PERSIST_KEY });

/** Options for `PersistQueryClientProvider` — restore last-known data on open,
 *  then revalidate. Only successful queries are written. */
export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> | undefined = persister
  ? {
      persister,
      maxAge: GC_TIME,
      buster: CACHE_VERSION,
      dehydrateOptions: {
        // Never persist in-flight / errored queries (would restore a broken
        // loading state).
        shouldDehydrateQuery: (q) => q.state.status === 'success',
      },
    }
  : undefined;

/** Per-domain freshness windows (decision 0032). Slow-changing reads (projects,
 *  members, documents, categories, the profile) barely revalidate on revisit;
 *  live surfaces (chat, voting, inbox) keep their own short windows + polling. */
export const STALE = { slow: 5 * 60_000 } as const;

/** Drop both the in-memory cache and the persisted copy. Call on sign-out so a
 *  signed-out / next user never sees the previous session's data (PII). */
export function purgeQueryCache() {
  queryClient.clear();
  if (typeof window !== 'undefined') window.localStorage.removeItem(PERSIST_KEY);
}

/**
 * Centralised query-key factory. Every cache key shape lives here so renames
 * and invalidations are uniform.
 */
export const qk = {
  me: () => ['me'] as const,
  devicePushPrefs: () => ['push', 'device-prefs'] as const,
  projects: {
    all: ['projects'] as const,
    list: () => ['projects', 'list'] as const,
    detail: (slug: string) => ['projects', 'detail', slug] as const,
    members: (slug: string) => ['projects', 'detail', slug, 'members'] as const,
    invites: (slug: string) => ['projects', 'detail', slug, 'invites'] as const,
    proposals: (slug: string) => ['projects', 'detail', slug, 'proposals'] as const,
    proposal: (slug: string, id: string) => ['projects', 'detail', slug, 'proposals', id] as const,
    proposalTree: (slug: string, id: string) =>
      ['projects', 'detail', slug, 'proposals', id, 'tree'] as const,
    comments: (slug: string, id: string) =>
      ['projects', 'detail', slug, 'proposals', id, 'comments'] as const,
    channels: (slug: string) => ['projects', 'detail', slug, 'channels'] as const,
    documents: (slug: string) => ['projects', 'detail', slug, 'documents'] as const,
    document: (slug: string, name: string) =>
      ['projects', 'detail', slug, 'documents', name] as const,
    search: (slug: string, query: string) => ['projects', 'detail', slug, 'search', query] as const,
    categories: (slug: string) => ['projects', 'detail', slug, 'categories'] as const,
  },
  invites: {
    byToken: (token: string) => ['invites', 'by-token', token] as const,
    byCode: (code: string) => ['invites', 'by-code', code] as const,
  },
  inbox: {
    list: () => ['inbox', 'list'] as const,
  },
  chat: {
    dms: () => ['chat', 'dms'] as const,
    conversation: (id: string) => ['chat', 'conversation', id] as const,
    messages: (conversationId: string) =>
      ['chat', 'conversation', conversationId, 'messages'] as const,
    thread: (parentMessageId: string) => ['chat', 'thread', parentMessageId] as const,
  },
};
