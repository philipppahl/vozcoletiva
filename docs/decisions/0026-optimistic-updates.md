# 0026 — Optimistic UI updates (instant local, async remote)

**Status:** accepted
**Date:** 2026-06-02
**Builds on:** the TanStack Query data layer (frontend-stack)

## Context

Every mutation awaited the server then invalidated + refetched, so the UI lagged
the full round-trip — sending a message, voting, ticking a toggle all felt slow.
We want the app to react immediately and reconcile with the server in the
background.

## Decision

Per-mutation **optimistic updates** (not a local-first store / sync queue). Each
mutation writes the local React Query cache in `onMutate` (before the request);
the server reconciles on `onSettled`; failures restore the snapshot.

```
onMutate:  cancelQueries → snapshot → setQueryData(transform) → return snapshot
onError:   restore snapshot  (+ toast, or keep a "failed" marker for sends)
onSettled: invalidateQueries (server is authoritative; drift self-heals)
```

- **Reusable plumbing** (`lib/optimistic.ts`): `applyPatches` / `rollback` /
  `tempId`. Pure transforms live next to their domain so they're unit-testable.
- **Failure UX**: a minimal global **toast** (`lib/toast.ts` + `ui/Toaster.tsx`)
  surfaces rolled-back mutations so they aren't silent. **Message sends keep the
  bubble** with a "Couldn't send — Retry" affordance instead of vanishing (the
  bubble carries a client-only `_optimistic: 'pending' | 'failed'` marker;
  `pending` dims it; success replaces the temp id with the server message).
- **Composer** clears instantly (the bubble already shows) rather than after the
  round-trip.

## Surfaces covered

| Surface | Optimistic behaviour |
|---|---|
| Send message (channel + DM + thread reply) | instant bubble (temp→real), pending/failed/retry |
| Mark conversation read | unread badge clears instantly |
| Cast / retract vote | your-choice + tally bar flip instantly (pure `applyVote`/`applyRetract`) |
| Withdraw proposal | status → withdrawn instantly |
| Create / edit / delete comment | instant insert / edit / soft-delete |
| Inbox mark-read / read-all | unread count + badges clear instantly |
| Notification prefs toggles | flip instantly |
| Display name | name + avatar update instantly |
| Create / rename / delete topic | instant list change |
| Revoke invite | row removed instantly |

**Not optimistic** (deliberately): create proposal / project, accept invite —
they navigate to a new server-assigned entity, so they keep their existing
"pending" button state and confirm against the server. `useStartDm` likewise
needs the real conversation id before navigating.

## Tests

- Unit (`tests/vote-optimistic.test.ts`): the tally transforms — fresh pick,
  move, pick↔abstain↔none transitions, re-affirm no-op, retract.
- Manual (throttled network): bubble/vote/toggle react instantly; a forced
  failure rolls back + toasts (or shows the message-retry); no duplicates after
  the server reconciles.

## Risks

- Tally math must mirror the server — `onSettled` refetch corrects any drift.
- Temp→real reconciliation replaces by temp id; a refetch dedupes as a backstop.
- `cancelQueries` in `onMutate` stops an in-flight refetch from clobbering the
  optimistic state.

## References

- `apps/web/src/lib/optimistic.ts`, `lib/toast.ts`, `components/ui/Toaster.tsx`
- `lib/messages.ts`, `lib/proposals.ts` + `proposals/voteOptimistic.ts`,
  `lib/comments.ts`, `lib/inbox.ts`, `lib/push.ts`, `lib/categories.ts`,
  `lib/invites.ts`, `lib/profile.ts`
- `components/messages/MessageRow.tsx` (pending/failed/retry)
