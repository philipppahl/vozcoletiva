# 0032 — Cache-first reads: query-cache retention + persistence

**Status:** accepted
**Date:** 2026-06-03
**Builds on:** the TanStack Query data layer (frontend-stack.md)

## Context

Every API read in the web app already goes through a TanStack Query hook keyed
by the central `qk` factory (`lib/query.ts`); there are **no** component-local
fetches, and components gate their spinners on `.isLoading` (no cached data),
not `.isFetching`. So the app is already *cache-first* (stale-while-revalidate)
whenever cache exists. What made it *feel* like every screen reloaded was cache
**retention**, set centrally — not the modules:

- **`gcTime` was the 5-minute default** → an unused screen's cache was
  garbage-collected after 5 min, so revisiting later showed a spinner + refetch.
- **The cache was in-memory only** → a hard reload, or reopening the installed
  PWA, started empty, so every screen loaded fresh on cold start.

## Decision

Three central changes; **zero module rewrites** (the hooks were already right).

1. **Longer `gcTime` (24 h).** Unused query cache survives navigation, so
   navigate-away-and-back is always instant from cache.

2. **Persist the query cache** (`PersistQueryClientProvider` +
   `createSyncStoragePersister` over `localStorage`, key `voz.rq`). The PWA opens
   showing last-known data and revalidates in the background. Safeguards:
   - **`maxAge` = gcTime** (entries restore rather than being immediately GC'd).
   - **`buster` = `CACHE_VERSION`** — bumped only when a persisted DTO's *shape*
     changes (regenerated api-client), so an old bundle's cache is discarded, not
     mis-rendered. A deploy with unchanged shapes keeps the cache.
   - **`shouldDehydrateQuery` = success-only** — never persist in-flight/errored
     queries (would restore a broken loading state).

3. **Per-domain `staleTime`.** Default raised to 60 s; slow-changing reads
   (projects, members, documents, categories, the profile) use `STALE.slow`
   (5 min) so they barely revalidate on revisit. Live surfaces keep their own
   short windows + polling (chat, proposals-in-voting, inbox) and `keepPreviousData`
   (search).

## Privacy (the persistence trade-off)

The persisted cache holds the user's own data — including **chat message
content** — in `localStorage`. This is normal for a messenger (your data, your
device), and the user opted into persisting chat too. The guard rails:

- **Purge on sign-out.** `purgeQueryCache()` clears both the in-memory cache and
  the `voz.rq` storage key. Wired into `signOut()` **and** the API middleware's
  forced-401 sign-out, so a signed-out state — or a *different* next user on the
  same device — never sees the previous session's data. (Previously sign-out
  didn't clear the in-memory cache at all.)
- Shapes only persist successful results; tokens live in their own auth store,
  not the query cache.
- *Future:* move to IndexedDB if the cache outgrows the ~5 MB localStorage quota,
  and/or a per-key allowlist if message content at rest becomes a concern on
  shared devices.

## Dependencies (new — justified per CLAUDE.md)

- `@tanstack/react-query-persist-client`
- `@tanstack/query-sync-storage-persister`

Both are **official, first-party TanStack packages** for exactly this, version-
matched to `@tanstack/react-query` v5. Hand-rolling dehydrate/hydrate + maxAge +
buster would be more code and more error-prone for no benefit.

## Tests

- Type + lint + the existing 130 FE unit tests pass; production build verified.
- Browser: load screens → reload (cold start) renders from cache with no spinner,
  then revalidates; `localStorage['voz.rq']` present while signed in and removed
  on sign-out. (mobile + desktop, light + dark, console clean.)

## References

- `lib/query.ts` (gcTime, `persistOptions`, `STALE`, `purgeQueryCache`),
  `main.tsx` (`PersistQueryClientProvider`), `lib/auth/hooks.ts` + `lib/api.ts`
  (purge on sign-out / 401), `lib/{projects,documents,categories,profile,invites}.ts`
  (`STALE.slow`).
