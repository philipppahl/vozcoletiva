# 0015 — Multi-option (isQuestion) decisions in the Rust backend (slice B2)

**Status:** accepted
**Date:** 2026-05-30
**Builds on:** 0005 (voting model), 0009 (multi-option decisions — mock), 0011/0012 (votes + tree)

## Context

Decision 0009 established multi-option decisions in the mock: a Decision created
with 2+ option labels becomes a non-votable **question root** plus one
lightweight child per option, riding the existing deliberation tree + tally.
The backend (slices A/B) had the tree and close but no `isQuestion`. This slice
adds the backend realization.

## Decision

- **Proposals carry** a sparse `isQuestion` BOOL (true only on a multi-option
  root). Forks/options are always `is_question = false`.
- **Create**: `POST …/proposals` accepts `options: string[]`. For a brand-new
  Decision root: **2+** non-blank labels → `is_question = true` + one child per
  label (`title = label`, empty body, `parent_id`/`rootId` = the question root,
  inheriting rule/quorum/ends_at/category); **1** → `400`; **0/absent** → a plain
  yes/no Decision. Ignored for forks/documents/non-decision roots. Option
  children are created in a **loop** (non-atomic, matching the mock).
- **Vote validation**: a `Pick` of the question root is rejected (`400`) — vote
  for an option, `__none__`, or `__abstain__`.
- **Close**: the question root is **excluded from `valid_ids`** (only options can
  win); the question root's status derives from the outcome (`passed` if any
  option won, else `rejected`/`quorum_failed`); winning option `passed`, losers
  `rejected`. `decide_outcome` is unchanged — the close job builds `valid_ids`.
  Plain decisions are untouched (no `is_question` node).
- **DTO**: `is_question` on `Proposal`; `options[]` on `CreateProposalBody`.

## Events

`proposal_created` gains `is_question` + `option_count`. Option children are
created internally and not individually logged.

## Tests

- Integration (`tests/options_it.rs`, DynamoDB-Local): question root + 3 option
  children (empty body, `parent = root`, tree = 4); close passes the winning
  option **and** the question root; close with no winner rejects the root; a
  stray `Pick(questionRoot)` is excluded from candidates (an option still wins).
- **Not integration-covered** (handler-layer, needs auth): options branching
  (0/1/2+ → `400`), vote-rejects-question-root `400`. Simple branches, flagged.
- No new unit tests — `decide_outcome` is unchanged; the new logic is I/O-bound.

## Out of scope

Multi-select / approval voting (the fuller Poll); editing options after publish;
document + isQuestion combinations (questions are Decision-only).

## Notes / risks

- **Non-atomic question creation** — root then children in a loop; a mid-loop
  failure leaves a partial question (rare; create is retryable). Matches the mock.
- **Create signature growth** — `proposal::create` gained an `is_question` param
  (a builder/struct refactor is a future cleanup).

## References

- `apps/api/src/repo/proposal.rs` (`is_question`), `jobs/close_proposal.rs`
  (candidate exclusion + question-root status), `handlers/proposals.rs` (options
  → question + children), `handlers/votes.rs` (reject question-root pick)
- `apps/api/tests/options_it.rs`
- `apps/web/src/mocks/handlers/proposals.ts`, `mocks/handlers/_helpers.ts`
  (`autoCloseDuePoll`), `components/VoteControl.tsx` — parity source.
- Decisions 0005, 0009, 0011, 0012.
