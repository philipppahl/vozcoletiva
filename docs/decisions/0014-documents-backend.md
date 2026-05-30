# 0014 — Documents in the Rust backend (slice C)

**Status:** accepted
**Date:** 2026-05-30
**Builds on:** 0004 (documents are derived), 0010 (single-table), 0011/0012 (proposals), 0013 (categories)

## Context

Documents are a derived view over Document-kind proposals (decision 0004): no
Document entity. The Rust backend had no document concept and proposal create
had no `proposal_kind`. This slice adds it and closes the document-amendment
category branch deferred in slice D.

## Decision

- **Proposals carry** `proposal_kind` (`decision` default | `document`) and
  `document_name` (Document only). Forks inherit both from the root.
- **Document create** (a `document` root): `document_name` required (`400`);
  **one active per name** — refuse (`409`) if a *voting* Document deliberation
  already exists for `(project, name)`. An **amendment** is just a new
  same-name deliberation.
- **Category inheritance**: a document whose name already has a passed version
  inherits that current version's category; otherwise it resolves a named/default
  category like a decision (closes the slice-D deferral).
- **DOC index set at close.** When a node is marked `passed`, if it's a Document
  the same transaction sets `GSI3PK=PROJECT#p#DOC`, `GSI3SK=<name>#<closedAt>`
  (instead of removing the VOTING keys). So a document version is indexed exactly
  when it passes; rejected nodes remove their GSI3 keys as before.
  `transition_tree_to_terminal` now takes `TreeTransition { proposal_id, status,
  doc_index }`.
- **Derived reads** (`repo::document`): `passed_versions` (GSI3 DOC, grouped by
  name), `versions_for_name` (`begins_with(name#)`, newest first),
  `active_doc_roots` / `active_for_name` (filtered query of project proposals).
- **Endpoints**: `GET …/documents` (names → current + active amendment),
  `GET …/documents/by-name/{name}` (versions + current + active; `404` if no
  passed version; name percent-decoded).
- **No diff endpoint** — the FE diffs two bodies client-side (mock parity).

## Events

- `document_amendment_proposed` — on creating a same-name document that already
  has a passed version.
- `document_version_published` — in `close`, per passed Document node.
Both: `project_id`, `document_name`, `proposal_id` (+ `by_user` on propose). No PII.

## Tests

- Unit: `ProposalKind` round-trip.
- Integration (`tests/documents_it.rs`, DynamoDB-Local): passed document indexed
  as a version (voting → not; closed → yes; active cleared); amendment adds a
  version and becomes current (newest `closedAt`); `active_doc_roots` excludes
  decisions + passed; a rejected document is not indexed.
- **Not integration-covered** (handler-layer, needs auth): `document_name`
  required `400`, one-active `409`, category-inheritance resolution. Building
  blocks (`active_for_name`, `versions_for_name`) are covered; flagged.
- Harness hardened: `LocalDdb::start` retries `docker run` (port/resource race
  under parallel suites).

## Risks / notes

- **DTO tally** — document version DTOs use each proposal's own stored tally
  (no per-version root load); documents are historical records.
- **Name in path** — percent-decoded; a name containing `/` would break routing
  (rare; unrestricted by the mock). The `#` GSI3SK delimiter is safe because
  grouping reads the `documentName` attribute, not the SK.

## Out of scope

`isQuestion` multi-option (B2); messages/DMs/inbox/search.

## References

- `apps/api/src/domain/proposal.rs` (`ProposalKind`), `repo/document.rs`,
  `repo/proposal.rs` (kind/name + `TreeTransition` DOC index),
  `jobs/close_proposal.rs`, `handlers/documents.rs`, `handlers/proposals.rs`
- `apps/api/tests/documents_it.rs`
- `apps/web/src/mocks/handlers/documents.ts` — parity source.
- Decisions 0004, 0010, 0011, 0012, 0013.
