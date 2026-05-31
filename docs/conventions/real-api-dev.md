# Running the web app against the real dev API

By default `bun run dev` uses the MSW mock layer (`VITE_USE_MOCKS=1`). To run
against the **real `voz-dev` backend** instead — with real Cognito auth and real
data — use real-API mode. Projects, proposals, votes, documents, categories,
comments, **all messaging (channels, DMs, threads, reads), and the inbox** are
real; only **search** keeps mock data (no backend yet). See `docs/decisions/0016`
(hybrid), `0018` (messages), `0020` (DMs), `0021` (inbox).

## One-time

The new Lambda must be deployed and the demo users + data must exist.

```bash
# 1. Deploy the backend (also rebuilds + ships the web bundle to CloudFront).
bun apps/infra/scripts/deploy.ts --env dev

# 2. Create the 5 demo Cognito users (idempotent — skips existing).
#    Pool: eu-west-1_UtykCiLhC   Password: Vozcoletiva!2026
#    Cognito is auth-only (decision 0019) — display names are set by the seed via
#    PATCH /v1/me, not the Cognito `name` attribute.
for email in marina@example.com tomas@example.com lucia@example.com \
             rafael@example.com sofia@example.com; do
  aws cognito-idp admin-create-user --user-pool-id eu-west-1_UtykCiLhC --region eu-west-1 \
    --username "$email" --message-action SUPPRESS \
    --user-attributes Name=email,Value="$email" Name=email_verified,Value=true 2>/dev/null
  aws cognito-idp admin-set-user-password --user-pool-id eu-west-1_UtykCiLhC --region eu-west-1 \
    --username "$email" --password 'Vozcoletiva!2026' --permanent
done

# 3. Seed data through the API (wipes the dev table, then recreates everything,
#    incl. each project's default Commons channel with seeded messages + a thread).
bun apps/web/scripts/seed-dev.ts
```

## Local real-API dev

Create `apps/web/.env.development.local` (gitignored — overrides `.env.development`):

```
VITE_USE_MOCKS=0
VITE_MOCK_COMMS=1
VITE_API_BASE_URL=https://cch3zqvos9.execute-api.eu-west-1.amazonaws.com/v1
VITE_USER_POOL_ID=eu-west-1_UtykCiLhC
VITE_USER_POOL_CLIENT_ID=uck6d99i1quu8r6qmns6s9ppf
VITE_AWS_REGION=eu-west-1
```

Then `bun run dev` and sign in as `marina@example.com` / `Vozcoletiva!2026`.
Delete the file to return to full-mock mode.

## Reset the data

Re-run `bun apps/web/scripts/seed-dev.ts` — it wipes the table and reseeds.

## Notes

- Auth is real Cognito **SRP**; the api-client sends the **access** token.
- The hosted dev CloudFront runs the same hybrid (the deploy injects
  `VITE_MOCK_COMMS=1` into `.env.production` for `--env dev` only).
- Prod never ships mocks — `VITE_MOCK_COMMS` is unset for prod and the branch is
  dead-code-eliminated; the deploy script also scans the prod bundle for MSW
  residue.
- The comms-mock is retired for messaging **and the inbox** — channels, DMs,
  threads, reads, and notifications are all real (0020, 0021). Only **search** is
  still mocked (served by the hybrid worker). Full-mock mode (`VITE_USE_MOCKS=1`)
  no longer serves messaging or the inbox; the maintained dev path is hybrid +
  real API.
- **Stale client state**: a leftover full-mock session or an expired access
  token can leave the projects/messages lists looking empty. The self-destroying
  SW heals on a fresh load; if not, clear site data for the CloudFront origin and
  sign in again. The API auth expects the **access** token (the **id** token
  fails with `missing field client_id`).
- **Display names** live in the backend profile (Cognito is auth-only). The seed
  sets them via `PATCH /v1/me` before creating data; the FE reads the canonical
  name from `GET /v1/me` and users can edit it in Preferences. See `0019`.
