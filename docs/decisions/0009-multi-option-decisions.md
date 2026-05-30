# 0009 — Multi-option decisions (single-select, upfront options)

**Status:** accepted
**Date:** 2026-05-30
**Builds on:** 0005 (voting model)

## Context

The deliberation model (0005) already supports picking one alternative among
several — but the only way to *get* multiple options was to create a proposal
and then fork an alternative one at a time. There was no way to author a
multi-option vote upfront, and people expected to define a question + a list
of options in the compose form.

The owner scoped it: **single-select** (pick one), **lightweight option
labels** (not full proposals).

## Decision

A Decision can carry an upfront **options** list. When the author supplies
2+ option labels, the proposal becomes a multi-option vote that rides on the
existing deliberation tree:

- The proposal the author writes (Title + Body) becomes the **question root**,
  marked `isQuestion: true`. It frames the vote but is **not itself a votable
  choice**.
- Each option label becomes a lightweight child proposal (`title = label`,
  empty body, `parent_id = question root`). These are the choices.
- Voters pick **one** option, or "None of these", or abstain — the existing
  single-vote-per-deliberation tally (0005) is unchanged.

If fewer than 2 options are given, it's a plain yes/no Decision exactly as
before. 1 option is rejected by the UI (add another or remove it).

### Why reuse the deliberation tree
The vote interaction (pick-one among alternatives + none-of-these), the tally,
revision tags, closing/outcome, and the comment thread all already exist. A
multi-option decision is just a deliberation whose root happens to be a
question rather than a candidate. The only new concept is "this root isn't a
choice," carried by `isQuestion`.

### What `isQuestion` changes
- **VoteControl** excludes the question root from the choice list (options +
  "none of these" only).
- **VariantTabs** is hidden for question deliberations — the options are the
  vote, not a navigable tree.
- **DeliberationCard** renders the option children as rows (not the question)
  and labels the count "N options" instead of "N variants"; rows link to the
  question (where you vote), not to the empty option proposals.
- **autoCloseDuePoll** sets the question root's status from the outcome
  (`passed` if any option won, else `rejected`/`quorum_failed`) rather than
  treating it as a losing candidate.

### Out of scope
- **Multi-select** (approval voting) — the fuller Poll type; a later slice.
- Document polls, Election/Petition.
- Editing the option set after publish, reordering options, per-option bodies.
  (Adding another option later still works via "Propose an alternative".)

## Wire shape (mock-only)
- `POST /v1/projects/{slug}/proposals` accepts `options?: string[]`. On a
  brand-new decision root with 2+ non-blank labels, the handler creates the
  question root (`is_question: true`) + one option child per label.
- `Proposal` DTO gains `is_question: boolean`.

## Storage sketch (BE wire-up, not this slice)
`Proposal.IsQuestion` (BOOL, sparse — only on multi-option roots). Options are
ordinary child proposals (`ParentId` = question root), same as forks.

## References
- `mocks/handlers/proposals.ts` — options → question root + children.
- `components/VoteControl.tsx` — excludes the question root.
- `components/forks/DeliberationCard.tsx`, `VariantTabs.tsx` — display.
- `routes/p.$slug.proposals.new.tsx` — Options repeater.
- `tests/proposals-options.test.ts`.
- Decision 0005 (voting model) — the single-vote semantics this builds on.
