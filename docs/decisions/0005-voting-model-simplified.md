# 0005 — Simplified voting model: one vote per deliberation

**Status:** accepted
**Date:** 2026-05-21
**Supersedes (partially):** 0002 (the `fork_mode` concept + ranked-choice "competing" mode)

## Context

The original forking model (decision 0002) split deliberations into two
modes:

- **Independent** — each fork is voted yes / no / abstain on its own; multiple
  forks can pass.
- **Competing** — voters rank all variants in one Schulze-style ballot; one
  winner.

In practice this created two distinct vote-cast interactions, two different
tally shapes, two outcome rules, and a `fork_mode` field that propagated
through compose, the list, the detail page, the tally, and the audit log.
The owner asked: *can we drop ranked? and one vote per proposal/document?*

## Decision

One unified voting model. The "independent" / "competing" / ranked-choice
distinction is gone.

### The model

- A deliberation is a tree of proposals (root + alternatives), identified by
  the root's id.
- Each user casts **exactly one** vote per deliberation. The vote's `choice`
  is one of:
  - **A proposal id** in the tree — picks that alternative.
  - **`__none__`** — "none of these".
  - **`__abstain__`** — silence.
- Votes are stored at the root: `(root_id, user_id, choice)`.
- `ends_at`, `quorum`, `voting_rule`, `proposal_kind` and (when kind=document)
  `document_name` live on the root. Alternatives inherit them.

### Voting rules

Four rules, picked when the root is created. Stored on the root as
`voting_rule`:

| Rule | Outcome |
|---|---|
| **plurality** | Most votes wins. Ties leave no winner. |
| **simple_majority** | Winning option needs > 50% of decisive votes. |
| **two_thirds** | Winning option needs ≥ 66% of decisive votes. |
| **consensus** | Every decisive vote must converge on the same alternative. Silence (abstain) counts as consent; "none of these" disqualifies. |

*Decisive* = picked an alternative OR picked "none of these". Abstain is not
decisive. Quorum (if set) gates the rule entirely: insufficient participation
→ `quorum_failed` regardless of choices.

For a solo proposal (no alternatives) the "options" presented are *Pass*
(= picking the proposal's own id) and *Don't pass* (= picking `__none__`).
The rule applies the same way — e.g. simple-majority on a solo proposal
passes if `Pass > 50%` of decisive votes.

### Outcome application

When a deliberation closes:

1. Quorum check. If `decisive < quorum` → every proposal in the tree gets
   status `quorum_failed`.
2. Otherwise compute the winning alternative under the rule.
3. The winner (if any) gets status `passed`. Every other proposal in the
   tree gets `rejected`.

Withdrawal is still per-proposal and pre-empts the close.

### What this drops

- `fork_mode` (the 'independent' / 'competing' enum on roots).
- The ranked-choice / Schulze interaction (was PLANNED in M1; never shipped).
- Per-alternative yes / no / abstain votes.
- The implicit ability for multiple alternatives in one deliberation to all
  pass.

### What survives

- The forks tree shape (`parent_id`, `root_id`, `tree_flat`).
- Quorum semantics.
- The fact that an alternative inherits the deliberation's parameters from
  the root.

## Wire shape (mock-only this slice)

`Proposal` gains:

- `voting_rule: 'plurality' | 'simple_majority' | 'two_thirds' | 'consensus'`
- `proposal_kind: 'decision' | 'document'`
- `document_name: string | null` (only when kind = document)
- `tally_by_choice: Record<string, number>` — alternative id → vote count
- `tally_none: number` — votes for "none of these"
- `tally_decisive: number`
- `your_root_choice: string | null` — caller's choice (proposal id, `__none__`,
  `__abstain__`, or null)

Legacy `voting_mode` / `tally_yes` / `tally_no` / `tally_abstain` /
`your_choice` are still emitted, mapped onto the new shape so older clients
don't crash mid-transition. They will go away when the real OpenAPI spec
catches up.

The vote endpoint takes `{ choice: string }` where `choice` is a proposal id
or one of the special tokens. The legacy `'yes' | 'no' | 'abstain'` values
are accepted and mapped (yes → URL proposal's own id, no → `__none__`,
abstain → `__abstain__`).

## Audit / events

- `mock.vote.cast` payload: `choice` (string).
- `mock.proposal.close` payload: `winner_id` (string | null), `status`
  (`'has_winner' | 'no_winner' | 'quorum_failed'`).

## Storage sketch (BE wire-up, NOT this slice)

- `Vote`: `PK = "ROOT#{rootId}"`, `SK = "VOTE#{userId}"`, attributes
  `choice`, `at`. One row per voter per deliberation.
- `Proposal.VotingRule` (S), `Proposal.ProposalKind` (S), `Proposal.DocumentName` (S, sparse).

## References

- `apps/web/src/mocks/outcome.ts` — pure outcome computation.
- `apps/web/src/components/VoteControl.tsx` — unified vote UI.
- `apps/web/src/components/VotingRulePicker.tsx` — compose-time picker.
- `apps/web/tests/outcome.test.ts` — exhaustive rule tests.
- `docs/decisions/0002-forking-mock-first.md` — what this supersedes.
- `docs/decisions/0004-documents-mock-first.md` — sibling decision for
  documents, built on top of this voting model.
