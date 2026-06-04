# 0033 — Chat-style proposal comments: reactions + quote-reply

Status: accepted · 2026-06-03

## Context

Proposal/document discussion used plain comments (author, body, edit/delete).
The user asked for them to feel like the chat (decision 0031): reactions and
quote-reply — but **no threads** (replies stay flat).

## Decision

Extend the existing `Comment` entity (do **not** migrate comments onto the
messages/conversation backend):

- **Reactions** — the same fixed 6-emoji set as chat (`domain::reaction`).
  Stored as one item per (user, comment, emoji) at
  `PK=PROPOSAL#<id>` / `SK=CREACT#<userId>#<commentId>#<emoji>` (outside the
  `COMMENT#` range), with a materialised `reactionCounts` map on the comment
  item, bumped transactionally — mirrors the message reaction path. The
  viewer's own reactions ("me") come from a consistent
  `begins_with(SK, CREACT#<user>#)` query.
- **Quote-reply** — `reply_to_id` on create resolves to an immutable
  `CommentReplyTo` snapshot (id + author_display_name + preview) stored on the
  comment.

  **Revised 2026-06-04:** the FE first rendered replies flat (one level, with a
  "↳ name" marker, YouTube-style); the user found flat replies confusing, so
  replies are now rendered as a true tree — each reply nested beneath the one it
  answers, indented per level, with a per-comment collapse toggle ("Hide
  replies" / "N replies"). Orphaned replies (parent absent) fall back to roots
  and keep their quote block. Storage/API unchanged — purely a render change in
  `Comments`.

### API

- `POST …/comments` gains optional `reply_to_id`.
- New `PUT …/comments/{commentId}/reactions` `{emoji, active}` → `{reactions}`.
- `Comment` DTO gains `reply_to` + `reactions` (always present, `reactions`
  defaults `[]`).

### Frontend

`CommentItem` becomes a chat-style bubble: avatar + name + time, reply quote
header, body, reaction pills, an "add reaction" picker, and a Reply action.
`CommentForm` shows a "Replying to X" banner. Reuses the shared
`applyReactionToggle` + `REACTIONS` from the messages lib.

`CACHE_VERSION` bumped to `2` — the persisted (decision 0032) `Comment` shape
changed, so old caches are dropped rather than rendered (and `CommentItem`
defensively tolerates a missing `reactions` array).

## Notes / known limitations

- The dev MSW mock can't intercept deep comment sub-paths
  (`…/comments/:commentId/…`) under MSW 2.14 / path-to-regexp v8 (the bare-`*`
  wildcard form stops matching at that depth — this also affects the
  pre-existing edit/delete handlers). These bypass to the real dev API. Comment
  reactions are therefore verified against the **real** backend (hosted dev),
  not the local mock. Revisit the mock matcher when convenient.

## Alternatives considered

- Migrating comments onto the messages backend — rejected: heavier, and
  comments have their own lifecycle (edit/delete, moderation, proposal scope).
- Threaded replies — out of scope by explicit user decision.
