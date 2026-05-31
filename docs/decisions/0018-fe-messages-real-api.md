# 0018 — Wire the FE Messages tab onto the real channels backend (slice E-FE)

**Status:** accepted
**Date:** 2026-05-31
**Builds on:** 0016 (FE↔real-API integration + comms-hybrid), 0017 (messaging backend)

## Context

Slice E (0017) shipped the channels/messages/threads/read backend at HTTP parity
with the comms-mock, but the webapp's Messages tab still read from the mock via
the leftover `mockGet`/`mockPost` helper (relative `/v1` + `Bearer mock`). DMs,
inbox, and search have **no** backend yet and must stay on the mock.

## Decision

Same migration pattern as `lib/documents.ts` / `lib/categories.ts` (0016):

- **`apps/web/src/lib/messages.ts`** — channels, conversation, messages, thread,
  send, and read now call the real API through `apiClient` (openapi-fetch, real
  base URL + Cognito **access** token). `useDms`/`useStartDm` stay on the
  relative `mockGet`/`mockPost` helper (no `/dms` backend).
- **`apps/web/src/mocks/handlers/conversations.ts`** — the comms-mock now serves
  **only mock DMs**. `GET /projects/:slug/channels` is dropped from the mock
  (→ real). The five shared conversation/message handlers passthrough anything
  that isn't a mock DM, discriminated by id:
  - `isMockDmConversation(id)` — the id is a `kind:'dm'` conversation in the mock db.
  - `isMockDmMessage(messageId)` — the message's conversation is a mock DM.
  Real channel ids are ULIDs and aren't in the mock db, so they passthrough.
  `passthrough()` re-issues to the request's **actual** URL — which is why
  `lib/messages.ts` must hit the real base URL via `apiClient` (a relative
  `mockGet` can't passthrough to the real API).
- **Message order**: the FE treats `messages[length-1]` as newest, so
  `message::list_top_level` now returns the page **oldest-first** (it still
  scans newest-first internally for the `before` cursor, then `.reverse()`s).
  Mirrors the mock's order. `messages_it.rs` assertions updated.
- **Types**: kept the local `lib/messages/types.ts` shapes (they already match
  the generated api-client) and cast at the `apiClient` call sites, rather than
  re-aliasing every component to the generated schema. Simpler; deviates from
  the plan's "alias the types" line.
- **Seed**: `seed-dev.ts` posts a few messages + one thread + a read marker into
  each project's default Commons channel, so the Messages tab has real content.

## API

No new endpoints — consumes 0017's surface. The webapp now uses the same
channel/message/thread/read endpoints an external integration would.

## Events

None new (read-path + reuse of 0017's `message_posted`).

## Tests

- Backend: `messages_it.rs` re-asserted for the oldest-first page order (5/5
  pass against DynamoDB-Local).
- FE: `tsc --noEmit` + `biome check` clean. No new unit tests — this is a
  thin-client wiring change; behaviour is covered by the backend integration
  tests and the manual browser walkthrough below.

## Manual UI verification

Hosted dev CloudFront (`d2z77c7we4tkm9.cloudfront.net`) + the seeded data, signed
in as marina, mobile 390×844 and desktop 1280×800, light **and** dark:

- Channels list shows the real **Commons** channel with a real last-message
  preview + unread count.
- Channel view lists real messages oldest→newest; a seeded thread shows
  "2 replies".
- Posted a top-level message and a thread reply live → both hit the real backend;
  the reply bumped the parent to "3 replies".
- Read marker cleared the channel's unread on open (nav badge 2→1, the remaining
  1 being a mock DM).
- Mock DMs still open with full mock history; inbox + search still mock.
- Console clean of errors throughout (0 errors).

## Known limitations / anomalies

- ~~**Author names render as the user's UUID**~~ — **resolved in
  [0019](0019-display-name-profile.md)**: the backend profile is now the single
  source of truth for the display name (`PATCH /v1/me`), the FE syncs it from
  `GET /me`, and the seed sets real names. Cognito is auth-only.
- **Mock search results link to mock channel ids** (e.g. `ch-vmc-bikes`) that
  won't resolve against the real API if opened — search has no backend yet
  (0017 out-of-scope). Expected under the hybrid.

## Out of scope (later slices)

DMs / inbox / search backends, WebSocket live push, the "+ New channel" create
endpoint, attachments/S3, message edit/delete/reactions, and the display-name
identity fix above.

## References

- `apps/web/src/lib/messages.ts`, `apps/web/src/mocks/handlers/conversations.ts`
- `apps/web/scripts/seed-dev.ts` (channel-chat seeding)
- `apps/api/src/repo/message.rs` (`list_top_level` oldest-first), `tests/messages_it.rs`
- Decisions 0016, 0017.
