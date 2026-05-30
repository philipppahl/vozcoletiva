# 0013 — Categories (topics) in the Rust backend (slice D)

**Status:** accepted
**Date:** 2026-05-30
**Builds on:** 0010 (single-table design), 0011/0012 (proposals)

## Context

The mock has project-scoped categories ("topics" in the UI; `category_id` in the
entity) and the proposal-create flow requires one. The Rust backend had none, and
`proposal::create` didn't set a category. Slices C (documents) and B2
(multi-option) both assume a category exists, so this lands first.

## Decision

- **Topic entity**: `PK=PROJECT#<pid>`, `SK=TOPIC#<id>` (plain ULID id, not the
  mock's `cat-` prefix), attrs `name`, `position` (creation order), `createdAt`.
- **CRUD** at `…/categories[/{id}]`: list (member); create / rename (PATCH) /
  delete (owner/admin via `require_admin`). Name: trimmed, 1–30 chars; duplicate
  (case-insensitive) → `409`.
- **Default "Commons" category** is created in the `project::create`
  transaction (now 4 items), so every project always has a category.
- **Delete guard = scan** (decided): refuse if any proposal references the
  category (`Select=COUNT` query filtered on `categoryId`) or if it's the last
  category. Chosen over a denormalised `proposalCount` counter — delete is a rare
  admin action and scan exactly matches the mock; `data-model.md` updated.
- **`category_id` on proposals**: a root resolves it from a `category_id` in the
  request (validated to belong to the project, else `400`) or the project's
  default; a fork inherits the root's. Threaded through `proposal::create` /
  `create_fork` / `from_item` and the `Proposal` DTO.
- **Delete response** is `200 {ok:true}` (codebase JSON convention) rather than
  the mock's `204` — a minor, intentional deviation.

## Events

`category_created`, `category_renamed`, `category_deleted` — `project_id`,
`category_id`, `by_user`. No PII.

## Tests

- Unit (`domain/category.rs`): `validate_name` trims / rejects empty / 30-char
  boundary.
- Integration (`tests/categories_it.rs`, DynamoDB-Local): default "Commons" on
  project create; create/list(ordered)/rename; `count_referencing` (1 for a used
  category, 0 for an empty one) + delete removes it; proposal carries its
  category and a fork inherits the root's.
- **Not integration-covered** (handler-layer, needs auth): admin-only `403`,
  duplicate-name `409`, name `400`, last-category `409`. Simple branches, flagged
  (consistent with A/B).

## Out of scope

- **No reorder endpoint** — not in the mock; `position` is creation order.
- Document-amendment category inheritance (amendments inherit the current
  version's category) — slice C.
- Category colours/icons, archiving.

## References

- `apps/api/src/domain/category.rs`, `repo/category.rs`, `handlers/categories.rs`
- `apps/api/src/repo/project.rs` (default category), `repo/proposal.rs`,
  `handlers/proposals.rs` (category_id wiring)
- `apps/api/tests/categories_it.rs`
- `apps/web/src/mocks/handlers/categories.ts`, `mocks/db.ts` — parity source.
- Decisions 0010, 0011, 0012.
