# 0004 — Documents are a derived view over proposals

**Status:** accepted
**Date:** 2026-05-21
**Slice:** M4 of the mock-first design integration

## Context

The Documents tab is meant to hold canonical texts produced by passing
Document-type proposals. The early plan introduced a `Document` entity and a
`DocumentVersion` entity, each amendment a Document proposal with an
`amends_version_id` pointer, and a race-resolution rule for parallel
amendments.

The owner pushed back: documents and proposals share the same shape — root
+ alternatives + one winner. Treating them as a separate hierarchy was
duplicate machinery.

## Decision

**There is no Document or DocumentVersion entity.** A "document" is a
derived view over proposals.

### The model

- A Document is identified by `(project_id, document_name)`. `document_name`
  is the stable, immutable name (e.g. "House Rules").
- A Document-kind proposal carries `proposal_kind: 'document'` +
  `document_name: string`.
- Two proposals with the same `(project_id, document_name)` are versions of
  the same document.
- "Current text" = the body of the most-recently-passed Document proposal
  with that name in this project.
- "History" = all passed Document proposals with that name, ordered by
  `closed_at` descending. Each one is a "version".
- A diff is just a diff between two proposal bodies — no version entity
  needed.

### Amendment flow

1. Member opens the document detail.
2. Taps **Propose amendment** — compose opens with `?amends=<document_name>`.
3. Compose pre-fills the body with the current version's text and shows a
   live diff toggle.
4. On submit, a new proposal is created with `proposal_kind='document'` +
   `document_name=<original>`. It enters a normal deliberation.
5. Members can fork it (creating alternative bodies; same tree machinery as
   any deliberation).
6. The deliberation closes per the voting rule. If a winner emerges, that
   winning proposal becomes the current version.

### Conflict rule

**At most one active (status=voting) Document deliberation per
`(project_id, document_name)`.** Filing a second one returns 409 with a
message pointing to the in-flight one. This makes parallel race semantics
unnecessary: any second draft must either fork the active deliberation
(becoming an alternative inside it) or wait for it to close.

### What this drops vs. the earlier plan

- `MockDocument` entity → removed
- `MockDocumentVersion` entity → removed
- `amends_document_id` / `amends_version_id` / `resulting_document_id` /
  `resulting_version_id` proposal fields → removed
- `documentPromotion.autoPromoteDocumentVersion` helper → removed (passing IS
  the promotion; there's nothing to do)
- "Stale base" / amendment-race detection → removed

### What survives

- Diff helper + DiffView component.
- DocumentList / DocumentDetail / VersionPicker UI.
- Compose's `?amends=<name>` pathway with body pre-fill + live diff.

## Wire shape (mock-only this slice)

- `GET /v1/projects/{slug}/documents` →
  `{ documents: Array<{ name, version_count, current_version: Proposal, active_amendment: Proposal | null }> }`
- `GET /v1/projects/{slug}/documents/by-name/{name}` →
  `{ name, version_count, current_version: Proposal, versions: Proposal[], active_amendment: Proposal | null }`
- `POST /v1/projects/{slug}/proposals` body grows:
  - `proposal_kind?: 'decision' | 'document'`
  - `document_name?: string` (required when kind=document on a root)
- Validation: `proposal_kind='document'` without `document_name` → 400.
  Active deliberation already exists for that name → 409.

The vote shape is the unified model from decision 0005 — same as any other
proposal. The "winner becomes the new version" is a derived view: when the
deliberation closes with a winner, that proposal's `status` flips to
`'passed'` and queries that compute the current version automatically pick
it up.

## Storage sketch (BE wire-up, NOT this slice)

- `Proposal.ProposalKind` (S, default 'decision').
- `Proposal.DocumentName` (S, sparse — set only when kind=document).
- A sparse GSI on `(ProjectId, DocumentName, ClosedAt)` makes
  "list documents in this project" and "history of a document" cheap.
- No new table.

## Why not even harmonize further

We considered eliminating `proposal_kind` entirely (any passed proposal
could be a "document" if it had a `document_name`). Decided against: kind
exists also for UI affordance (compose surface, list pill, detail
rendering). It's one bit of information that lets the UI specialise without
specialising the storage.

## References

- `apps/web/src/mocks/handlers/documents.ts` — list + detail handlers.
- `apps/web/src/mocks/db.ts` § "document derivation helpers" —
  `documentsForProject`, `documentVersions`, `activeDocumentDeliberation`.
- `apps/web/src/components/documents/*` — UI.
- `apps/web/src/routes/p.$slug.documents.tsx`,
  `apps/web/src/routes/p.$slug.documents_.$name.tsx` — routes.
- `docs/decisions/0005-voting-model-simplified.md` — the voting model
  documents inherit from.
