# vozcoletiva

A mobile-first PWA for structured collective decision-making. Open source. One canonical hosted instance at [vozcoletiva.com](https://vozcoletiva.com).

> **Status**: foundation slice. The plumbing is in place; features land one [`plan-feature`](.claude/skills/plan-feature/SKILL.md) cycle at a time. See [`VISION.md`](./VISION.md) for the product, [`docs/data-model.md`](./docs/data-model.md) for the schema, [`docs/frontend-stack.md`](./docs/frontend-stack.md) for the FE picks.

## Bootstrap

Prerequisites: bun 1.3+, Rust 1.93+, Docker (for DynamoDB Local during integration tests), AWS CLI v2.

```sh
bun install
cargo build --workspace
```

## Daily loop

```sh
# Static checks (CI stage 1).
bun run check
bun run typecheck

# Tests (CI stages 2 + 3).
bun run --filter '*' test            # vitest (web + infra) + cargo test (api)
bunx playwright test --config apps/web/playwright.config.ts   # E2E

# OpenAPI client codegen.
bun run api:generate                 # regenerate from apps/api/openapi.yaml
bun run api:verify                   # CI's verify step locally
```

Inside Claude Code, use the skills directly: `run-checks`, `run-tests`, `deploy`, `plan-feature`.

## Repository layout

```
apps/
  api/         # Rust Lambda backend (axum-flavoured handlers on lambda_http)
  web/         # React + Vite PWA (TanStack Router, Tailwind v4, Radix, Lingui)
  infra/       # AWS CDK (TypeScript) — DynamoDB, Cognito, API Gateway, S3/CloudFront
packages/
  api-client/  # Generated OpenAPI client (openapi-typescript + openapi-fetch)
  shared/      # Shared TS types / constants
brand/         # palette, logos
docs/          # conventions, frontend-stack, data-model, decisions (later)
.claude/       # Claude Code skills (plan-feature, run-checks, run-tests, deploy)
```

## Deployment

```sh
bun run deploy --env dev    # local dev deploy (your AWS profile)
```

Prod deploys land only from GitHub Actions on push to `main`. See [`docs/conventions/ci.md`](./docs/conventions/ci.md).

## Coding standards

[`clean-code.md`](./clean-code.md) is the universal Rust + TS reference. [`CLAUDE.md`](./CLAUDE.md) is the per-session loading manifest for Claude Code.

## Licence

[AGPL-3.0-or-later](https://www.gnu.org/licenses/agpl-3.0.html). Governance tooling should be auditable and forkable.
