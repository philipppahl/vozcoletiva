# Running the web app against the real dev API

By default `bun run dev` uses the MSW mock layer (`VITE_USE_MOCKS=1`). To run
against the **real `voz-dev` backend** instead. As of decision **0024 the whole
app is real — there are no mocks** in deployed builds (dev + prod); every surface
(incl. search, 0023) has a backend. `VITE_MOCK_COMMS` is retired. A full-offline
mock mode (`VITE_USE_MOCKS=1`) remains only as a local-dev convenience.

## One-time

The new Lambda must be deployed and the demo users + data must exist.

```bash
# 1. Deploy the backend (also rebuilds + ships the web bundle to CloudFront).
bun apps/infra/scripts/deploy.ts --env dev

# 2. Create the 5 demo Cognito users (idempotent — skips existing).
#    Pool: eu-west-1_UtykCiLhC. The demo password is NOT in git (public repo) —
#    it lives in the gitignored root .env.local as VOZ_SEED_PASSWORD.
#    Cognito is auth-only (decision 0019) — display names are set by the seed via
#    PATCH /v1/me, not the Cognito `name` attribute.
source .env.local  # exports VOZ_SEED_PASSWORD
for email in marina@example.com tomas@example.com lucia@example.com \
             rafael@example.com sofia@example.com; do
  aws cognito-idp admin-create-user --user-pool-id eu-west-1_UtykCiLhC --region eu-west-1 \
    --username "$email" --message-action SUPPRESS \
    --user-attributes Name=email,Value="$email" Name=email_verified,Value=true 2>/dev/null
  aws cognito-idp admin-set-user-password --user-pool-id eu-west-1_UtykCiLhC --region eu-west-1 \
    --username "$email" --password "$VOZ_SEED_PASSWORD" --permanent
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

Then `bun run dev` and sign in as `marina@example.com` (password =
`VOZ_SEED_PASSWORD` from the gitignored root `.env.local`).
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

## Web Push (decision 0025)

- **VAPID keys**: the **public** key is a per-env constant in
  `apps/infra/scripts/deploy.ts` (`VAPID_PUBLIC_KEY`) and is baked into the
  bundle as `VITE_VAPID_PUBLIC_KEY` (public, safe in git). The **private** key
  lives in SSM SecureString `/voz/<env>/vapid-private-key` — **never commit it**.
  Generate a pair with `bunx web-push generate-vapid-keys --json`; store the
  private half with `aws ssm put-parameter --type SecureString`.
- **Local dev**: add `VITE_VAPID_PUBLIC_KEY=<dev public key>` to
  `apps/web/.env.development.local` to exercise the opt-in flow locally.
- Push only works against a **persistent** service worker — i.e. a no-mock build
  (the deployed dev/prod app). Full-offline mock mode self-destroys the SW, so
  push is unavailable there.
- **Delivery is shipped** (decision 0028, completing 0025 Phase B): the
  `voz-realtime` Lambda consumes the table's DynamoDB stream and sends Web Push
  for inbox items + DMs. It reads the VAPID private key from
  `/voz/<env>/vapid-private-key` at cold start, so that SSM param **must exist**
  before push works (the IAM grant is scoped to it). If it's missing the Lambda
  logs `vapid_unavailable` and push is skipped — WS broadcast still works.

## Real-time WebSocket (decision 0028)

- The deploy injects `VITE_WS_URL` (the `wss://…` stage URL, stack output
  `WsUrl`) into `.env.production`. **Chicken-and-egg:** the first deploy that
  *creates* the WS API can't bake the URL into that same build, so the FE stays
  on polling until the **next** deploy. The FE tolerates an empty `VITE_WS_URL`.
- Local dev: set `VITE_WS_URL=wss://di0lqitjnj.execute-api.eu-west-1.amazonaws.com/v1`
  in `.env.development.local` to exercise live delivery against dev.
- The socket authenticates with the Cognito **access token** as `?token=` on the
  handshake. After deploying realtime changes, clear the stale SW + caches and
  reload (live connections only pick up the new bundle on reload).
- Inspect live state: connection rows are `CONN#<id>/META` +
  `USER#<uid>/CONN#<id>`; the realtime Lambda logs `ws_broadcast` / `push_sent`
  (counts only — never message bodies).
