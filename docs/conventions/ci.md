# CI / deployment convention

Status: initial, 2026-05-18. Revise once the first workflow YAML lands.

## Platform

**GitHub Actions.** Single canonical CI for the project. Free for open source; matches the project's GitHub-hosted home.

## Environments

Two from day one — no `staging` until traffic demands it.

| Env | Purpose | Hostname | Deployable from |
|---|---|---|---|
| **`dev`** | Active development, integration testing, demos. | `dev.vozcoletiva.com` | Developer laptop **or** CI. |
| **`prod`** | The hosted instance. | `vozcoletiva.com` (+ `www`) | **CI only** (GitHub Actions). |

Hostname → env mapping and the cross-region cert setup are recorded in
`docs/decisions/0036-custom-domain.md`. The apex is reserved for prod; it goes
live when prod ships (Phase 2 / CI/CD cycle). dev is live on its subdomain now.

## Triggers

| Trigger | Action |
|---|---|
| Open / push to PR branch | Stages 1–3 (checks + tests) |
| Push to `main` (via merged PR) | Stages 1–3 + deploy to `dev` + deploy to `prod` |
| Tag `v*.*.*` | Optional release-notes / asset upload (no deploy effect; deploys ride pushes to `main`) |

Direct push to `main` is forbidden by branch protection **and** by `CLAUDE.md` § *Hard prohibitions*. Production state changes therefore only land through reviewed PRs merged on GitHub.

## Stages

| # | Stage | What | Wall-time budget |
|---|---|---|---|
| 1 | Static | `biome check`, `tsc --noEmit`, `cargo check`, `cargo clippy -- -D warnings`, codegen verify | < 2 min |
| 2 | Tests (fast) | `vitest run`, `cargo test --workspace` (Rust integration tests use DDB Local) | < 4 min |
| 3 | Tests (slow) | `playwright test` (mobile + desktop viewports) | < 5 min |
| 4 | Deploy dev | `deploy --env dev` (CDK synth + diff + deploy) | < 6 min |
| 5 | Deploy prod | `deploy --env prod` (gated on stage 4 green) | < 6 min |

Stages 4 + 5 run only on `main`. Stage 5 requires stage 4 to be green.

## Caching

- **Bun**: `~/.bun/install/cache` + `node_modules`, keyed on `bun.lock`.
- **Cargo**: registry + `target/`, keyed on `Cargo.lock`. Shared per workflow + branch.
- **Playwright browsers**: keyed on the Playwright version. Large but slow to install fresh.

## Codegen verify step

Part of stage 1: `bun run api:generate --verify` regenerates `packages/api-client` from the current OpenAPI spec and **fails the build** if the committed output differs from what the current spec would produce. See `docs/frontend-stack.md` § *API client* for the rationale.

Codegen output must be **deterministic** (sorted keys, stable formatting) or this step will false-positive.

## Deployment gates

- **Dev**: any successful CI run on `main` deploys. Devs may also run `deploy --env dev` locally.
- **Prod**: deploys **only** from inside GitHub Actions.
  - The `deploy` skill refuses `--env prod` unless `GITHUB_ACTIONS=true`.
  - The `deploy --env <name>` script (to be authored) mirrors the same guard.
- **Break-glass**: in a genuine emergency, a human with prod IAM credentials may set `VOZ_FORCE_PROD_DEPLOY=1` locally and run `deploy --env prod`. The action is logged to the audit trail and announced in writing. Not a routine path.

## Secrets

- **AWS access**: GitHub Actions uses **OIDC-federated** IAM roles — no long-lived AWS keys in repo secrets. One role per env (`vozcoletiva-deploy-dev`, `vozcoletiva-deploy-prod`); the prod role is only assumable by the deploy workflow on `main`.
- **VAPID keys, Cognito client secrets, etc.**: stored in **AWS Secrets Manager** / SSM Parameter Store at the env level. CDK pulls them in at synth time; CI never echoes their values.
- **GitHub repo secrets**: only what GH Actions itself needs (the OIDC role ARNs, a Sentry DSN if logging build issues).

## Branch protection (recommended ruleset for `main`)

- At least **1 approving review**.
- **Stages 1–3 passing** (required status checks).
- Branch **up-to-date** with `main` before merge.
- **Linear history** (squash or rebase merges only — no merge commits).
- **Force-push and direct-push: disabled.**
- Signed commits: optional; revisit if friction is low.

## Notifications

- **CI failure on `main`** → email to the merger (GH Actions default) plus an auto-opened Issue for prod-deploy failures.
- **Successful prod deploy** → audit-log entry; routine deploys do not need an ADR in `docs/decisions/`.

## Workflow files

Deferred until the first app exists (`apps/web` or `apps/infra`). Target layout when it lands:

```
.github/workflows/
  ci.yml       # stages 1–3, runs on PR + main
  deploy.yml   # stages 4 + 5, runs on main only (needs: ci)
```

## Open follow-ups

- **Pre-commit / pre-push enforcement** locally (lefthook / husky / cargo-husky). Worth wiring once a real workspace exists.
- **Sentry integration & alerting rules** — separate convention (`docs/conventions/logging.md` when authored).
- **Staging environment** — skipping for v1; add when prod traffic and a real release cadence justify it.

## Cross-references

- `CLAUDE.md` § *Hard prohibitions* — direct `cdk deploy` and local prod deploys forbidden.
- `docs/conventions/testing.md` — what runs in stages 2 + 3.
- `docs/frontend-stack.md` § *API client* — codegen-verify rationale.
- `.claude/skills/run-checks`, `.claude/skills/run-tests`, `.claude/skills/deploy` — local entry points.
