# 0003 — Messages: ship the FE shape ahead of the BE

**Status:** accepted
**Date:** 2026-05-20
**Slice:** M2 of the mock-first design integration (see `docs/design/ext-2026-05-19/integration-plan.md`)

## Context

Chat is a sizeable surface — channels, DMs, threads, attachments, mentions, real-time arrivals. Getting it right visually before committing to a wire contract is worth a slice. M2 builds the entire UI against MSW handlers, with an in-process pub/sub that stands in for the eventual WebSocket. The real BE catches up in a later slice.

## Decision

The mock layer serves a complete chat surface that the OpenAPI spec doesn't declare yet. The FE consumes it via the types in `apps/web/src/lib/messages/types.ts`. Same "shim now, delete when the real spec catches up" pattern as forks (decision 0002).

### Entities

- `Conversation` (discriminated union):
  - `channel` — per-project, named, `description`, `member_count`.
  - `dm` — 1:1, cross-project, `participants` (always sorted by id so the pair is a stable lookup key).
- `Message` — `id`, `conversation_id`, optional `parent_message_id`, `author_id`, `author_display_name`, `body`, `attachments[]`, `created_at`, `edited_at?`, `reply_count`, `last_reply_at?`.
- `Attachment` — `kind: 'image' | 'voice'`, `url`, optional `width`/`height`/`durationMs`.
- `ConversationRead` — per-user last-read marker per conversation.
- `ThreadRead` — per-user last-read marker per thread parent.

### Endpoints (mock-only this slice)

- HTTP:
  - `GET /v1/projects/{slug}/channels`
  - `GET /v1/dms`
  - `GET /v1/conversations/{id}`
  - `GET /v1/conversations/{id}/messages?before&limit`
  - `GET /v1/messages/{id}/thread`
  - `POST /v1/conversations/{id}/messages` (body: `{ body, attachments?, parent_message_id? }`)
  - `POST /v1/conversations/{id}/read` (body: `{ message_id }`)
  - `POST /v1/messages/{id}/thread/read` (body: `{ message_id }`)
  - `POST /v1/dms` (body: `{ user_id }`) — idempotent on the canonicalised `{caller, peer}` pair
- WebSocket (future, mock substitute now): `conversation.message-created`, `conversation.message-edited`, `conversation.read`.

### Threading rules

- A message can be a top-level message OR a reply to a top-level message. We do **not** allow nested threads — replies cannot themselves be parents. Enforced server-side (mock handler returns 409).
- The conversation timeline shows top-level messages only. The thread overlay shows the parent + all replies.
- Each thread has its own unread count, derived from a per-(thread, user) last-read marker. Until the user opens a thread, the unread count for it is the number of replies created after the user's conversation-level last-read.

### DM idempotency

`POST /v1/dms { user_id }` looks up the existing DM between `caller` and `peer` using the canonicalised pair `[min(caller, peer), max(caller, peer)]`. If found, returns it. Otherwise creates one. Means "tap to DM" is safe to retry; no duplicate DMs.

### Inline-only Markdown

Chat bubbles use a stripped-down Markdown renderer (`MessageMarkdown`) that supports `**bold**`, `*italic*`, `` `code` ``, `[text](url)`, and `@u-id` mention tokens. No headings, lists, blockquotes — too much visual weight in a bubble.

## Why mock-first

Same reasoning as forks (decision 0002): we want to iterate on chat UX before locking the wire contract. The shim is small, isolated, deletable in one PR; the alternative (regenerate OpenAPI now) bakes in mistakes we make iterating on the design.

## What lands when the real BE catches up

1. `apps/api/openapi.yaml` adds the conversation + message + thread schemas and the endpoints.
2. `apps/api/asyncapi.yaml` (new) declares the `conversation.message-created` event shape.
3. `bun run api:generate` regenerates `packages/api-client/src/generated/schema.ts`.
4. `apps/web/src/lib/messages/types.ts` (this shim) gets deleted.
5. The `mockGet`/`mockPost` helpers in `apps/web/src/lib/messages.ts` are replaced with `apiClient.GET`/`apiClient.POST` calls.
6. `apps/web/src/mocks/messageBus.ts` stays as a test double; production swaps in a real `wss://...` consumer.
7. The Rust handlers learn to read/write the new entities. DynamoDB items per the sketch below.

## DynamoDB sketch (NOT implemented this slice)

- `Conversation` items:
  - Channel: `PK = "PROJECT#{projectId}"`, `SK = "CHANNEL#{channelId}"`.
  - DM: `PK = "DM_PAIR#{minUserId}#{maxUserId}"`, `SK = "DM#{dmId}"`. Deterministic PK gives idempotent find-or-create without a scan.
  - **GSI1** (`USER#{userId}` partition): every conversation gets a "membership-shadow" item under each participant's user partition for fast "my DMs / channels" listing.
- `Message` items:
  - `PK = "CONV#{conversationId}"`, `SK = "MSG#{createdAtIso}#{messageId}"`.
  - Top-level messages have `ParentMessageId` absent. Timeline view: `Query` with `FilterExpression: attribute_not_exists(ParentMessageId)`.
  - **GSI2** (`PARENT#{parentMessageId}` partition): `GET /messages/{id}/thread` is one Query.
- `ConversationRead`: `PK = "USER#{userId}"`, `SK = "CONV_READ#{conversationId}"`.
- `ThreadRead`: `PK = "USER#{userId}"`, `SK = "THREAD_READ#{parentMessageId}"`.

## What this decision is *not*

- Not a commitment to ship channel administration (create / rename / archive) in M2. Tracked as **M2-admin** in the integration plan.
- Not a commitment to group DMs. The schema admits `participants: Array` (not a fixed 2-tuple) so we don't need to migrate when group DMs land — **M2-group-dms** in the plan.
- Not a commitment to reactions / edit / delete / pin / search. Each is its own follow-up slice (**M2-polish**).
- Not a real WebSocket. The in-process bus is mock-only; the real WS lands with **M2-real-ws** alongside the BE wire-up.

## References

- `apps/web/src/mocks/handlers/conversations.ts` — all chat handlers.
- `apps/web/src/mocks/messageBus.ts` — pub/sub + auto-emit timer.
- `apps/web/src/components/messages/*` — UI components.
- `apps/web/src/lib/messages/types.ts` — FE-side shim.
- `docs/conventions/mocks.md` § *Simulated real-time*.
