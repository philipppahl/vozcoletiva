# 0007 — Categories: one taxonomy shared by proposals and documents

**Status:** accepted
**Date:** 2026-05-21
**Slice:** M7 of the mock-first design integration

## Context

Projects accumulate proposals and documents quickly. Without a way to group
by subject area, the lists become a chronological wall. The owner asked for
*categories* — a small, project-scoped taxonomy that applies equally to
proposals and documents, with one category per item.

## Decision

A single entity type — `Category` — owned by the project, used by both
proposals and (transitively) documents (since documents are just passed
Document-kind proposals; see decision 0004).

### Invariants

- A project always has at least one category. The seed creates **"Commons"**
  (PT: "Comuns") at project creation; you can rename it but you can't be
  left with zero.
- A proposal has exactly one category (`MockProposal.categoryId: string`).
  Required. Forks inherit from the root; document amendments inherit from
  the previous version's category.
- Category names are unique within a project, case-insensitive. Length cap
  30 chars.

### Permissions

- **Owners + admins** create / rename / delete categories. Moderators do
  not.
- All members read and tag.

### Delete semantics

- 409 if the category still references any proposal.
- 409 if it's the project's last category.
- No cascade-to-default. The admin must move items first (a bulk
  re-categorise UI is a follow-up — see ledger entry M7-recategorise).

### UI

- `CategoryChips` filter row at the top of the Proposals and Documents
  lists. "All" is the default; selection lives in `?category=<id>` so it's
  linkable and survives navigation.
- `CategoryBadge` next to the status pill on every card.
- `CategoryPicker` on the compose form for brand-new roots. Hidden + shown
  as a read-only badge on forks and document amendments (inherited).
- `/p/$slug/categories` admin route, reached from the existing per-project
  Manage area. Non-owners/admins see a "Only owners and admins can manage
  categories" message.

### Out of scope (M7)

- Multiple categories per item.
- Per-category permissions / muting / notifications.
- Nested categories.
- Cross-project shared taxonomy.
- Drag-to-reorder (initial release supports rename + delete; reorder via
  position update is a follow-up).
- Bulk re-categorise — the only path to delete a populated category is to
  move items one-by-one, which today means editing each proposal. Not
  great; tracked as M7-recategorise.
- Per-category colour / icon.

## Wire shape (mock-only this slice)

- `GET /v1/projects/{slug}/categories` → `{ categories: Category[] }`.
- `POST /v1/projects/{slug}/categories` body `{ name }` → `Category` (201).
  409 on duplicate. 403 unless owner/admin.
- `PATCH /v1/projects/{slug}/categories/{id}` body `{ name }` → `Category`.
  Same auth + uniqueness rules.
- `DELETE /v1/projects/{slug}/categories/{id}` → 204; 409 with a specific
  message when references exist or it's the last category.
- `POST /v1/projects/{slug}/proposals` body grows optional `category_id`.
  Server validates membership; falls back to the project's position-0
  category when omitted. Inheritance applies on forks + document
  amendments.

## Storage sketch (BE wire-up, NOT this slice)

- `Category`: `PK = "PROJECT#{projectId}"`, `SK = "CAT#{categoryId}"`.
  Attributes: `Name`, `Position`, `CreatedAt`.
- Uniqueness on `(ProjectId, lowercase(Name))` enforced via either a
  conditional put against a sentinel `SK = "CAT_NAME#{lowercaseName}"`, or
  a sparse GSI with a uniqueness check before put.
- `Proposal.CategoryId` (S, required).
- "List proposals by category" piggybacks on the existing project scan; if
  it gets hot, a sparse GSI `(ProjectId#CategoryId, CreatedAt)` is the
  right shape.

## References

- `apps/web/src/mocks/db.ts` § "category helpers" — storage helpers.
- `apps/web/src/mocks/handlers/categories.ts` — CRUD.
- `apps/web/src/components/categories/*` — UI.
- `apps/web/src/routes/p.$slug.categories.tsx` — admin route.
- `apps/web/tests/categories-db.test.ts` — unit tests.
- Decisions 0004 (documents) + 0005 (voting model) — documents inherit the
  proposal's category transitively.
