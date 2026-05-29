# 0002 — Forking: ship the FE shape ahead of the BE

**Status:** accepted
**Date:** 2026-05-20
**Slice:** M1 of the mock-first design integration (see `docs/design/ext-2026-05-19/integration-plan.md`)

## Context

Forking is a first-class deliberation primitive: a proposal can have alternatives that form a tree, and the user-facing experience changes substantially when a tree has more than one node (deliberation cards on the list, sticky variant tabs on detail, competing-mode root pivot). The design has been settled by user + designer. The Rust backend, OpenAPI spec, DynamoDB schema and CDK infra haven't moved on it yet.

We want to iterate on the forking UI before committing to a wire contract — the design might surface a field we hadn't thought of, the tally semantics for competing mode are still in flux, and the user wants to see and feel the surface before we cement it. So this slice ships the FE + mock layer first, with a hard commitment to backfill the real BE in a later slice.

## Decision

The MSW mock layer returns three new fields on the Proposal DTO that the OpenAPI spec doesn't declare:

- `parent_id: string | null`
- `root_id: string`
- `fork_mode: 'independent' | 'competing' | null` (set on roots; `null` on descendants — they inherit from root)

The FE consumes these via a tiny local shim, `apps/web/src/lib/proposals/types.ts`:

```ts
export type ExtendedProposal = components['schemas']['Proposal'] & {
  parent_id?: string | null;
  root_id: string;
  fork_mode?: ForkMode | null;
};
```

The FE's `useProposal` / `useProposals` / `useProposalTree` hooks all cast through `ExtendedProposal`. `openapi-fetch` passes the unknown fields through; the OpenAPI types don't refuse them. The mock handlers consume the matching fields on POST (`parent_id`, `fork_mode`).

There's a new endpoint, mock-only this slice:

- `GET /v1/projects/{slug}/proposals/{id}/tree` → `{ proposals: ExtendedProposal[] }` — depth-first flat tree from the proposal's root, ordered by `created_at` within depth.

`POST /v1/projects/{slug}/proposals` now accepts `parent_id` and `fork_mode`. When `parent_id` is set, voting_mode and quorum are inherited from the parent (request values ignored); the descendant's `fork_mode` is `null`; the descendant's `root_id` matches the parent's `root_id`. Forks of closed parents are rejected with 409.

## Why not regenerate the OpenAPI spec now?

We could write the new fields + endpoint into `apps/api/openapi.yaml` and regenerate the client types before implementing the BE. The advantage: type-safe end to end, no shim. The drawback: every mistake we make iterating on the design gets baked into the spec, the regenerated client, and any external integration we might draft against it. The shim is small, isolated, deletable in one PR — much cheaper than walking back a contract.

## What lands when the real BE catches up

When the BE slice ships:

1. `apps/api/openapi.yaml` adds `parent_id`, `root_id`, `fork_mode` to the Proposal schema; adds the `/tree` endpoint; declares the POST extension.
2. `bun run api:generate` regenerates `packages/api-client/src/generated/schema.ts`.
3. `apps/web/src/lib/proposals/types.ts` (this shim) gets deleted; everything that imported `ExtendedProposal` switches to `components['schemas']['Proposal']`.
4. The mock handlers stay; they're now serving exactly the same shape the real BE serves.
5. The Rust handlers learn to read/write the new fields. `Proposal` struct gains them. DynamoDB items gain `ParentId`, `RootId`, `ForkMode` attributes.

## DynamoDB plan (not implemented in this slice)

Proposal items gain three attributes: `ParentId` (S, optional), `RootId` (S, required), `ForkMode` (S, only on roots). New GSI3:

- `GSI3PK = "ROOT#{rootId}"`
- `GSI3SK = "{createdAt}#{proposalId}"`

so `GET /tree` is one `Query` rather than a tree-walk. The fields stay independent of GSI1 / GSI2 (no key overlap). No backfill needed (no production data).

## What this decision is *not*

- Not a commitment to ship competing-mode voting in the same slice. The UI for competing mode (CompetingDecision component) has a PLANNED stamp and a disabled Submit. The data shape supports it; the interaction lands later.
- Not a sign-off on threaded comments, mentions, reactions, or any of the post-fork UI changes. Those are independent slices.
- Not a green light to extend the wire shape this way as a general pattern. The shim has a clear deletion plan; new extensions need their own decision doc and a similar plan.

## References

- `docs/conventions/mocks.md` § *Caveats* — the "mock extends the wire schema" pattern.
- `docs/design/ext-2026-05-19/integration-plan.md` § *Slice 3 — Forking*.
- `apps/web/src/components/forks/` — all the forking UI components.
- `apps/web/src/mocks/handlers/proposals.ts` — tree endpoint + POST extension.
