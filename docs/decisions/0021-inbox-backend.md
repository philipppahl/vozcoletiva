# 0021 — Inbox / notifications backend (fan-out on write)

**Status:** accepted
**Date:** 2026-05-31
**Builds on:** 0017–0020 (messaging), 0019 (profiles)

## Context

The inbox ("this needs you") was the last comms surface but one on the mock.
It collects notifications a member should see: replies to their threads,
comments on their proposals, deliberations they voted in closing, and mentions.

## Decision

Fan-out-on-write: when a trigger happens, compute the entitled recipient set and
write one denormalised inbox item per recipient. Reads need no joins.

- **Item:** `USER#<recipient>/INBOX#<ulid>` (ulid SK = newest-first). Denormalised
  `actorDisplayName`/`projectSlug`/`projectName` + refs + `preview` + `readAt?`.
  Recipients are always entitled to see the source, so the stored preview leaks
  nothing.
- **Kinds:** `reply` (thread reply → prior participants, cap 12), `comment-on-yours`
  (proposal author), `proposal-closed` (decisive voters), `document-amended`
  (voters, when the winner is a Document), and **`mention`** (see below).
- **Shared `notify` module** (lib-level) called from both Lambdas: the API
  (message + comment create) and the worker (close job). **Best-effort** — a
  fan-out failure is logged, never failing the user's underlying action.
- **Endpoints:** `GET /v1/me/inbox?before=&limit=` → `{ items, unread_count }`;
  `POST /v1/me/inbox/:id/read`; `POST /v1/me/inbox/read-all`.
- `unread_count` = `Query … FILTER attribute_not_exists(readAt) Select=COUNT`;
  `read-all` queries unread → loops `UpdateItem`.

### Mentions (included, with a real-id token format)

The composer already inserts `@<user-id>` via its member picker. The id is a
Cognito `sub` — a lowercase UUID — but the old parser regex required a leading
letter (mock `@u-marina` ids), so real subs (often digit-led) didn't parse. Fixed
by matching the **UUID shape** end-to-end:
- FE `parseMentions` (renderer) matches `@<uuid>` → resolves to `@Display Name`
  via the member directory.
- Backend `notify` extracts `@<uuid>` and fans out `mention` to **project
  members** only (channel messages + proposal comments), excluding the actor (and
  the proposal author, who already got `comment-on-yours`). DMs produce no
  mentions in v1 (not project-scoped).

This makes mentions robust for any user id without a separate token format — and
was cheaper to do now than to weave a parser change in later.

## API

3 endpoints (above). `InboxItem` DTO matches the existing FE shape (snake_case,
all five kinds). OpenAPI + api-client regenerated.

## Data model (single-table, no new GSI)

| Item | PK / SK | Notes |
|---|---|---|
| Inbox item | `USER#<recipient>` / `INBOX#<ulid>` | denormalised actor/project + refs + preview + `readAt?` |

`add_items` BatchWrites in 25s. Intra-millisecond order between two items for the
same user is unspecified (ULID time prefix orders across events) — fine, since a
user rarely gets two items from one event (mention+reply is de-duped).

## Events

`inbox_fanout` — `trigger`, `recipient_count` (no preview/body — PII). Each
trigger site also logs `inbox_fanout_failed` on a best-effort failure.

## Tests

- Integration (`tests/inbox_it.rs`, DDB-Local): add/list/`unread_count`/`mark_read`
  (idempotent + missing→false)/`mark_all_read` + isolation; `proposal_comment`
  notifies the author not the commenter; `deliberation_closed` notifies decisive
  voters only (abstainers excluded).
- Unit (`notify`): UUID-mention extraction (ignores `@word` + emails), dedup,
  preview truncation/whitespace.
- FE: `parseMentions` test updated to UUID tokens; `tsc` + `biome` clean.

## FE

- `lib/inbox.ts` → `apiClient`. The inbox UI (header badge, per-project dots,
  inbox list, mark-read) lights up unchanged.
- `mentions.ts` regex → UUID. Composer + renderer already handle `@<id>`.
- **Retired the mock inbox** entirely: deleted the HTTP handler, the `inboxEmit`
  fan-out module + its test, and the emit calls in the mock comment/close
  handlers. Only **search** remains on the mock now. Full-mock mode
  (`VITE_USE_MOCKS=1`) no longer serves the inbox — consistent with 0020.
- Seed: re-seeding generates a realistic inbox from the existing comments /
  thread reply / closes, plus one seeded `@mention`.

## Out of scope (later)

Notification **preferences / muting** (`NOTIFPREF#` — with the Web Push slice),
**Web Push** delivery (VAPID), DM notifications, inbox TTL, real-time inbox push,
a `/me/contacts` endpoint, and a comment-composer mention popover (the backend
parses comment mentions already; only the message composer has the picker UI).

## References

- `apps/api/src/repo/inbox.rs`, `notify.rs`, `handlers/inbox.rs`,
  `repo/vote.rs::voters`; hooks in `handlers/conversations.rs`,
  `handlers/comments.rs`, `jobs/close_proposal.rs`; `tests/inbox_it.rs`
- `apps/web/src/lib/inbox.ts`, `components/messages/mentions.ts`, `scripts/seed-dev.ts`
- Decisions 0017–0020.
