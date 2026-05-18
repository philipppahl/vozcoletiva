# Data model — DynamoDB single-table sketch

Status: initial sketch, 2026-05-17. Expected to evolve as the model is implemented; revisions land here directly until it stabilises into a frozen spec.

## Principles

- **One DynamoDB table** holds all entities. Table name: `vozcoletiva-<env>` (e.g. `vozcoletiva-dev`, `vozcoletiva-prod`).
- **Overloaded keys**: `PK` / `SK` shapes differ per entity type; key prefixes name the entity.
- **GSI budget**: 3 GSIs at MVP. Add a 4th only with a written reason.
- **Hot-partition aware**: prefer per-project partitions over global ones. Sharding suffix added only if a real hot partition shows up under load.
- **Append-only event log** (vote events, audit events) lives in the same table under namespaced SKs. The materialised current state lives alongside.
- **ULIDs** for ids — lexicographically sortable, so timestamp-prefixed SKs sort naturally.
- **No PII in keys**. Email never appears in `PK` / `SK` / GSI keys.

## Naming conventions

- Entity ids are ULIDs unless otherwise noted (`userId` = Cognito `sub`).
- Key parts uppercase, `#`-separated: `PROJECT#01HXXX...`, `USER#01HYYY...`.
- Timestamps in keys: ISO-8601 UTC, lexicographically sortable.
- GSI attribute names: `GSI1PK`, `GSI1SK`, `GSI2PK`, `GSI2SK`, …
- Every item has a `type` attribute for client-side discrimination and analytics filters.

## Entity catalog

For each entity: `PK` / `SK` / notable attrs / GSI mappings.

### User
- **PK**: `USER#<userId>` (`userId` = Cognito `sub`)
- **SK**: `PROFILE`
- attrs: `displayName`, `locale`, `theme`, `notificationDefaults`, `createdAt`
- (Email stays in Cognito only — not duplicated here.)

### Project (metadata)
- **PK**: `PROJECT#<projectId>`
- **SK**: `METADATA`
- attrs: `name`, `slug`, `visibility`, `template`, `defaults` (votingMode, runtime, quorum), `language`, `codeOfConduct`, `ownerId`, `createdAt`
- **GSI1PK**: `PROJECTSLUG#<slug>` / **GSI1SK**: `METADATA` — slug → project lookup

### Membership
- **PK**: `PROJECT#<projectId>`
- **SK**: `MEMBER#<userId>`
- attrs: `role` (owner / admin / moderator / member / observer), `joinedAt`, `nickname` (optional), `invitedBy`
- **GSI1PK**: `USER#<userId>` / **GSI1SK**: `MEMBER#<projectId>` — list a user's projects

### Topic
- **PK**: `PROJECT#<projectId>`
- **SK**: `TOPIC#<topicId>`
- attrs: `name`, `slug`, `position`, `createdAt`

### Channel
- **PK**: `PROJECT#<projectId>`
- **SK**: `CHANNEL#<channelId>`
- attrs: `name`, `isDefault`, `createdAt`

### Proposal (head / current state)
- **PK**: `PROJECT#<projectId>`
- **SK**: `PROPOSAL#<proposalId>`
- attrs: `type` (decision / document / election / poll / petition), `title`, `body` (current version), `status` (draft / discussion / voting / passed / rejected / quorum_failed / withdrawn), `votingMode`, `endsAt`, `quorum`, `authorId`, `topicId`, `forkOf`, `forkMode`, `currentVersion`, `tallyYes`, `tallyNo`, `tallyAbstain`, `voterCount`, `createdAt`
- **GSI1PK**: `PROJECT#<projectId>#STATUS#<status>` / **GSI1SK**: `<endsAt>` — closing-soon + scheduler queries

### Proposal version (edit history)
- **PK**: `PROPOSAL#<proposalId>`
- **SK**: `VERSION#<n>` (zero-padded monotonic int)
- attrs: `title`, `body`, `editedBy`, `editedAt`, `isSubstantive`

### Vote (current materialised state)
- **PK**: `PROPOSAL#<proposalId>`
- **SK**: `VOTE#<userId>`
- attrs: `choice` (yes / no / abstain / rank), `votedAt`, `basedOnVersion`
- **GSI2PK**: `USER#<userId>` / **GSI2SK**: `VOTE#<projectId>#<proposalId>` — user's vote history

### Vote event (append-only audit)
- **PK**: `PROPOSAL#<proposalId>`
- **SK**: `VOTEEVENT#<isoTs>#<userId>`
- attrs: `choice` (or `null` for retraction), `previousChoice`, `source` (web / api), `tokenId` (if via API token)

### Comment
- **PK**: `PROPOSAL#<proposalId>`
- **SK**: `COMMENT#<isoTs>#<commentId>`
- attrs: `authorId`, `parentCommentId` (nullable, for threading), `body`, `editedAt`, `deletedAt`
- Thread tree reconstructed in the app from `parentCommentId`; SK sorts chronologically for reading.

### Message (chat)
- **PK**: `CHANNEL#<channelId>`
- **SK**: `MESSAGE#<isoTs>#<messageId>`
- attrs: `authorId`, `body`, `attachments` (S3 keys for image / voice note), `replyToMessageId`, `editedAt`, `deletedAt`

### Last-read marker (chat read state)
- **PK**: `USER#<userId>`
- **SK**: `LASTREAD#<channelId>`
- attrs: `lastReadAt`

### Reaction
- **PK**: `<targetPK>` (`PROPOSAL#...` for comment reactions, `CHANNEL#...` for message reactions)
- **SK**: `REACTION#<targetId>#<emoji>#<userId>`
- attrs: `createdAt`
- (Per-emoji counters can be denormalised onto the target if reaction reads become hot.)

### Invite
- **PK**: `PROJECT#<projectId>`
- **SK**: `INVITE#<token>`
- attrs: `code` (short typeable), `role`, `expiresAt`, `maxUses`, `useCount`, `note`, `issuedBy`, `issuedAt`, `revokedAt`
- **GSI1PK**: `INVITETOKEN#<token>` / **GSI1SK**: `INVITE` — URL token → invite
- **GSI2PK**: `INVITECODE#<code>` / **GSI2SK**: `INVITE` — short code → invite

### Document (canonical artefact)
- **PK**: `PROJECT#<projectId>`
- **SK**: `DOC#<documentId>`
- attrs: `title`, `currentVersion`, `originProposalId`, `createdAt`
- **GSI1PK**: `DOCSLUG#<projectId>#<slug>` / **GSI1SK**: `DOC` — slug → document

### Document version
- **PK**: `DOC#<documentId>`
- **SK**: `DOCVER#<n>`
- attrs: `body`, `summary`, `basedOnVersion`, `acceptedFromProposalId`, `acceptedAt`

### Notification preference
- **PK**: `USER#<userId>`
- **SK**: `NOTIFPREF#<projectId>#<eventType>`
- attrs: `channels` (push / email), `muted`, `quietHours`

### Push subscription
- **PK**: `USER#<userId>`
- **SK**: `PUSHSUB#<endpointHash>`
- attrs: `endpoint`, `p256dh`, `auth`, `userAgent`, `createdAt`

### Audit event
- **PK**: `PROJECT#<projectId>`
- **SK**: `AUDIT#<isoTs>#<eventId>`
- attrs: `actorId`, `tokenId` (if via API), `action`, `targetType`, `targetId`, `before`, `after`

### Inbox item (denormalised "this needs you")
- **PK**: `USER#<userId>`
- **SK**: `INBOX#<isoTs>#<itemId>`
- attrs: `kind` (vote-closing / mention / reply / result), `projectId`, `ref` (e.g. `proposalId`), `readAt`
- Written by the same write path that creates the source event (mention, vote-open, …) — **fan-out on write**.

## GSI summary

| GSI | Purpose | Examples |
|---|---|---|
| **GSI1** | Mixed reverse-lookup | Project slug → project; user → projects; proposals by status + endsAt; invite token → invite; document slug → document |
| **GSI2** | User-centric history + secondary lookups | User → votes; invite short code → invite |
| **GSI3** *(reserved, post-MVP)* | TBD | Public-project discovery; full-text doc index pointers; etc. |

## Access patterns covered (MVP)

| # | Pattern | Approach |
|---|---|---|
| 1 | Get user profile | `GetItem(USER#u, PROFILE)` |
| 2 | List user's projects (for switcher) | `Query GSI1 (USER#u, MEMBER#)` |
| 3 | Get project by id | `GetItem(PROJECT#p, METADATA)` |
| 4 | Get project by slug | `Query GSI1 (PROJECTSLUG#s)` |
| 5 | List members of project | `Query (PROJECT#p, MEMBER#)` |
| 6 | Get user's role in project (auth) | `GetItem(PROJECT#p, MEMBER#u)` |
| 7 | List topics in project | `Query (PROJECT#p, TOPIC#)` |
| 8 | List channels in project | `Query (PROJECT#p, CHANNEL#)` |
| 9 | List proposals in project | `Query (PROJECT#p, PROPOSAL#)` |
| 10 | List proposals closing soon | `Query GSI1 (PROJECT#p#STATUS#voting, SK ≤ now+window)` |
| 11 | Get proposal head | `GetItem(PROJECT#p, PROPOSAL#prop)` |
| 12 | List proposal versions | `Query (PROPOSAL#prop, VERSION#)` |
| 13 | Get user's vote on proposal | `GetItem(PROPOSAL#prop, VOTE#u)` |
| 14 | List all votes on proposal | `Query (PROPOSAL#prop, VOTE#)` |
| 15 | List user's votes (history) | `Query GSI2 (USER#u, VOTE#)` |
| 16 | Cast / change vote | Transaction: append `VOTEEVENT`, upsert `VOTE`, update tally on proposal head |
| 17 | List vote events on proposal | `Query (PROPOSAL#prop, VOTEEVENT#)` |
| 18 | List comments on proposal | `Query (PROPOSAL#prop, COMMENT#)` |
| 19 | List recent messages in channel | `Query (CHANNEL#c, MESSAGE#, scan-forward=false, limit=N)` |
| 20 | Last-read marker for channel | `GetItem(USER#u, LASTREAD#c)` |
| 21 | List project's invites | `Query (PROJECT#p, INVITE#)` |
| 22 | Resolve invite token → invite | `Query GSI1 (INVITETOKEN#t)` |
| 23 | Resolve short code → invite | `Query GSI2 (INVITECODE#c)` |
| 24 | List documents in project | `Query (PROJECT#p, DOC#)` |
| 25 | Get document head | `GetItem(PROJECT#p, DOC#d)` |
| 26 | List document versions | `Query (DOC#d, DOCVER#)` |
| 27 | List notification prefs for user | `Query (USER#u, NOTIFPREF#)` |
| 28 | List push subscriptions for user | `Query (USER#u, PUSHSUB#)` |
| 29 | Append audit event | `PutItem (PROJECT#p, AUDIT#ts#id)` |
| 30 | List project audit events | `Query (PROJECT#p, AUDIT#)` (paginated) |
| 31 | List user's inbox (home screen) | `Query (USER#u, INBOX#, scan-forward=false, limit=N)` |

## Open design questions

- **Reactions counters.** Per-(target × emoji × user) items as sketched (full audit), or denormalised counters on the target with separate "who reacted" items? Decide when reactions are implemented.
- **Comment threading.** Tree reconstruction in app code (current) vs. materialised path keys (`PATH#root.id1.id2`) for very deep threads. Defer until comment loads become a hotspot.
- **Inbox writes.** Fan-out on write (push an `INBOX` item per interested user when a proposal enters voting) vs. compute on read. Sketch leans on fan-out-on-write. Reconsider for very large projects.
- **Hot-partition risk on `PROJECT#p`** for high-traffic projects (vote storms, chat bursts). Possible sharding suffix (`PROJECT#p#shard<n>`) for `MESSAGE` and `VOTE` under that project. Defer until measured.
- **TTL.** DynamoDB TTL on invites with `expiresAt`, on `INBOX` items past a retention window, on ephemeral chat? Pick TTL semantics per entity.
- **Vote-tally consistency.** Atomic transaction updating tally + vote + event together (sketch) vs. eventually-consistent recompute. Transaction at write time scales fine until very large per-proposal QPS; revisit then.
- **Document full-text search.** DynamoDB does not search. Post-MVP, mirror `DocumentVersion` bodies to OpenSearch Serverless or use `CONTAINS` filter expressions for small libraries. Decide before launching search.
- **Identity for the audit `tokenId`.** Pre-MVP all writes are session-authed (no tokens); the attribute exists but is null. Tokens come post-MVP with scoped API tokens.

## Out of MVP

- **ApiToken**, **Webhook**, **Collection**, **Delegation** entities — defer schema until those features are scheduled. Each is additive (new key prefix) under the same single-table model; no migration of existing items required.

---

*Sketch authored 2026-05-17. Update directly as patterns evolve; large changes deserve their own entry in `docs/decisions/` once that directory exists.*
