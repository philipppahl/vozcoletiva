# 0006 — Inbox: per-user attention log over the existing event stream

**Status:** accepted
**Date:** 2026-05-21
**Slice:** M5 of the mock-first design integration

## Context

vozcoletiva is calm-by-design — minimal notifications, no streaks, no nudges
to keep people pulling. But a member who's been away for a week still needs to
know what they missed: were they mentioned, did anyone reply to their thread,
did a deliberation they voted in close, did a document they care about
change?

The Inbox is the pull surface for that. Not a push channel; that's a
separate slice (web push) layered on top.

## Decision

The Inbox is a small, append-only log per user. Items are emitted at write
time from the mutation that caused them; the inbox query is then just a
reverse-chronological scan of one partition.

### Kinds in scope

| Kind | Emitted when | Recipients |
|---|---|---|
| `mention` | A chat message or proposal comment body contains an `@u-id` | The mentioned users (minus self) |
| `reply` | A reply lands in a chat thread | Every previous participant in the thread (capped at 12 most-recent, minus self) |
| `comment-on-yours` | Anyone comments on a proposal you authored | The proposal's author (only when ≠ commenter) |
| `proposal-closed` | A deliberation transitions to passed / rejected / quorum_failed | Every *decisive* voter (abstainers skipped) |
| `document-amended` | The deliberation that closed had `proposal_kind='document'` and produced a winner | Same recipients as `proposal-closed` (in addition to that item) |

### Why this set

- **Mentions + replies** are the highest-signal "you specifically should look"
  notifications. Both are cheap to compute from the body.
- **Comment-on-yours** is the lightest version of "people are engaging with
  your proposal." Could extend to "any new comment on a proposal you've
  commented on" later; out of scope for v1.
- **Proposal-closed** to *decisive* voters only — abstainers signaled
  ambivalence; we don't reward them with a follow-up.
- **Document-amended** is the asymmetric case: the underlying event is a
  proposal closing, but the *thing that changed* is a document, and the
  inbox is the right place to surface that. We emit a second item alongside
  the proposal-closed one so the user can tap straight to the document.

### Out of scope

- "Closing soon" reminders — different semantics (derived from current
  state, not an event). Tracked as M5-closing-soon.
- New-message-in-channel / new-DM items — Messages tab already has unread
  badges; mirroring them in Inbox is noise.
- Invite-accepted items.
- Bulk actions beyond "Mark all read".
- Per-kind filters / mute / digest / preferences.
- Push notifications (separate slice).
- Watch semantics (a document-amended item is sent to "users who voted in
  this document's most recent passed deliberation", not "anyone who can
  read it"; reading is implicit subscription only via past participation).

### Storage model

Mock-only this slice. Items live in `db.inboxItems: MockInboxItem[]` with
shape (see `apps/web/src/mocks/db.ts`):

```ts
interface MockInboxItem {
  id: string;
  userId: string;          // recipient
  kind: InboxKind;
  projectId: string;
  actorId: string;         // 'system' for proposal-closed
  proposalId?: string | null;
  commentId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  documentName?: string | null;
  preview: string;         // ≤120 chars, computed at emit time
  createdAt: string;
  readAt?: string | null;
}
```

No dedup in v1. Two mentions of the same user in the same message produce
one item (the parser de-dups within one body); two consecutive messages each
mentioning the same user produce two items. If this turns out noisy in
practice, easy to add a "coalesce same-(recipient, kind, source) within N
minutes" rule.

### API

Mock-only this slice. Documented contract:

- `GET /v1/me/inbox?before=<ISO>&limit=<n>` →
  `{ items: InboxItem[], unread_count: number }`. Items newest-first.
- `POST /v1/me/inbox/{id}/read` → 204.
- `POST /v1/me/inbox/read-all` → 204.

### Entry points

- Home page header (top-right): `<BellButton>` next to the avatar.
- ProjectHeader (top-right): same `<BellButton>` after the project label.
- Both link to `/inbox`. Unread count shown as a small accent badge on the
  bell.

### Auto-emit hooks

| Mutation | Helper |
|---|---|
| `POST /conversations/{id}/messages` | `emitMessageMentions`, `emitThreadReply` (when `parent_message_id` set) |
| `POST /projects/{slug}/proposals/{id}/comments` | `emitProposalComment` |
| `autoCloseDuePoll` close transition | `emitDeliberationClosed` |

Self-mentions / self-replies / self-comments are filtered inside the helpers.
The parser used to extract `@u-id` mentions is the same one the chat
renderer uses, imported from `apps/web/src/components/messages/mentions.ts`,
to avoid drift between render-time and emit-time.

## Storage sketch (BE wire-up, NOT this slice)

- `PK = "USER#{userId}"`, `SK = "INBOX#{createdAtIso}#{itemId}"`.
- Reverse-chronological list = `Query` with `ScanIndexForward: false`.
- TTL on `readAt + 90 days` for housekeeping; the system of record stays the
  source events.
- "Unread count" derived per-request from the count of items without a
  `readAt`. If it gets expensive, materialise a sparse `INBOX_UNREAD#{itemId}`
  shadow item per user that gets deleted on read.

## References

- `apps/web/src/mocks/db.ts` § "inbox helpers" — storage helpers.
- `apps/web/src/mocks/inboxEmit.ts` — emit helpers.
- `apps/web/src/mocks/handlers/inbox.ts` — list / read / read-all endpoints.
- `apps/web/src/routes/inbox.tsx` — page.
- `apps/web/src/components/inbox/*` — UI.
- `apps/web/src/components/shell/BellButton.tsx` — entry point.
- `apps/web/tests/inbox-emit.test.ts` — unit tests.
- Decisions 0004 (documents) + 0005 (voting model) — both inform the
  recipient rules for `document-amended` + `proposal-closed`.
