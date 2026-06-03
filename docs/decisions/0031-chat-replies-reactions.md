# 0031 — Chat: quote-reply, inline threads, reactions

**Status:** accepted (Phases 1–3 shipped)
**Date:** 2026-06-03
**Builds on:** 0027 (chat polling), 0028 (realtime), 0029/0030 (avatars, handles)

## Context

The chat surface had Slack-style threads (replies hidden in a bottom-sheet, the
channel showing "N replies") but no quote-reply, no reactions, and bare URLs
weren't clickable. We want a modern-messenger feel: reply to any message,
react, clickable links (no preview cards), an in-app image lightbox.

User decisions up front: **hybrid** reply model (quote-reply everywhere, with an
opt-in focused thread view in channels); a **fixed 6-emoji** reaction set
(👍 ❤️ 😂 🎉 🙏 👀); **long-press menu + swipe-to-reply** as the gesture; **all
members** can react; message **delete/edit** out of scope for now.

Delivered in three phases — Phase 1 (quote-reply + actions), Phase 2 (reactions),
Phase 3 (links + image lightbox).

## Decision — Phase 1 (quote-reply + message actions)

### The model consequence: replies are inline

The hybrid means a reply renders **inline in the timeline** (with a quote
header), not hidden in a thread. The thread sheet becomes a *focused filter* over
the same messages. This reverses the old "thread pulls replies out of the
channel" behaviour.

### Storage (the crux)

Previously top-level messages were `MSG#<ulid>` and replies `REPLY#<ulid>`, so
the timeline range query excluded replies. Now **every message is `MSG#<ulid>`** —
the one time-ordered range query naturally includes replies inline. A reply
carries:

- `replyToId` — the quoted message, and
- an **immutable quote snapshot** (`replyToAuthorId`, `replyToAuthor`,
  `replyToPreview`, `replyToKind`) captured at write time, so the quote header
  survives the original being edited/deleted and needs no extra read on display.

`replyCount` / `lastReplyAt` still materialise on the quoted message (bumped in
the same transaction as the reply). Resolve-by-id stays on GSI3 `MSG#<id>` for
**all** messages (you can reply to a reply). The focused-thread view
(`thread_replies`) is a **filtered query** on the conversation by `replyToId` —
opened on demand, our channels are bounded, so no extra GSI (revisit with one if
channels grow large).

**Per-thread unread markers were removed**: replies are normal channel messages
now and count toward the single channel unread.

### API

- `POST /conversations/{id}/messages` gains optional `reply_to_id`; the server
  resolves it into the snapshot (validates same-conversation) and stores it.
- The message DTO gains `reply_to` (client-safe: `{id, author_display_name,
  preview, kind}`); `parent_message_id` is gone.
- `POST /messages/{parent}/thread/read` removed.

### Notifications

A quote-reply notifies the **author of the quoted message** ("someone replied to
you") via the denormalised `replyToAuthorId` — no fetch, no thread-chain fan-out.
Reuses the existing `reply` inbox kind + push.

### Realtime

The thin signal's `parentMessageId` field became `replyToId`. The client always
refetches the main list (replies are inline) and also an open thread view.

### Frontend

- A **long-press action sheet** (Reply · Thread · Copy) + **swipe-right-to-reply**
  (a `useMessageGestures` hook: long-press ~450 ms cancelled by movement; swipe
  past ~56 px fires reply; vertical movement = scroll).
- A **quote header** on reply bubbles (author + preview, or 📷/🎙/📄 media label);
  tapping scrolls to + flashes the original.
- A **"replying to …" chip** above the composer with a cancel button.
- The thread sheet reframed as the focused filter; replying there quotes the
  parent. Optimistic replies insert inline (and mirror into an open thread).

## Decision — Phase 2 (reactions)

A fixed 6-emoji set (👍 ❤️ 😂 🎉 🙏 👀). A reaction is one item
`CONV#<conv> / REACT#<userId>#<msgId>#<emoji>` — **outside** the `MSG#` range so
it never pollutes the timeline query. The message item carries **materialised
counts** (`reactionCounts` map, present from birth so `ADD reactionCounts.<emoji>`
works), so the list query returns counts for free; the viewer's own reactions
("me") come from one small `begins_with(REACT#<user>#)` query. Toggling moves the
reaction item + the count in **one transaction** and is **idempotent** (a
conditional-failed write = already in the desired state = no-op).

- `PUT /v1/conversations/{id}/messages/{mid}/reactions` `{emoji, active}` →
  returns the message's updated tallies. Message DTO gains `reactions:
  [{emoji, count, me}]`.
- FE: the 6-emoji bar on the long-press sheet; count pills under the bubble
  (tap to toggle, accent ring when "me"); optimistic toggle (`applyReactionToggle`)
  reconciled with the server response, mirrored into open threads.
- **No push, no inbox** (deliberately calm). **No realtime**: optimistic for the
  actor + the existing chat poll for others — a reaction isn't urgent. (Realtime
  for reactions is a possible later enhancement.)

## Decision — Phase 3 (links + image lightbox)

- **Bare URLs auto-linkify** in the chat inline renderer (clickable, new tab,
  **no preview card** per the user's preference). The tokenizer moved to a pure
  `lib/messages/inline.ts`; a URL pattern stops before trailing punctuation and,
  because first-match-by-earliest-index wins, a URL inside a `[text](url)`
  markdown link is consumed by the link pattern, not double-linkified. Emails
  (no scheme) are left alone.
- **In-app image lightbox** (`Lightbox`, a global Zustand store, mounted once at
  the root): tapping a chat image opens a full-screen viewer with a counter,
  download, close, and swipe / arrow-key navigation **between that message's
  images** (cross-conversation swipe is a later enhancement). Replaces the old
  "open the raw image URL in a browser tab".

## Trade-offs / notes

- Pre-existing seeded threads (old `REPLY#` items) won't render inline after the
  refactor — acceptable on dev (re-seed if pristine data is wanted).
- The filtered thread query is O(conversation) per open; fine at our scale.
- Quote snapshot duplicates a little data per reply — the price of a robust,
  read-free header.

## Tests

- BE: `messages_it` (replies inline + `reply_count` bump + snapshot;
  `thread_replies` filter; reply resolvable by id); `notify` reply fan-out via
  snapshot; `realtime` signal carries `replyToId`.
- FE: `reply-snapshot.test` (`toReplyTo` text/media/cap); existing thread +
  optimistic tests adapted.

## References

- Backend: `repo/message.rs` (unified `MSG#`, `ReplyTo`, `thread_replies`
  filter), `handlers/conversations.rs`, `notify.rs`, `realtime.rs`, `main.rs`,
  `repo/conversation.rs` (thread-read removed); `openapi.yaml` + client.
- Frontend: `components/messages/` (`QuoteHeader`, `MessageActions`,
  `MessageRow` gestures, `MessageList`, `MessageComposer` chip, `ThreadOverlay`),
  `lib/messages.ts` + `lib/messages/types.ts` (`toReplyTo`), `lib/realtime.ts`.
