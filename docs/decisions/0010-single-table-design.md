# 0010 — Single-table DynamoDB design, reconciled to the built surface

**Status:** accepted
**Date:** 2026-05-30
**Supersedes:** the 2026-05-17 sketch in `docs/data-model.md`
**Builds on:** 0004 (documents derived), 0005 (voting model), 0009 (multi-option
decisions), the comments slice (flat comments), the messages slice (0003)

## Context

The original `data-model.md` was sketched before any feature shipped. Since then
the mock-first build (M1–M9) settled the real domain shape, and the sketch had
drifted materially from it. Before designing the backend persistence we
reconciled the single-table design against the **implemented** surface: 26
routes, 42 endpoints, and the entity shapes in `apps/web/src/mocks/db.ts`. The
mock handlers are the authoritative access-pattern catalogue.

## Decision

Keep the **single-table** model (`vozcoletiva-<env>`) with **3 GSIs**, and fit
the entire 42-endpoint surface within that budget by overloading each GSI with
disjoint, sparse key-spaces. Full schema in `docs/data-model.md`.

### The four deltas from the sketch (what the build forced)

1. **Votes are per-deliberation, not per-proposal.** A vote keys on the *root*
   proposal; `choice` is the picked alternative's proposal id (or `__none__` /
   `__abstain__`). Vote/event/tally live under `DELIB#<rootId>`, **not**
   `PROPOSAL#<id>`. The sketch's yes/no-per-proposal vote was wrong.
2. **Documents are derived, not stored.** No Document/DocVersion entities. A
   document = passed `proposalKind:'document'` proposals sharing `documentName`;
   current version = most-recently-closed. Served by a sparse GSI3 partition
   (`PROJECT#p#DOC` → `name#closedAt`) instead of dedicated `DOC#` items.
3. **Conversations are unified (channel | DM) with threads.** One `CONV#` body;
   channels get a project pointer row, DMs get a per-participant pointer row and
   a **deterministic id from the sorted pair** (find-or-create is a `GetItem`,
   no index). Messages carry `parentMessageId`; thread replies are a sparse GSI3
   partition (`THREAD#<parentMsgId>`). Two read-marker kinds (conversation +
   thread).
4. **Forks and multi-option labels are child proposals** (`parentId`/`rootId`);
   `isQuestion` marks a non-votable multi-option root. The tree is a GSI2 query
   by `rootId`.

### GSI allocation (3, overloaded, sparse)

- **GSI1** — secondary-id lookups: slug→project, user→memberships,
  invite-token→invite, invite-code→invite.
- **GSI2** — by-root / by-user: deliberation tree (`DELIB#<root>`), vote history
  (`USER#<uid>`).
- **GSI3** — time/status windows: closing-soon voting roots, document library by
  name, thread replies. All three partitions disjoint + sparse.

### Search — scan-and-filter for MVP

DynamoDB can't substring-match. `GET …/search` queries the `PROJECT#p`
partition and filters the four sections in the Lambda. Accept for small
projects; migrate to OpenSearch Serverless when scan cost bites. (Owner decision,
2026-05-30.)

## Consequences

- Backend implementation can proceed directly from `data-model.md`; every
  endpoint has a named `GetItem` / single-partition `Query` / `BatchGetItem` /
  transaction.
- Vote storms (`DELIB#<root>`) and chat bursts (`CONV#<id>`) are isolated from
  `PROJECT#<pid>`, so a hot deliberation/channel won't starve project reads.
- Three transactional write paths: vote (vote+event+tally), accept-invite
  (member+gsi+useCount), create-project (meta+owner+default topic+channel).

## Open (tracked in data-model.md § Open design questions)

Topic-delete `proposalCount` consistency; tally recompute fallback under high
QPS; inbox fan-out-on-write vs compute-on-read at scale; TTL semantics
(invites, inbox); audit `tokenId` (null until scoped API tokens / MCP).

## References

- `docs/data-model.md` — full reconciled schema + access-pattern table.
- `apps/web/src/mocks/db.ts`, `apps/web/src/mocks/handlers/*` — the surface
  this design was reconciled against.
- Decisions 0003, 0004, 0005, 0009.
