# Mocks — how the dev mock layer works

The web app ships a development-only mock layer built on **MSW (Mock Service Worker)**. Switched on, MSW intercepts every `fetch` the FE makes, satisfies it from an in-memory data store, and returns shapes that match the OpenAPI spec. The rest of the app — routes, components, TanStack Query, auth store — runs unchanged.

Use mocks when:

- Iterating on UI before a feature has a backend.
- Verifying a screen in dozens of states (empty / loaded / closed / passed / etc.) deterministically.
- Working offline.

Use the real `voz-dev` backend when:

- Wiring a new endpoint or testing a wire-level contract change.
- Verifying push notifications, scheduled actions (EventBridge), or anything that crosses our own AWS surface.
- Pre-PR sanity checks.

## Turning mocks on / off

Mock mode is purely a build-time choice driven by `VITE_USE_MOCKS`.

- **On**: `VITE_USE_MOCKS=1` (the committed default in `apps/web/.env.development`).
- **Off**: `VITE_USE_MOCKS=0` or unset.

`.env.local` (per-developer, gitignored) wins over `.env.development`. To hit the real backend, set `VITE_USE_MOCKS=0` in `.env.local` and provide the real `VITE_API_BASE_URL`, `VITE_USER_POOL_ID`, `VITE_USER_POOL_CLIENT_ID`, `VITE_AWS_REGION`.

The deploy script (`apps/infra/scripts/deploy.ts`) refuses any `--env prod` build with `VITE_USE_MOCKS` set, and grep-scans the prod `dist/` for MSW residue as a belt-and-braces guard.

## What's mocked

Every endpoint the FE calls today:

- `GET /v1/hello`
- `GET /v1/me` (+ the `?display_name=…` profile seed)
- `GET /v1/projects`, `POST /v1/projects`, `GET /v1/projects/{slug}`
- `GET /v1/projects/{slug}/members`
- `GET/POST /v1/projects/{slug}/invites`, `DELETE …/invites/{id}`
- `GET /v1/invites/{token}`, `POST /v1/invites/{token}/accept`
- `GET /v1/invites/by-code/{code}`, `POST /v1/invites/by-code/{code}/accept`
- `GET/POST /v1/projects/{slug}/proposals`, `GET /v1/projects/{slug}/proposals/{id}`, `POST …/withdraw`
- `POST/DELETE /v1/projects/{slug}/proposals/{id}/vote`
- `GET/POST /v1/projects/{slug}/proposals/{id}/comments`, `PATCH/DELETE …/comments/{commentId}`

Plus a fake Cognito (`src/mocks/auth.ts`) so `signIn` / `signUp` / `confirmSignUp` work without hitting AWS. Any non-empty password signs in the seeded user matching the email; signing in with an unknown email creates an ad-hoc guest user.

## Scenarios

The mock layer ships with a `ScenarioPicker` mounted inside the Preferences page (only when mock mode is on). Each scenario is a `(identityKey, clockOffsetDays)` pair defined in `src/mocks/scenarios.ts`. Picking one:

1. Resets the in-memory db with the seeded fixtures (`src/mocks/seed.ts`).
2. Sets the mock-side clock to `now + clockOffsetDays`.
3. Clears the client auth + query cache and navigates home.

Mocked writes (votes, comments, proposals, invites you cast/post/issue/revoke) persist for the **current session only**. A reload or a scenario switch resets to the seed.

## How to add a fixture

Edit `src/mocks/seed.ts`. Add an entity to whichever Map / array fits. The shapes are typed against `MockUser` / `MockProject` / etc. in `src/mocks/db.ts`. Tests in `tests/mocks-db.test.ts` will fail if the seed doesn't compile or the assertions diverge — keep them in sync.

For a one-off scenario, add a `Scenario` to `SCENARIOS` in `src/mocks/scenarios.ts`. Keep them short; pile more in only when you actually want to verify a distinct shape.

## How to add a handler

When a new endpoint is added to the OpenAPI spec:

1. Add the handler under `src/mocks/handlers/<resource>.ts`. Use the `components['schemas'][...]` types from `@vozcoletiva/api-client/generated/schema` so it's type-checked against the contract.
2. Register the handler in `src/mocks/handlers/index.ts`.
3. If the endpoint writes state, mutate the in-memory `getDb()` directly. Don't call other handlers internally.
4. Add a smoke test asserting the round-trip if it's anything more than a passthrough.

Pattern shortcuts:

- `requireCurrentUser()` — returns the signed-in `MockUser` or null; reply 401 if null.
- `requireMember(slug, userId)` — returns `{ project, role }` or null; reply 403 if null.
- `toProposalDto(p, viewerId)` — converts a `MockProposal` to the wire shape (with `your_choice`).

## Clock control

Handlers that care about time use `mockNow()` from `src/mocks/clock.ts`. Client code keeps using `Date.now()` — only **server-side data** is clock-shifted. The `autoCloseDuePoll()` helper in `_helpers.ts` runs the same close logic the real worker would, deterministically driven by the offset.

## Simulated real-time

Chat needs to feel live. `src/mocks/messageBus.ts` is an in-process pub/sub that handlers `emit` on after every write, and the FE subscribes to (`useMessageBusBridge` in `src/lib/messages.ts`) to invalidate the relevant TanStack Query caches.

Auto-emit (synthetic "incoming" messages from seeded users on a timer) is **off by default**. The "Busy channels" scenario in the picker turns it on, useful for showing the chat surface live during demos. When the real backend lands, the bus consumer is replaced with a real `wss://...` client; handlers stop emitting (the BE does it on commit instead). The bus stays as a test double.

Caveat: the auto-emit interval is wall-clock, not mock-clock, so it ignores scenario clock offsets. Acceptable for demos; we don't try to make synthetic chat respect scenario time.

## Caveats

- The mock layer ignores the `Authorization` header. Tokens are opaque strings; the in-memory `currentUserId` is the source of truth.
- No retry / refresh paths exercised. Real Cognito's 401-refresh-retry path is bypassed.
- No PWA precache interaction. `mockServiceWorker.js` is served fresh from `/public/`; Workbox precache must not include it (already excluded).
- Service workers can be sticky: if the picker stops responding, open DevTools → Application → Service Workers → Unregister, then reload.

## When to retire a mock

When the real backend implementation lands for an endpoint, the mock handler stays — it's still useful for offline iteration and tests. The handler should be kept aligned with the real OpenAPI spec (and `bun run api:generate` enforces this on the client-types side; the mock handlers consume those types).

The decision to delete the entire mock layer comes only when (a) every endpoint is wired to a real BE, and (b) we no longer want offline iteration. We're nowhere near that today.
