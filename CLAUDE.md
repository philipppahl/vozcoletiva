# CLAUDE.md

Loaded on every Claude Code invocation. Tight by design — expand only when a concrete pattern needs enforcing.

## What this codebase is

**vozcoletiva** — a mobile-first PWA for structured collective decision-making. Projects host topics; topics host proposals; members agree, disagree, fork, discuss, and decide under a chosen voting rule within a fixed runtime. Inspired by LiquidFeedback. Open source. One canonical hosted instance at `vozcoletiva.com`.

Backend is Rust on AWS Lambda + DynamoDB + Cognito; frontend is React + Vite + TypeScript, shipped as an installable PWA.

## Required reading

Read once per session, reference as needed:

- `VISION.md` — product vision, domain model, voting modes, lifecycle, MVP scope, open questions. Single source of truth until a `docs/specification.md` exists.
- `clean-code.md` — universal coding standards (Rust + TypeScript).
- `brand/palette.md` — colour tokens, typography, surface mapping for light + dark.

(Further reading will be added as conventions land: logging, API style, DynamoDB access patterns, error taxonomy, etc.)

## The implementation cycle (non-negotiable)

For any feature, fix, or non-trivial change:

1. **Plan first.** First turn produces a *plan*, not code. The plan covers: scope, files touched, new types/modules, API surface, data model, tests, events to log, docs to update, risks.
2. **Wait for human approval.** Do not write code on the first turn unless the human has acknowledged the plan.
3. **Execute the plan.** Surface deviations explicitly when they happen; don't silently expand scope.
4. **End with a summary.** What changed, what tests pass, what's left, what's deferred.

The `plan-feature` skill enforces this. Use it for non-trivial work.

## Definition of done

A change is done when:

- Tests pass (unit + integration where relevant).
- Lint passes (`biome check` for TypeScript, `cargo clippy -- -D warnings` for Rust).
- Type checks pass (`tsc --noEmit`, `cargo check`).
- OpenAPI / AsyncAPI specs regenerated if endpoints or WS messages changed.
- Docs updated where the change affects vision, conventions, or schemas.
- No commented-out code.
- No `TODO` without an issue reference.
- New log / audit / analytics events follow logging conventions (to be authored at `docs/conventions/logging.md` when first needed).
- New architectural decisions captured in a decisions log (to be authored at `docs/decisions/`).

## Hard prohibitions

- **Never push to main.**
- **Never bypass tests** (`--no-verify`, `--skip-checks`, or equivalent).
- **Never introduce a dependency** without a written reason in the PR.
- **Never log PII** — email, real name, IP, vote choice tied to user, comment / chat content. Logging conventions to follow.
- **Never commit secrets** to git. AWS Secrets Manager / SSM Parameter Store for production; `.env.local` (gitignored) for local dev.
- **Never run `cdk deploy` directly.** Always via the `deploy` script with `--env <name>` (e.g. `--env dev`, `--env prod`).
- **Never amend or rebase** commits that have been pushed.
- **Never reach behind the public API.** The webapp is a thin client over the same typed, versioned API external integrations will call. No backdoor "internal" endpoints.

## Project-specific norms

- **Mobile-first PWA.** Every UI iteration is validated at phone widths first. Desktop is the side benefit, not the design target.
- **API-first.** Every state-bearing operation goes through the public, typed, versioned API. No backdoor mutations. The webapp uses the same endpoints external tools and (post-MVP) the MCP server will. See VISION § *API-first & integrations*.
- **Event-sourced where it matters.** Votes, vote changes, role changes, moderation actions, and document amendments are append-only events; current state is materialised. The audit log is a first-class store, not a debug nicety.
- **Scheduled actions are explicit.** Time-bound transitions (voting close, closing-soon reminders) go through EventBridge Scheduler; never a polling loop.
- **Open source posture.** Code is publicly auditable. Don't write anything you wouldn't want a member of a project to read.
- **GDPR-aware by default.** Personally identifying data has a lifecycle (export, hard-delete, anonymise-but-preserve-vote). Don't introduce new PII without thinking through that lifecycle.
- **Calm notifications.** Default is "few, relevant." Adding a new push trigger requires justifying why it crosses the user's threshold.
- **i18n from day one.** UI strings are externalised; EN + PT supported. Don't hard-code copy.

## API-first / MCP-later

The codebase is API-first. Three specific meanings:

1. **Every state-bearing operation goes through a documented API.** No backdoor mutations from UI layers; no internal-only state changes.
2. **The webapp calls the same APIs external integrations will.** OpenAPI for HTTP + AsyncAPI for the WebSocket surface are build artefacts, generated from the Rust handlers — not maintained by hand.
3. **The MCP server (post-MVP) is a thin wrapper over the API.** No parallel business logic. Plan for this shape from day one.

## Stack (committed; VISION.md for full detail)

- **Cloud:** AWS. Single canonical hosted instance. Region likely `eu-west-1` (Iberian audience).
- **IaC:** AWS CDK in TypeScript, driven by a thin `deploy` script taking `--env <name>` mapping to per-environment stack parameters.
- **Backend:** Rust on AWS Lambda. DynamoDB as system of record (single-table default). S3 for media (chat images, voice notes, document exports).
- **Auth:** AWS Cognito User Pools; email + password to start; OAuth providers post-MVP.
- **API:** HTTP API via API Gateway; WebSocket via API Gateway for live tally + chat. OpenAPI + AsyncAPI generated from handlers.
- **Scheduled actions:** EventBridge Scheduler (one-shot rules per proposal).
- **Push:** direct Web Push (VAPID) for the PWA.
- **Email:** SES (transactional).
- **Frontend:** React 19 + Vite + TypeScript (strict). Routing: TanStack Router. Styling: Tailwind v4. Component primitives: Radix UI + custom wrappers, **iOS-native default look & feel**. Data: TanStack Query v5. Forms: react-hook-form + Zod. Validation: Zod. i18n: Lingui. Markdown: react-markdown + remark-gfm + rehype-sanitize. Icons: Lucide. Testing: Vitest + RTL + Playwright. PWA via Workbox. UI state: Zustand. Light + dark mode. Full picks and rationale: `docs/frontend-stack.md`.
- **Package manager / monorepo:** bun + bun workspaces (no Turborepo yet). Apps: `apps/web`, `apps/infra`. Packages: `packages/api-client` (generated from OpenAPI), `packages/shared`.
- **API client codegen:** `bun run api:generate` produces `packages/api-client` from the OpenAPI spec; the dev commits the regenerated output. CI re-runs the codegen and fails the build if the committed output diverges from the current spec. Codegen must be deterministic.
- **i18n:** EN + PT at launch.
- **Logging:** `tracing` (Rust), `pino` (TypeScript) — conventions to follow.
- **Analytics:** EventBridge → Firehose → S3 Parquet → Athena (when needed; not MVP).
- **Errors:** Sentry, filtered to exclude PII (conventions to follow).

## Quick navigation

- Vision: `VISION.md`
- Brand: `brand/palette.md`, `brand/logo-mark.svg`, `brand/logo-wordmark.svg`
- Frontend stack: `docs/frontend-stack.md`
- Data model: `docs/data-model.md`
- Coding standards: `clean-code.md`
- Skills: `.claude/skills/`
- Conventions (to come): `docs/conventions/`
- Decisions log (to come): `docs/decisions/`
