# 0024 — Retire the mock layer for deployed builds (go fully real)

**Status:** accepted
**Date:** 2026-05-31
**Builds on:** 0016 (comms-hybrid), 0020/0021/0023 (last mock surfaces retired)

## Context

With search real (0023), **every** surface now has a backend. The dev site ran
the "comms-hybrid" (`VITE_MOCK_COMMS=1`): MSW's service worker intercepted the
last mock endpoints and bypassed the rest to the real API. That hybrid forced a
**self-destroying** PWA service worker (MSW's worker can't coexist with a
Workbox SW on the same scope) — which blocks Web Push, since push needs **our**
persistent service worker to be the scope controller.

## Decision

Deployed builds (dev **and** prod) run **fully real — no mocks**. The
comms-hybrid is retired:

- `deploy.ts` no longer writes `VITE_MOCK_COMMS=1` for dev; both `VITE_USE_MOCKS`
  and `VITE_MOCK_COMMS` are off.
- `main.tsx` drops the `VITE_MOCK_COMMS` startup branch; `startCommsMocks` is
  removed.
- `vite.config.ts` `selfDestroying` now keys only on `VITE_USE_MOCKS` → the
  deployed app ships the **real, persistent Workbox service worker** (which
  Web Push then extends — see 0025).

**Full-offline mock mode** (`VITE_USE_MOCKS=1`) stays as a local-dev convenience
(MSW serves everything, self-destroying SW). It is degraded — messaging + inbox
were retired from it in 0020/0021 — and is not a supported deployed path.

## Consequences

- Push is now testable on the dev site (no SW conflict).
- Returning visitors transition from the self-destroying SW to the real SW on
  next load (the self-destroyer unregisters itself first).
- `VITE_MOCK_COMMS` is dead; any leftover in a local `.env.*.local` is a no-op.

## References

- `apps/infra/scripts/deploy.ts`, `apps/web/src/main.tsx`,
  `apps/web/src/mocks/browser.ts`, `apps/web/vite.config.ts`
