# Data model — DynamoDB single-table design

Status: reconciled against the implemented mock surface, 2026-05-30. Supersedes
the 2026-05-17 sketch. Revisions land here directly until the model freezes into
a versioned spec. Architectural deltas are captured in
`docs/decisions/0010-single-table-design.md`.

> This revision was reconciled against the **actual mock API** (`apps/web/src/mocks`):
> 26 routes, 42 endpoints, and the entity shapes in `mocks/db.ts`. The mock
> handlers are the authoritative access-pattern catalogue — every endpoint here
> maps to a real query below.

## Principles

- **One DynamoDB table** holds all entities. Table name: `vozcoletiva-<env>`
  (e.g. `vozcoletiva-dev`, `vozcoletiva-prod`).
- **Overloaded keys**: `PK` / `SK` shapes differ per entity; key prefixes name
  the entity. A `type` attribute on every item aids client discrimination and
  analytics filters.
- **GSI budget: 3 GSIs at MVP.** A 4th needs a written reason. The current
  design fits the whole surface in 3 by overloading each GSI with disjoint,
  sparse key-spaces (see § GSIs).
- **ULIDs for ids** — lexicographically time-sortable. Because the id sorts by
  time, the SK is just `PREFIX#<ulid>` (no separate timestamp segment), and
  "mark item X read" is a point `UpdateItem` since the id *is* the SK suffix.
- **Hot-partition aware**: per-project partitions over global ones. Vote storms
  land on `DELIB#<root>` and chat bursts on `CONV#<id>` — both isolated from
  `PROJECT#<pid>`, so neither starves project reads. Shard suffix only if a hot
  partition is measured.
- **Event-sourced where it matters**: vote events and audit events are
  append-only under namespaced SKs; current state (vote, tally, proposal head)
  is materialised alongside.
- **No PII in keys.** Email never appears in `PK` / `SK` / GSI keys; it lives in
  Cognito only.

## Naming conventions

- Entity ids are ULIDs unless noted; `userId` = Cognito `sub`.
- Key parts uppercase, `#`-separated: `PROJECT#01HXXX…`, `USER#01HYYY…`.
- GSI attribute names: `GSI1PK`, `GSI1SK`, `GSI2PK`, `GSI2SK`, `GSI3PK`, `GSI3SK`.
- Every item carries `type` (e.g. `proposal`, `vote`, `message`).

## Domain shape (what the keys must serve)

Reconciled from `mocks/db.ts`. Four facts drive the whole design:

1. **Votes are per-deliberation, not per-proposal.** A vote belongs to a *root*
   proposal (`rootId`); `choice` is the picked alternative's **proposal id**, or
   `__none__` / `__abstain__`. The tally is over the root's child proposals.
2. **Documents are derived, not stored.** A "document" is the set of *passed*
   `proposalKind:'document'` proposals sharing a `documentName`; the current
   version is the most-recently-closed one. There is no Document entity.
3. **Conversations are unified** — a `Conversation` is either a project
   **channel** or a user-pair **DM**. Messages carry `parentMessageId` (threads).
   Two read-marker kinds exist: per-conversation and per-thread.
4. **Forks and multi-option labels are child proposals** linked by
   `parentId` / `rootId`. `isQuestion` marks a non-votable multi-option root.

## Entity catalog

For each entity: `PK` / `SK` / notable attrs / GSI mappings.

### User profile
- **PK** `USER#<userId>` · **SK** `PROFILE`
- attrs: `displayName`, `locale`, `theme`, `notificationDefaults`, `createdAt`
- Email stays in Cognito — never duplicated here.

### Push subscription / notification preference
- **PK** `USER#<userId>` · **SK** `PUSHSUB#<endpointHash>` — `endpoint`, `p256dh`, `auth`, `userAgent`
- **PK** `USER#<userId>` · **SK** `NOTIFPREF#<projectId>#<eventType>` — `channels`, `muted`, `quietHours`

### Inbox item (denormalised "this needs you")
- **PK** `USER#<userId>` · **SK** `INBOX#<ulid>`
- attrs: `kind` (`mention` / `reply` / `comment-on-yours` / `proposal-closed` /
  `document-amended`), `projectId`, `actorId` (`system` for closes),
  `proposalId?` / `commentId?` / `conversationId?` / `messageId?` /
  `documentName?` (kind-dependent), `preview` (≤120 chars), `readAt?`
- **Fan-out on write**: the write path that creates the source event pushes one
  `INBOX#` item per interested recipient.

### Conversation-read / thread-read markers
- **PK** `USER#<userId>` · **SK** `CONVREAD#<conversationId>` — `lastReadMessageId`, `at`
- **PK** `USER#<userId>` · **SK** `THREADREAD#<parentMessageId>` — `lastReadMessageId`, `at`

### DM pointer (one per participant)
- **PK** `USER#<userId>` · **SK** `DM#<conversationId>`
- Lets a user list their DMs with a single `Query`. The conversation body lives
  under `CONV#<conversationId>`.

### Project (metadata)
- **PK** `PROJECT#<projectId>` · **SK** `META`
- attrs: `name`, `slug`, `ownerId`, `template`, `visibility` (`private`/`public`),
  `defaults` (votingRule, runtime, quorum), `language`, `createdAt`
- **GSI1PK** `SLUG#<slug>` · **GSI1SK** `PROJECT` — slug → project

### Membership
- **PK** `PROJECT#<projectId>` · **SK** `MEMBER#<userId>`
- attrs: `role` (owner / admin / moderator / member / observer), `joinedAt`, `invitedBy`
- **GSI1PK** `USER#<userId>` · **GSI1SK** `MEMBER#<projectId>` — list a user's projects

### Topic (category — `category_id` in the entity, "topic" in the UI)
- **PK** `PROJECT#<projectId>` · **SK** `TOPIC#<topicId>`
- attrs: `name`, `position` (creation order), `createdAt`
- A default "Commons" topic is created in the `project::create` transaction.
- **Delete guard**: a topic can't be deleted while a proposal references it
  (`Query(PROJECT#p, PROPOSAL#)` filtered by `categoryId`, `Select=COUNT`) or if
  it's the project's last topic. Scan-and-filter on a rare admin delete — see
  Open questions (chose scan over a denormalised counter, 2026-05-30).

### Invite
- **PK** `PROJECT#<projectId>` · **SK** `INVITE#<inviteId>`
- attrs: `code` (short typeable), `token` (URL), `role`, `expiresAt?`,
  `maxUses?`, `useCount`, `revokedAt?`, `note?`, `issuedBy`, `issuedAt`
- **GSI1PK** `INVITETOKEN#<token>` · **GSI1SK** `INVITE` — URL token → invite
- **GSI1PK** `INVITECODE#<code>` · **GSI1SK** `INVITE` — short code → invite
- (Both projected onto GSI1 via duplicated attrs on the single item, or via
  two thin pointer items — pick at implementation; pointer items keep the GSI
  partitions clean.)

### Proposal (deliberation node — root, fork, or option)
- **PK** `PROJECT#<projectId>` · **SK** `PROPOSAL#<proposalId>`
- attrs: `authorId`, `title`, `body`, `proposalKind` (`decision` / `document`),
  `status` (`voting` / `passed` / `rejected` / `quorum_failed` / `withdrawn` …),
  `categoryId`, `createdAt`, `closedAt?`,
  `parentId?` (null on root), `rootId` (= `id` on root),
  `votingRule` / `quorum` / `endsAt` (set on root, inherited by forks),
  `documentName?` (Document kind only), `isQuestion?` (sparse BOOL — root of a
  multi-option decision; frames the question, not itself a choice). The options
  are ordinary child proposals (`parentId` = the question root). At close, a
  question root is **excluded from the candidate set** (`valid_ids`) and its
  status derives from the outcome: `passed` if any option won, else
  `rejected`/`quorum_failed`.
- **Tally on the root head** (set on roots): `tallyByChoice` (map proposalId →
  count, initialised `{}`), `tallyNone`, `tallyAbstain`. One write item then
  doubles as the vote guard (`status = voting AND endsAt > now`) + the tally
  adjustment — see Vote.
- **Root-only vs fork.** Only the root carries the tally map, the GSI3
  closing-soon keys, and the close schedule. A fork carries `parentId` (its
  immediate parent), `rootId`, inherited `votingRule`/`quorum`/`endsAt`, its own
  `status`, and GSI2 — but no tally/GSI3/schedule. The whole deliberation tallies
  on the root and closes on the root's schedule; **close transitions every
  still-`voting` node in one transaction** (winner → `passed`, others →
  `rejected`, all → `quorum_failed`).
- **GSI2PK** `DELIB#<rootId>` · **GSI2SK** `PROPOSAL#<createdAt>#<id>` —
  the deliberation tree (root + forks + options), sibling-ordered
- **GSI3PK** `PROJECT#<projectId>#VOTING` · **GSI3SK** `<endsAt>` —
  *sparse, roots in `voting` only* — closing-soon reminders + dashboard ordering
- **GSI3PK** `PROJECT#<projectId>#DOC` · **GSI3SK** `<documentName>#<closedAt>` —
  *sparse, passed Document proposals only* — derived document library, grouped by name.
  **Set at close** (the same transaction that marks the node `passed`), replacing
  the VOTING keys it carried as a root; a rejected node just removes them. The
  active-amendment lookup is a filtered query of the project's proposals
  (`proposalKind=document AND status=voting AND no parentId`).

### Vote (materialised, per deliberation)
- **PK** `DELIB#<rootId>` · **SK** `VOTE#<userId>`
- attrs: `choice` (alternative's proposalId / `__none__` / `__abstain__`), `votedAt`
- **GSI2PK** `USER#<userId>` · **GSI2SK** `VOTE#<rootId>` — a user's vote history
  (`rootId` is a ULID, so this sorts by deliberation age and is stable across
  vote changes).
- The tally is **not a separate item** — it's `tallyByChoice` / `tallyNone` /
  `tallyAbstain` on the root proposal head (above). The cast/retract transaction
  is three items: `Update`(root head: guard + `ADD tallyByChoice.<choice>`),
  `Put`/`Delete`(this vote), `Put`(vote event). `decisive` / `total` are derived
  at read time.

### Vote event (append-only audit)
- **PK** `DELIB#<rootId>` · **SK** `VOTEEVENT#<ulid>`
- attrs: `userId`, `newChoice` (or `null` for retraction), `previousChoice`
  (or `null`), `ts`. The audit store legitimately holds choice-tied-to-user;
  operational logs never do (PII).

### Comment (flat, soft-deletable)
- **PK** `PROPOSAL#<proposalId>` · **SK** `COMMENT#<ulid>`
- attrs: `authorId`, `body` (null when soft-deleted), `createdAt`, `editedAt?`,
  `deletedAt?`, `deletedBy?`
- SK sorts chronologically; comments are flat (no threading) per the comments slice.

### Conversation (channel | DM)
- **PK** `CONV#<conversationId>` · **SK** `META`
- channel attrs: `kind:'channel'`, `projectId`, `name`, `description?`, `createdAt`
- dm attrs: `kind:'dm'`, `participantIds:[lo,hi]` (sorted), `createdAt`
- **Channel pointer** for project listing: **PK** `PROJECT#<projectId>` ·
  **SK** `CONV#<conversationId>` — denormalised `name`, `description?` (so
  listing a project's channels is one query, no per-channel `GetItem`).
- A default **"Commons" channel** (meta + pointer) is created in the
  `project::create` transaction, matching the default topic name.
- **DM id is deterministic** from the sorted participant pair, so find-or-create
  is a `GetItem` — no lookup index needed (DMs are a later slice).

### Message (channel message or thread reply)
- **PK** `CONV#<conversationId>` · **SK** `MSG#<ulid>` (top-level) or
  `REPLY#<ulid>` (a thread reply) — the split keeps "list top-level messages" a
  clean range query (`BETWEEN MSG# AND MSG$`) with no filter, and pagination via
  a `before` cursor.
- attrs: `authorId`, `authorDisplayName` (denormalised from the poster's
  membership), `body`, `parentMessageId?` (replies), `createdAt`, `editedAt?`;
  top-level carries `replyCount` + `lastReplyAt?` (bumped transactionally when a
  reply is posted).
- **Reply → GSI3PK** `THREAD#<parentMessageId>` · **GSI3SK** `<ulid>` —
  *sparse, replies only* — a thread's replies without scanning the conversation.
- **Top-level → GSI3PK** `MSG#<id>` · **GSI3SK** `<conversationId>` —
  *sparse, top-level only* — resolves a message id to its conversation for the
  `…/messages/{id}/thread` and `…/thread/read` endpoints (which carry only the id).
- Read markers + unread: see Conversation-read / thread-read markers above;
  unread = `Select=COUNT` over `MSG#` newer than the marker. Attachments and
  WebSocket live-push are later slices.

### Audit event
- **PK** `PROJECT#<projectId>` · **SK** `AUDIT#<ulid>`
- attrs: `actorId`, `tokenId?`, `action`, `targetType`, `targetId`, `before`, `after`

## GSIs

Three, each overloaded with **disjoint, sparse** key-spaces:

| GSI | PK / SK shapes | Serves |
|---|---|---|
| **GSI1** — secondary-id lookups | `SLUG#<slug>`/`PROJECT` · `USER#<uid>`/`MEMBER#<pid>` · `INVITETOKEN#<t>`/`INVITE` · `INVITECODE#<c>`/`INVITE` | slug→project; my projects (switcher); invite token→invite; short code→invite |
| **GSI2** — by root / by user | `DELIB#<rootId>`/`PROPOSAL#<created>#<id>` · `USER#<uid>`/`VOTE#<rootId>` | deliberation tree; a user's vote history |
| **GSI3** — time/status windows + lookups | `PROJECT#<pid>#VOTING`/`<endsAt>` · `PROJECT#<pid>#DOC`/`<name>#<closedAt>` · `THREAD#<parentMsgId>`/`<ulid>` · `MSG#<id>`/`<convId>` | closing-soon roots; document library by name; thread replies; top-level message → conversation |

## Access patterns covered (all 42 endpoints)

| Endpoint | Approach |
|---|---|
| `GET /me` | `GetItem(USER#u, PROFILE)` |
| `GET /me/inbox` | `Query(USER#u, INBOX#)` desc, limit N |
| `POST /me/inbox/:id/read` | `UpdateItem(USER#u, INBOX#<id>)` set `readAt` |
| `POST /me/inbox/read-all` | `Query(USER#u, INBOX#)` unread → batch `UpdateItem` |
| `GET /projects` | `Query GSI1(USER#u, MEMBER#)` → `BatchGetItem(PROJECT#p, META)` |
| `POST /projects` | Tx: `META` + owner `MEMBER#` + default `TOPIC#` + default `CONV#` |
| `GET /projects/:slug` | `Query GSI1(SLUG#s)` |
| `GET /projects/:slug/members` | `Query(PROJECT#p, MEMBER#)` |
| `GET /projects/:slug/categories` | `Query(PROJECT#p, TOPIC#)` |
| `POST/PATCH/DELETE …/categories[/:id]` | CRUD `PROJECT#p / TOPIC#id` (delete gated by a `Select=COUNT` query of referencing proposals + last-topic check) |
| `GET /projects/:slug/channels` | `Query(PROJECT#p, CONV#)` |
| `GET /projects/:slug/invites` | `Query(PROJECT#p, INVITE#)` |
| `POST /projects/:slug/invites` | put `INVITE#` + GSI1 token + GSI1 code |
| `DELETE …/invites/:inviteId` | `UpdateItem(PROJECT#p, INVITE#id)` set `revokedAt` |
| `GET /projects/:slug/proposals` | `Query(PROJECT#p, PROPOSAL#)` → group into deliberations in app |
| `GET …/proposals/:id` | `GetItem(PROJECT#p, PROPOSAL#id)` |
| `GET …/proposals/:id/tree` | resolve `rootId` → `Query GSI2(DELIB#root)` |
| `POST …/proposals` | put root (+ option children if `options[]`) |
| `POST …/proposals/:id/withdraw` | `UpdateItem` status → `withdrawn` |
| `GET …/proposals/:id/comments` | `Query(PROPOSAL#id, COMMENT#)` |
| `POST …/proposals/:id/comments` | `PutItem(PROPOSAL#id, COMMENT#<ulid>)` |
| `DELETE …/comments/:commentId` | `UpdateItem` soft-delete (`body=null`, `deletedAt`) |
| `POST …/proposals/:id/vote` | Tx: `Update`(root head: guard + `ADD tallyByChoice.<choice>`), upsert `DELIB#root/VOTE#u`, append `VOTEEVENT` |
| `DELETE …/proposals/:id/vote` | Tx: `Update`(root head: guard + `ADD … -1`), delete `VOTE#u`, append retraction `VOTEEVENT` |
| `GET /projects/:slug/documents` | `Query GSI3(PROJECT#p#DOC)` → group by `documentName` |
| `GET …/documents/by-name/:name` | `Query GSI3(PROJECT#p#DOC, begins_with name#)` |
| `GET /projects/:slug/search` | `Query(PROJECT#p)` + in-Lambda substring filter (MVP — see Open questions) |
| `GET /conversations/:id` | `GetItem(CONV#id, META)` |
| `GET /conversations/:id/messages` | `Query(CONV#id, MSG#)` desc + `before`, filter top-level |
| `POST /conversations/:id/messages` | put `CONV#id / MSG#<ulid>` (+ GSI3 `THREAD#` row if reply) |
| `POST /conversations/:id/read` | upsert `USER#u / CONVREAD#id` |
| `GET /messages/:id/thread` | `Query GSI3(THREAD#parentId)` |
| `POST /messages/:parentId/thread/read` | upsert `USER#u / THREADREAD#parentId` |
| `GET /dms` | `Query(USER#u, DM#)` → `BatchGetItem(CONV#id, META)` |
| `POST /dms` | derive deterministic id from sorted pair → `GetItem` or create (+ `DM#` pointer per participant) |
| `GET /invites/:token` | `Query GSI1(INVITETOKEN#t)` |
| `GET /invites/by-code/:code` | `Query GSI1(INVITECODE#c)` |
| `POST /invites/:token/accept` · `…/by-code/:code/accept` | resolve → Tx: put `MEMBER#` + GSI1 user-membership + bump `useCount` |
| `GET /hello` | health — no table read |

## Open design questions

- **Search (decided for MVP: scan-and-filter).** DynamoDB cannot substring-match.
  MVP serves `GET …/search` by querying the `PROJECT#p` partition and filtering
  the four sections (proposals / documents / members / channels) in the Lambda.
  Acceptable for small projects; **migrate to OpenSearch Serverless** (mirror
  proposal/document bodies) when project size makes the scan hurt. Threshold TBD
  under load.
- **Topic delete guard (decided 2026-05-30: scan).** "Can't delete a topic with
  proposals" is enforced by a `Select=COUNT` query of the project's proposals
  filtered on `categoryId`, not a denormalised counter — delete is a rare admin
  action and scan-and-filter exactly matches the mock. Revisit with a counter
  only if delete-time scans become a measured hotspot.
- **Tally consistency.** The `tallyByChoice` map on the root head is updated transactionally with each vote. Fine
  until very high per-deliberation QPS; fall back to recompute-from-`VOTEEVENT`
  if a vote storm is measured.
- **Inbox writes.** Fan-out-on-write (one `INBOX#` per recipient). Reconsider
  compute-on-read for very large projects where a single event fans out to
  thousands.
- **Hot partitions.** `CONV#<id>` (busy channel) and `DELIB#<root>` (vote storm).
  Both isolated from `PROJECT#<pid>`. Shard suffix (`…#shard<n>`) only if measured.
- **TTL.** DynamoDB TTL candidates: invites past `expiresAt`, `INBOX#` items past
  a retention window. Pick per-entity TTL semantics before launch.
- **Audit `tokenId`.** Pre-MVP all writes are session-authed; the attribute
  exists but is null. Scoped API tokens (and the MCP server) populate it post-MVP.

## Out of MVP

- **ApiToken**, **Webhook**, **Reaction**, **Delegation**, **Collection** — each
  is additive (new key prefix) under the same single table; no migration of
  existing items required when scheduled.
- **Reactions**, when added: `PK` = target (`PROPOSAL#…` / `CONV#…`), `SK` =
  `REACTION#<targetId>#<emoji>#<userId>`, with optional denormalised counters on
  the target if reaction reads get hot.

---

*Reconciled 2026-05-30 against the implemented mock surface. Update directly as
patterns evolve; architectural shifts get a `docs/decisions/` entry.*
