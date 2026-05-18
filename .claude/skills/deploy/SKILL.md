---
name: deploy
description: Deploy the application via the `deploy --env <name>` script with safety guards. Refuses production deploys outside GitHub Actions; refuses on dirty trees or off `main`. Use for any deploy action.
---

# deploy

The only sanctioned way to deploy the application. Wraps the project's `deploy --env <name>` script and enforces the deployment policy.

## Allowed environments

- **`dev`** — locally deployable by any developer with the appropriate AWS profile.
- **`prod`** — deployable **only** from inside GitHub Actions. The skill refuses local prod deploys.

## Guards (in order)

Before invoking the underlying script, verify:

1. **Branch**: working tree is on `main`. If not, refuse and explain.
2. **Cleanliness**: working tree is clean (`git status --porcelain` empty). If not, refuse.
3. **Checks passing**: a recent successful `run-checks` and `run-tests --mode full` in the current shell, OR an explicit user override. If no record, prompt and surface the risk.
4. **Environment**:
   - `--env dev`: proceed.
   - `--env prod`:
     - If `GITHUB_ACTIONS=true` is set: proceed.
     - Else: **refuse**. Point at the CI workflow as the proper path.
     - **Break-glass**: if `VOZ_FORCE_PROD_DEPLOY=1` is set, proceed — but surface a loud "BREAK-GLASS PROD DEPLOY — log this to the audit trail" warning and require explicit re-confirmation by typing the env name.

## Dry-run

`--dry-run` passes through to the underlying `deploy` script, which forwards it to CDK (`cdk diff`). Produces a change preview without applying.

## Confirmation prompts

- `--env dev` (local): one-line `deploying dev — proceed? [y/N]`; default no.
- `--env prod` (in CI): no interactive prompt; the GH Actions workflow run is the explicit consent.
- `--env prod` (break-glass): multi-line warning + explicit `type the env name to confirm` prompt.

## Prerequisites

- `bun` installed.
- AWS profile configured (`AWS_PROFILE` set) for the target env.
- The `deploy --env <name>` script exists at `apps/infra/scripts/deploy` *(to be authored when `apps/infra/` lands)*. Until that script exists, this skill refuses with a "deploy script not yet authored" notice.

## Output

- A summary of the changes deployed (CDK diff output).
- A link to the relevant CloudFormation stack in the AWS console for the env.
- A suggested one-line entry for `docs/decisions/` if the deploy includes a notable architectural change.

## Cross-references

- `docs/conventions/ci.md` § *Deployment gates* — the full policy this skill enforces.
- `CLAUDE.md` § *Hard prohibitions* — "never `cdk deploy` directly", "never deploy prod from a developer machine".
- `run-checks`, `run-tests` — prerequisite skills usually run immediately before this.
