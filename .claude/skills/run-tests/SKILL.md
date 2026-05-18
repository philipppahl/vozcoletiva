---
name: run-tests
description: Run the test suite. `fast` mode (default) runs unit + integration; `full` mode adds Playwright E2E. Equivalent to CI stage 2 (fast) and stages 2 + 3 (full).
---

# run-tests

Run the project's test suite. Two modes:

- **`fast`** *(default)* — unit + integration tests. Equivalent to CI stage 2.
- **`full`** — fast plus the Playwright E2E suite. Equivalent to CI stages 2 + 3.

Pass `--mode full` for the complete run; otherwise `fast`.

## What runs

### `fast` mode

1. `vitest run` — TS unit and component tests.
2. `cargo test --workspace` — Rust unit and integration tests. The integration tests bring up **DynamoDB Local** via `docker-compose`.

### `full` mode

Everything `fast` does, plus:

3. `bunx playwright test` — E2E flows in mobile and desktop viewports.

## Prerequisites

- `bun install` has run.
- `docker` / `docker-compose` is running locally (for DDB Local during Rust integration tests).
- For `full`: `bunx playwright install` has cached the browser binaries.

## When to use

- During feature work, after meaningful code changes.
- Before opening a PR (run `full` at least once).
- Before merging to `main` — CI also runs `full`, but local is faster than waiting.
- Right after pulling new code, to ensure the workspace still builds.

## Failure handling

- Print the failing test names and the relevant excerpt of the runner's output.
- **Do not auto-retry.** Flaky tests are a bug to fix, not a failure mode to mask.
- If a test fails that touches code you didn't change, surface it explicitly — do not silently assume it's pre-existing.

## Cross-references

- `docs/conventions/testing.md` — the pyramid, what to test, fixtures, snapshot + property + E2E policy.
- `run-checks` — the static-checks counterpart; usually run alongside.
- `docs/conventions/ci.md` — when each layer runs in CI.
