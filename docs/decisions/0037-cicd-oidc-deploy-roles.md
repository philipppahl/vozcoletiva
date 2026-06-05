# 0037 — CI/CD: GitHub Actions OIDC deploy roles

Status: accepted · 2026-06-05 · part of the CI/CD + prod rollout (Phase 2)

## Context

The deploy workflow (`.github/workflows/deploy.yml`) was written to deploy `dev`
then `prod` on every push to `main`, assuming an AWS role per environment via
`secrets.AWS_DEPLOY_ROLE_{DEV,PROD}`. Those secrets didn't exist, so the deploy
job failed at the credentials step (safely — it can't reach AWS). The GitHub
OIDC provider (`token.actions.githubusercontent.com`) already exists in the
account; what was missing were the IAM roles and the secrets holding their ARNs.

## Decision

A dedicated **`voz-cicd`** stack (`apps/infra/lib/cicd-stack.ts`) creates two IAM
roles — `vozcoletiva-deploy-dev` and `vozcoletiva-deploy-prod`.

### Trust (who may assume)

Each role trusts the existing GitHub OIDC provider, scoped with `StringEquals` on:
- `…:aud = sts.amazonaws.com`
- `…:sub = repo:philipppahl/vozcoletiva:environment:<env>`

Both deploy jobs run under a GitHub **Environment** (`environment: dev` /
`environment: prod`), so the token's `sub` is the environment form — the dev role
can only be assumed by the dev job, the prod role only by the prod job. The
`prod` GitHub Environment additionally restricts deployable branches to `main`.

### Permissions (what it may do) — minimal OIDC role

Each role's *only* permission is `sts:AssumeRole` on this account's CDK bootstrap
roles, by ARN pattern `cdk-hnb659fds-*-role-<account>-<region>` for the regions
our stacks span (`eu-west-1` app + `us-east-1` cert). CDK deploys by assuming
those bootstrap roles, so this is all the OIDC role needs.

This is **least-privilege at the GitHub-exposed surface**: a leaked OIDC token
can only kick off a `cdk deploy` for this account — it can't touch anything else.
We deliberately did *not* switch to `CliCredentialsStackSynthesizer` + hand-rolled
per-service policies (more fragile, would disturb the working dev deploy).

### Deploying the stack

`voz-cicd` is account-level and a bootstrap dependency (CI can't create the very
roles that grant CI access), so it's deployed **once, manually, with admin creds**:

```
bun run deploy --cicd          # cdk deploy voz-cicd (pure IAM — no Lambda/web build)
bun run deploy --cicd --dry-run
```

`bin/voz.ts` builds only the `voz-cicd` stack when `VOZ_TARGET=cicd`, else the
per-env app stacks as before.

## Follow-ups (explicit non-goals here)

- **Harden the CDK cfn-exec role** (scoped policy via re-bootstrap) and **separate
  dev/prod at the resource level** — the bootstrap roles are shared, so today the
  dev and prod OIDC roles can assume the same CDK roles; separation is enforced by
  the GitHub Environments, not IAM. Worth tightening later.
- **Workstream C/D/E** (same rollout): set the `AWS_DEPLOY_ROLE_*` GitHub secrets +
  create the `prod` Environment; stand up the `voz-prod` stack + prod VAPID key;
  apex + `www` → prod; branch protection on `main`.

## Consequences

- After `deploy --cicd` runs and the two GitHub secrets are set, pushes to `main`
  can deploy via OIDC with no long-lived AWS keys anywhere.
- A new account-level `voz-cicd` CloudFormation stack exists.
