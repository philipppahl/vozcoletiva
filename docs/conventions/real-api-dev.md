# Running the web app against the real dev API

By default `bun run dev` uses the MSW mock layer (`VITE_USE_MOCKS=1`). To run
against the **real `voz-dev` backend** instead — with real Cognito auth and real
data — use real-API mode. Messages / DMs / inbox / search keep mock data (no
backend yet); everything else is real. See `docs/decisions/0016`.

## One-time

The new Lambda must be deployed and the demo users + data must exist.

```bash
# 1. Deploy the backend (also rebuilds + ships the web bundle to CloudFront).
bun apps/infra/scripts/deploy.ts --env dev

# 2. Create the 5 demo Cognito users (idempotent — skips existing).
#    Pool: eu-west-1_UtykCiLhC   Password: Vozcoletiva!2026
for u in "marina@example.com|Marina Alves" "tomas@example.com|Tomás Ferreira" \
         "lucia@example.com|Lúcia Pereira" "rafael@example.com|Rafael Costa" \
         "sofia@example.com|Sofia Martins"; do
  email=${u%%|*}; name=${u##*|}
  aws cognito-idp admin-create-user --user-pool-id eu-west-1_UtykCiLhC --region eu-west-1 \
    --username "$email" --message-action SUPPRESS \
    --user-attributes Name=email,Value="$email" Name=email_verified,Value=true Name=name,Value="$name" 2>/dev/null
  aws cognito-idp admin-set-user-password --user-pool-id eu-west-1_UtykCiLhC --region eu-west-1 \
    --username "$email" --password 'Vozcoletiva!2026' --permanent
done

# 3. Seed data through the API (wipes the dev table, then recreates everything).
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
