# 0017 — Project messaging in the Rust backend (slice E)

**Status:** accepted
**Date:** 2026-05-31
**Builds on:** 0003 (messages mock-first), 0010 (single-table design)

## Context

Messages/DMs/inbox/search were mock-only. This slice builds the first comms
backend — project **channels + messages + threads + read markers** — at HTTP
parity with the mock (the mock polls; no WebSocket yet).

## Decision

- **Channels** (`Conversation` kind=channel): `CONV#<id>/META` + a denormalised
  `PROJECT#<pid>/CONV#<id>` pointer (name/description) so listing a project's
  channels is one query. A default **"Commons"** channel is created in the
  `project::create` transaction (matching the default topic name).
- **Messages**: top-level at `CONV#<conv>/MSG#<ulid>`, replies at
  `CONV#<conv>/REPLY#<ulid>` — the split makes "list top-level" a clean range
  query (`BETWEEN MSG# AND MSG$`, scanned newest-first for the `before` cursor
  but **returned oldest-first** for chat display — see 0018) with no filter.
- **Threads**: a reply indexes on GSI3 `THREAD#<parentId>` and bumps the parent's
  `replyCount`/`lastReplyAt` in the same transaction.
- **Message-id → conversation**: top-level messages index on GSI3 `MSG#<id>` →
  `<convId>` (sparse, top-level only), so `…/messages/{id}/thread` and
  `…/thread/read` (which carry only the message id) resolve the conversation
  without a 4th GSI.
- **`author_display_name`** is denormalised onto each message at post time from
  the poster's project membership (no central user store; stale on rename — fine
  for chat).
- **Read markers**: `USER#<uid>/CONVREAD#<convId>` and
  `USER#<uid>/THREADREAD#<parentMsgId>`; unread = `Select=COUNT` over `MSG#`
  newer than the marker.
- **Access**: a channel's reads/writes require membership of its project.
- **Attachments** accepted but must be empty (S3 upload later); **no WebSocket**
  (FE polls); no edit/delete.

## API

`GET …/projects/{slug}/channels` · `GET …/conversations/{id}` ·
`GET/POST …/conversations/{id}/messages` · `POST …/conversations/{id}/read` ·
`GET …/messages/{id}/thread` · `POST …/messages/{parentId}/thread/read`.
OpenAPI + api-client regenerated. Channel/Message/Thread DTOs match the mock.

## Events

`message_posted` — `project_id`, `conversation_id`, `has_parent`, `by_user`
(**never the body** — chat content is PII). `channel_created` (default).

## Tests

- Unit (`domain/message.rs`): `validate_body`.
- Integration (`tests/messages_it.rs`, DynamoDB-Local): default "Commons"
  channel on project create; post + list (oldest-first page) + `before` pagination +
  `has_more`; replies form a thread + bump `reply_count` + a reply isn't
  resolvable as top-level; read marker → unread count; last-message is the newest
  top-level (a reply doesn't count).
- **Not integration-covered** (handler-layer, needs auth): non-member 403,
  reply-to-a-reply 400, attachments 400, empty body 400. Flagged.

## Notes / deviations

- The mock returns `409` "cannot reply to a thread reply"; the real backend
  returns `400` (a reply isn't a resolvable top-level parent) — same outcome,
  slightly different code.
- Channel-list builds `unread`/`last_message`/`member_count` with per-channel
  queries (N+1) — fine for a handful of channels; revisit with counters if it bites.

## Out of scope (later slices)

DMs (user-pair conversations + `/dms`), inbox fan-out, search, attachments/S3,
WebSocket live push, message edit/delete/reactions. **Wiring the FE messages off
the comms-mock onto this backend** is the next FE step (mirrors the
documents/categories migration).

## References

- `apps/api/src/domain/message.rs`, `repo/conversation.rs`, `repo/message.rs`,
  `handlers/conversations.rs`, `repo/project.rs` (default channel)
- `apps/api/tests/messages_it.rs`
- `apps/web/src/mocks/handlers/conversations.ts`, `mocks/db.ts` — parity source.
- Decisions 0003, 0010.
