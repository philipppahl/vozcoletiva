# 0027 — Live-ish chat via polling (interim, pre-WebSocket)

**Status:** superseded as primary by 0028 — polling is now the **fallback**
(WebSockets carry live delivery; polling backs off to a slow safety net while
the socket is up, and resumes fast intervals when it drops).
**Date:** 2026-06-02
**Builds on:** 0020/0021 (messaging), 0026 (optimistic updates)

## Context

Messages persisted but never appeared on the recipient's side until a reload:
`useMessages` / `useThread` had no `refetchInterval` and no
`refetchOnWindowFocus`, and the default 30 s `staleTime` meant an open
conversation never refetched after mount. There is no real-time transport — the
WebSocket "live chat" slice is not built yet.

## Decision

Poll the chat queries on a short interval — the same approach the proposal tally
already uses while voting. This delivers near-live updates with **no new infra**.

- `useMessages` / `useThread`: `refetchInterval` 4 s + `refetchOnWindowFocus`.
- `useChannels` / `useDms`: `refetchInterval` 8 s (list previews + unread badges).
- TanStack pauses interval refetches when the tab is hidden (default), so a
  backgrounded tab doesn't poll.
- **Optimistic-safe merge**: `useMessages` / `useThread` keep any client-only
  optimistic messages (temp ids with `_optimistic`) that the server doesn't have
  yet, so a background poll never wipes a pending bubble or a failed-retry (0026).

## Trade-offs

- Cost: ~15 req/min per open conversation + list polls. Fine at MVP scale;
  WebSocket removes it.
- A narrow race can briefly double a just-sent message if a poll lands between
  the POST reaching the server and the optimistic reconcile — self-heals on the
  next poll.

## Out of scope

Real-time push delivery (API Gateway WebSocket + AsyncAPI) — the proper fix,
a later slice. Also typing indicators, presence, read receipts.

## References

- `apps/web/src/lib/messages.ts` (`useMessages`, `useThread`, `useChannels`, `useDms`)
- Decisions 0020, 0026.
