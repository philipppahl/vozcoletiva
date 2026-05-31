# 0023 — Project search backend (substring, server-side)

**Status:** accepted
**Date:** 2026-05-31
**Builds on:** 0010 (single-table)

## Context

Search was the last surface on the mock. It's a project-scoped lookup over
proposals, documents, members, and channels. DynamoDB has no full-text search;
the MVP needs "good enough" without new infra (no OpenSearch).

## Decision

A single endpoint that fans the query across the project's existing list access
patterns and substring-matches **server-side** (case-insensitive), grouped into
sections, capped per section.

- `GET /v1/projects/{slug}/search?q=` (member-only). `q` under 2 chars → empty
  sections. Each section caps at 10 hits with a `has_more` flag.
- Reuses `proposal::list_for_project`, `document::passed_versions` (grouped by
  name, current = most-recently-closed), `membership::list`, and
  `conversation::list_channels`. No new repo, no new index.
- Snippet: ~80 chars centred on the first match, whitespace collapsed, ellipses
  where clipped (UTF-8 safe — operates on chars).
- DTO matches the existing FE `SearchResponse` exactly (proposals / documents /
  members / channels sections).

This is intentionally simple. When data outgrows a per-request scan-and-filter
(thousands of items), revisit with a search index — but not before.

## API

`GET /v1/projects/{slug}/search?q=` → `SearchResponse`. OpenAPI + api-client
regenerated.

## Tests

- Unit (`handlers/search.rs`): section builders (title/body match, recency sort,
  cap + `has_more`), document grouping (version_count + current version), snippet
  centring/clipping, query percent-decoding.
- The underlying list repos are already integration-tested.

## FE

`lib/search.ts` → `apiClient` (debounced, `keepPreviousData`). The search UI is
unchanged. The full-offline mock keeps its own `runSearch` (MSW intercepts the
real URL).

## Out of scope

Full-text / ranking / typo tolerance, cross-project search, message-body search,
pagination beyond the per-section cap.

## References

- `apps/api/src/handlers/search.rs`, `main.rs`; `apps/web/src/lib/search.ts`
