---
name: run-checks
description: Run all non-test static checks in one shot — biome, tsc, cargo check, clippy, and the API-client codegen verify. Use before commit, before push, before opening a PR. Equivalent to CI stage 1.
---

# run-checks

The quality gate that runs **all static checks** but no tests. Equivalent to CI's stage 1. Use before committing, before pushing, before opening a PR.

## What it runs

In order, failing fast on the first failure:

1. `biome check .` — lint + format check for all TS / JS / JSON.
2. `tsc --noEmit` per TS workspace (`apps/web`, `apps/infra`, `packages/*`).
3. `cargo check --workspace --all-targets`.
4. `cargo clippy --workspace --all-targets -- -D warnings`.
5. `bun run api:generate --verify` — codegen output matches the OpenAPI spec.

## Prerequisites

- `bun`, `cargo`, and `rustup` installed.
- `bun install` has been run.
- `Cargo.lock` is up to date.
- The OpenAPI spec exists. If it has not yet been generated for the first time, step 5 emits a notice and is skipped (does not fail).

## When to use

Trigger this skill:

- Before every commit.
- Before push.
- Before opening a PR.
- Right after pulling new code, to verify the workspace is clean.
- When investigating a CI failure on stage 1 — run locally to reproduce.

Do **not** use this skill when:

- The user explicitly asked for tests (use `run-tests`).
- The user is mid-edit and just wants a quick type check on the current file's workspace.

## Output format

- **On success**: one-line summary — `✓ all checks passed (X.Ys total)`.
- **On failure**: the failing stage name + the tool's verbatim output, followed by a one-line next-step hint.

## Failure modes — common fixes

- **Lint / format**: `biome check --apply-unsafe` may auto-fix; do not run that unattended on untracked changes.
- **Type errors**: fix the types; do not `@ts-ignore`.
- **Clippy warnings**: fix the code; do not `#[allow(clippy::...)]` without a comment justifying it.
- **Codegen mismatch**: run `bun run api:generate` and commit the regenerated `packages/api-client`.

## Cross-references

- `docs/conventions/ci.md` — full CI strategy and stage definitions.
- `docs/conventions/testing.md` — separate concern; `run-tests` is its entry point.
- `clean-code.md` § *Formatting and Linting* — why these tools.
