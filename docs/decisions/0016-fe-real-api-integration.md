# 0016 — Web app cut over to the real API (comms stay mocked)

**Status:** accepted
**Date:** 2026-05-31
**Builds on:** 0010–0015 (the Rust backend slices)

## Context

The backend now implements the full proposal/decision/document/category surface
(slices A–C/B2). Time to run the web app against the **real dev API** with real
Cognito auth and real data, instead of MSW. But four surfaces — **messages,
DMs, inbox, search** — have no backend yet.

## Decision

- **Real API for everything that has a backend**; **mock data for the comms
  surfaces** (messages / DMs / inbox / search) via a hybrid MSW.
  - `VITE_USE_MOCKS=0` + `VITE_MOCK_COMMS=1`: `startCommsMocks()` registers MSW
    with **only** the conversations/inbox/search handlers and seeds the mock db;
    `onUnhandledRequest: 'bypass'` sends every other `/v1` request to the real
    API. The demo mock project slug (`vila-madalena`) matches the seed, so the
    Messages tab + bell + unread badges stay populated.
  - Prod builds leave `VITE_MOCK_COMMS` unset → the mock branch is
    dead-code-eliminated (prod stays MSW-free; the deploy guard still scans).
- **Auth** is real Cognito SRP (`amazon-cognito-identity-js`); the api-client
  attaches the **access token** + refreshes on expiry.
- **Seeding** (`apps/web/scripts/seed-dev.ts`): real `AdminCreateUser` users,
  SRP login, all data created through the **public API**, worker Lambda invoked
  to close deliberations. No backdoor writes.
- **Dev deploy** writes `VITE_MOCK_COMMS=1` into the generated
  `.env.production` so the hosted dev CloudFront runs the same hybrid.

## Integration fixes found by browser testing

- **api-client drift** (`3826bc2`): the mock layer + a few readers still used the
  old proposal shape (`VotingMode`, `tally_yes/no`, `your_root_choice`) after the
  A–C/B2 OpenAPI regen — broke `tsc`/build. Aligned to the new contract;
  `ExtendedProposal` is now a straight api-client alias.
- **mock-fetch libs** (`ebc2d7e`): `lib/documents.ts` + `lib/categories.ts` still
  used a `mockGet`/`mockJson` helper hitting the relative `/v1` path with a fake
  `Bearer mock` token — empty Documents/Topics pages against the real API. Routed
  through the real `apiClient`.

## Verified in-browser (real API, mobile 390×844 + desktop, light + dark)

Sign-in (Cognito SRP) · projects list (roles) · project overview (decisions,
multi-option with winning option, forks, document versions, passed/voting) ·
proposal detail · **live vote write** (persisted server-side) · **compose →
create write** · documents list + detail (v1/v2 + content + amendment) · topic
filter chips · preferences (real profile) · messages/DMs/bell (mock hybrid).
Console clean throughout.

## Out of scope / next

Backends for messages, DMs, inbox, search (each its own slice) — until then they
stay on mock data. PWA-install verification on the hosted site.

## References

- `apps/web/src/mocks/browser.ts` (`startCommsMocks`), `src/main.tsx`
- `apps/web/scripts/seed-dev.ts`, `apps/infra/scripts/deploy.ts`
- `docs/conventions/real-api-dev.md` (runbook)
