# 0011 — Per-deliberation votes in the Rust backend (slice A)

**Status:** accepted
**Date:** 2026-05-30
**Builds on:** 0005 (voting model), 0010 (single-table design)
**Implements:** the vote/tally/outcome reshape; the first backend slice toward
replacing the mock.

## Context

The Rust backend was written against the pre-0005 sketch: votes keyed
per-proposal (`PROPOSAL#<id>` / `VOTE#<user>`) with yes/no/abstain and
`tallyYes/No/Abstain` counters on the proposal head, and a 2-variant
`VotingMode`. Decision 0005 + `data-model.md` require per-*deliberation* votes
keyed on the root, a `byChoice` tally, and four voting rules. This slice
reconciles the vote path; forks/options (a multi-candidate tree) are slice B.

## Decision

- **Vote keys on the root.** `PK=DELIB#<rootId>`, `SK=VOTE#<userId>`. `choice` is
  the picked alternative's proposal id, or `__none__` / `__abstain__`
  (`domain::vote::Choice::{Pick,NoneOfThese,Abstain}`).
- **Tally lives on the root head**, not a separate item: `tallyByChoice` (map,
  initialised `{}`), `tallyNone`, `tallyAbstain`. The cast/retract transaction is
  three items — `Update`(root head: `status=voting AND endsAt>now` guard +
  `ADD tallyByChoice.<choice>`), `Put`/`Delete`(vote), `Put`(vote event). One
  item doubles as guard + tally, and proposal reads carry the tally for free.
  This **supersedes the separate `TALLY` item** sketched in 0010 (data-model.md
  updated).
- **Outcome** is a faithful port of the mock's `decideOutcome`
  (`domain::outcome::decide_outcome`): four rules (plurality / simple_majority /
  two_thirds / consensus), "none of these" competing against alternatives,
  quorum over decisive votes. `VotingMode`(2) → `VotingRule`(4).
- **Vote history** GSI2: `USER#<uid>` / `VOTE#<rootId>` (a ULID — sorts by
  deliberation age, stable across vote changes).
- **Slice-A validation:** a `Pick` must be the root id (the only candidate until
  forks land); other ids → `400`.
- **PII:** operational logs never carry the choice; the `VOTEEVENT` audit item
  does (event-source store, not a log).

## Wire / API

- `POST …/proposals/{id}/vote` body `{choice}` — wire shape unchanged; semantics
  now id / `__none__` / `__abstain__`.
- `POST …/proposals` — `voting_rule` (4 values), was `voting_mode` (2).
- `Proposal` response — `voting_rule`, `root_id`, and tally fields
  `tally_by_choice` / `tally_none` / `tally_abstain` / `tally_decisive` /
  `tally_total` replace `voting_mode` / `tally_yes/no/abstain` / `voter_count`.
- `openapi.yaml` + `packages/api-client` regenerated.

## Migration

Dev table wiped of `PROPOSAL#`/`VOTE#`/`VOTEEVENT#` items (old shape is
incompatible: no `rootId`, yes/no tally, `votingMode`). No prod exists. New
items carry the new shape; `proposal_from_item` falls back `rootId = id` for any
stragglers.

## Tests

- Pure: `domain::outcome` ports the mock's full rule matrix; `Choice` /
  `VotingRule` round-trips; status mapping.
- Integration (`tests/votes_it.rs`, `--features test-support`): real
  DynamoDB-Local — cast/change/retract tally, closed-guard `Conflict`,
  simple-majority pass, none→reject, below-quorum→quorum_failed. A
  `test-support` feature exposes `AppState::for_test` + `JwtVerifier::stub`.

## Out of scope (next slices)

Forks / option children / the tree query (multi-candidate outcomes), multi-node
status application on close, `proposalKind`/`categoryId`/`documentName` on
create. The outcome logic already supports multiple alternatives; only the
candidate set is root-only for now.

## References

- `apps/api/src/domain/{vote,voting_rule,outcome,proposal}.rs`
- `apps/api/src/repo/{vote,proposal}.rs`, `handlers/{votes,proposals}.rs`,
  `jobs/close_proposal.rs`
- `apps/api/tests/votes_it.rs`, `tests/support/mod.rs`
- `apps/web/src/mocks/outcome.ts` — the parity source.
- Decisions 0005, 0010.
