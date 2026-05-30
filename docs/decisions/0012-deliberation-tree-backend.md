# 0012 — The deliberation tree in the Rust backend (slice B)

**Status:** accepted
**Date:** 2026-05-30
**Builds on:** 0005 (voting model), 0010 (single-table design), 0011 (per-deliberation votes)

## Context

Slice A keyed votes on the deliberation root but the backend only had root
proposals — no way to create a fork/alternative, no tree read, and close handled
only the root. The mock (`apps/web/src/mocks`) has the full tree: forks are child
proposals, a deliberation is read as a flat tree, and close decides a winner
across all alternatives. This slice brings the backend to that shape.

## Decision

- **Forks are child proposals.** `POST …/proposals` with `parent_id` creates a
  fork: `parentId` = the immediate parent (multi-level nesting preserved),
  `rootId` = the root, inheriting the root's `votingRule` / `quorum` / `endsAt`.
  A fork is rejected with `409` if the deliberation is closed.
- **GSI2 is the tree.** Roots **and** forks write `GSI2PK=DELIB#<root>`,
  `GSI2SK=PROPOSAL#<createdAt>#<id>`. `GET …/proposals/:id/tree` is
  `Query GSI2(DELIB#<root>)` → flat, created-ordered; the client rebuilds
  nesting from `parent_id`.
- **Root-only state.** Only the root carries the `tallyByChoice` map, the
  GSI3 closing-soon keys, and the close schedule. Forks carry none of these —
  the whole deliberation tallies on the root and closes on the root's schedule.
- **DTO tally.** Every node's DTO carries the **deliberation (root) tally**
  (mock parity). In `/tree` the root is in the result set (free); a bare
  single-`get` of a fork loads the root for its tally.
- **Vote validation** expands from root-only to any node in the deliberation
  (a `Pick` must resolve to a proposal whose `rootId` matches), else `400`.
- **Close is tree-wide.** `decide_outcome` runs over all node ids; every still-
  `voting` node transitions in **one transaction** — winner → `passed`, other
  alternatives → `rejected`, all → `quorum_failed` when quorum fails. Bounded by
  DynamoDB's 100-item transaction limit (trees are far smaller).

## Events

- `proposal_forked` (new) — `project_id`, `proposal_id`, `root_id`, `parent_id`,
  `by_user`. No PII.
- `proposal_closed` now logs `node_count` + `has_winner` (counts only).

## Tests

- Outcome over multiple alternatives is already covered in `domain/outcome.rs`.
- Integration (`tests/tree_it.rs`, DynamoDB-Local): fork joins tree + inherits
  config; multi-level fork preserves the immediate parent; vote for a fork
  tallies under the root; plurality close passes the winner and rejects the
  rest; below-quorum marks the whole tree `quorum_failed`.
- **Not integration-covered** (handler-layer, needs auth — out of the repo-level
  harness): fork-closed → `409`, choice-outside-tree → `400`. Simple branches,
  covered by review; candidates for a future E2E pass.

## Out of scope (next slices)

- **`isQuestion` multi-option roots** (B2) — upfront `options[]` → question root
  + option children; the question root is *not* a candidate. Small delta on top
  of this slice's tree machinery.
- Documents (`proposalKind`/`documentName`, amendment guard) — slice C.
- Categories (`categoryId` on create) — slice D. Forks inherit whatever the root
  has (nothing yet).

## References

- `apps/api/src/repo/proposal.rs` (`create_fork`, `tree`, `transition_tree_to_terminal`)
- `apps/api/src/handlers/proposals.rs` (`create` fork branch, `tree`), `handlers/votes.rs`
- `apps/api/src/jobs/close_proposal.rs`
- `apps/api/tests/tree_it.rs`
- `apps/web/src/mocks/handlers/proposals.ts`, `mocks/db.ts` (`treeFlat`) — parity source.
- Decisions 0005, 0010, 0011.
