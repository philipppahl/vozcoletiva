# 0020 — Direct messages backend (user-pair conversations)

**Status:** accepted
**Date:** 2026-05-31
**Builds on:** 0017 (messaging backend), 0018 (FE messages wiring), 0019 (profile display names)

## Context

Channels went real in slice E / E-FE, but **DMs** (1:1 conversations) were the
last comms surface still on the mock. They differ from channels: not
project-scoped, identified by a **user pair**, and idempotent (the same two users
always resolve to the same conversation).

## Decision

Reuse slice-E's message/thread/read machinery unchanged (it's conversation-id
keyed, kind-agnostic) and generalise the conversation layer to be **kind-aware**.

- **Kind-aware META.** `CONV#<id>/META` carries `type` — `Channel` (existing) or
  `DirectMessage` (`participantIds` as a sorted 2-element string set, no
  `projectId`). `conversation::get_meta` returns a `ConversationMeta` enum
  (`Channel(Conversation)` | `Dm(DmConversation)`).
- **Access generalised.** The shared endpoints (`GET /conversations/{id}`,
  `/messages`, `/read`, `/messages/{id}/thread`, `/thread/read`) now authorise
  via `authorize_conversation`: channel → project member; DM → one of the two
  participants. Channel behaviour is unchanged.
- **Idempotent pair create.** `create_or_get_dm` sorts the pair `[lo, hi]` and
  uses a sentinel `DMPAIR#<lo>#<hi>/CLAIMED → conversationId` (conditional
  `attribute_not_exists`, mirroring the slug-claim pattern). One transaction
  writes META + sentinel + a per-user pointer each; a lost create race re-reads
  the sentinel and returns the winner.
- **List my DMs.** Per-user pointers `USER#<uid>/DM#<convId>` (with `peerId`) →
  `GET /dms` is one `Query` per user. No new GSI.
- **Names resolved live.** Participant display names come from the profile
  (0019's source of truth) at view time — a couple of `GetItem`s per DM, like
  channel `member_count`. DM message `author_display_name` is denormalised from
  the poster's **profile** (channels still use membership name).

## API

- `GET /v1/dms` → `{ dms: DmConversation[] }` (caller's DMs, most-recent first).
- `POST /v1/dms { user_id }` → `DmConversation` (idempotent; 400 self-DM,
  404 unknown peer). The peer must already have a profile.
- `GET /conversations/{id}` now returns a channel **or** a DM (`oneOf`,
  discriminated by `kind`); other conversation endpoints accept both kinds.
- `DmConversation { kind:"dm", id, participants:[{user_id,display_name}],
  last_message, unread_count }`. OpenAPI + api-client regenerated.

## Data model (single-table, no new GSI)

| Item | PK / SK | Notes |
|---|---|---|
| DM meta | `CONV#<id>` / `META` | `type=DirectMessage`, `participantIds=[lo,hi]` |
| Pair sentinel | `DMPAIR#<lo>#<hi>` / `CLAIMED` | `conversationId`; conditional create = idempotency |
| User pointer | `USER#<uid>` / `DM#<convId>` | `peerId`; lists a user's DMs |

Messages/threads/read markers are the **same items** as channels.

## Events

`dm_created` — `conversation_id`, `by_user`, `peer_user` (ids only). DM posts
reuse `message_posted` (logged with `conversation_kind=dm`; **never** the body —
chat is PII).

## Tests

- Integration (`tests/dms_it.rs`, DDB-Local): create-or-get idempotency
  (order-independent), distinct pairs distinct convs, `list_dms` for both
  participants + empty for a non-participant, `get_meta` resolves a DM, and
  post/read works in a DM via the reused message repo.
- `messages_it.rs` re-run to confirm the access refactor didn't regress channels.
- Not integration-covered (handler/auth): 400 self-DM, 404 unknown peer,
  non-participant 403 — flagged, consistent with 0017.

## FE

- `useDms`/`useStartDm` migrated to `apiClient`. The start-DM UX already existed
  (`MemberPickerSheet` → `useStartDm` → `/dms/$id`), sourcing co-members from the
  real `useMembers`; it lights up unchanged.
- The comms-mock conversation handlers are **retired** (file deleted, dropped
  from both the full-mock and hybrid registrations). Only **inbox + search**
  remain on the mock. Note: full-mock mode (`VITE_USE_MOCKS=1`) no longer serves
  the messaging surface — it was already partial since channels went real at
  E-FE; the maintained dev path is hybrid + real API.

## Manual UI verification

Deployed to dev + re-seeded; hosted CloudFront, mobile 390×844, light + dark,
**multiple real users** (separate Cognito logins / sessions):

- Seeded DMs render with real peer names, previews, and unread badges.
- Cross-session round-trip: Marina sends → Tomás (separate login) sees it in his
  list + conversation → replies → Marina sees the reply with an unread badge.
- Read marker clears unread on open (Tomás 4 → 0).
- Member picker lists real co-members; starting a DM opens the empty state, then
  the first message posts.
- **Idempotency**: re-picking a peer returns the same conversation (UI); and on
  the real backend Rafael→Marina and Marina→Rafael resolve to the **same id**
  (cross-user, order-independent).
- **Access control** (probed with a non-participant's real token): foreign-DM
  read/list/post all **403**; self-DM **400**; unknown peer **404**; own empty
  list **200**.
- Console clean of app errors. Dark mode renders correctly.

## Out of scope

Group DMs (3+), a `/v1/me/contacts` endpoint (the picker still aggregates
`useMembers`), a server-side "must share a project" guard on `POST /dms`
(MVP requires only that the peer exists), blocking/muting, DM requests,
attachments, WebSocket.

## References

- `apps/api/src/repo/conversation.rs`, `handlers/conversations.rs`,
  `repo/user.rs::get_profile`, `tests/dms_it.rs`
- `apps/web/src/lib/messages.ts`, `mocks/browser.ts`, `scripts/seed-dev.ts`
- Decisions 0017, 0018, 0019.
