# 0025 — Web Push (VAPID) + notification preferences

**Status:** phase A + phase B accepted + shipped. Phase B (delivery) was built as
part of the realtime stream consumer — see decision **0028** for the as-built
design (the push fan-out shares the WebSocket consumer rather than a standalone
`voz-push` Lambda, and adds a `direct_message` trigger for DMs).
**Date:** 2026-05-31
**Updated:** 2026-06-02 (phase B shipped via 0028)
**Builds on:** 0021 (inbox fan-out), 0024 (go no-mock → persistent SW)

## Context

The inbox is the always-on record; Web Push is the opt-in interruption layer on
top. Push needs a persistent service worker — unblocked by 0024 (the app is now
fully real, so the real SW ships).

## Design

Two phases. Push **delivery** is decoupled from the request path via a DynamoDB
Stream, so a trigger never blocks on sending.

```
trigger ─> notify (writes INBOX# items)        [0021]
                │ DynamoDB Stream (INSERT, SK begins INBOX#)
                ▼
        voz-push Lambda ─> recipient subs + prefs ─> VAPID Web Push   [phase B]
                              └─ prune 404/410 subscriptions
```

## Phase A — opt-in + preferences (SHIPPED + VERIFIED)

- **VAPID** keypair generated once. Public key baked into the bundle
  (`VITE_VAPID_PUBLIC_KEY`, per-env constant in `deploy.ts`). Private key in
  **SSM SecureString** `/voz/<env>/vapid-private-key` — never in git.
- **Service worker** (`src/sw.ts`) via `vite-plugin-pwa` `injectManifest`:
  Workbox precache (dep: `workbox-precaching`) + `push` (showNotification) +
  `notificationclick` (deep-link). No `fetch` handler beyond precache.
- **Subscriptions**: `POST /v1/me/push-subscriptions`,
  `POST /v1/me/push-subscriptions/remove` → `USER#/PUSHSUB#<endpoint>` (upsert).
- **Preferences**: `GET/PUT /v1/me/notification-prefs` → one settings item
  (`pushEnabled` master + per-kind). `NotificationPrefs::allows(kind)` gates
  push; the **inbox is always written** regardless.
- **FE**: `lib/push.ts` (enable/disable, live subscription state, prefs hooks);
  a Notifications section in Preferences (enable toggle + per-kind toggles),
  hidden when push is unsupported. EN + PT strings.
- **Verified** (deployed dev): the Notifications UI renders, `pushSupported()`
  true, the real `sw.js` controls the page, and all four endpoints return
  correctly (prefs default + roundtrip, subscribe 201, remove 200). The browser
  `PushManager.subscribe` (permission + a real push service) needs a device — not
  verifiable in headless CI. Backend covered by `tests/push_it.rs`.

## Phase B — delivery (SPECIFIED, NEXT)

- Enable a DynamoDB Stream (NEW_IMAGE) on the table; a new `voz-push` Rust bin on
  an event-source mapping **filtered** to `INSERT` + `SK begins_with INBOX#`.
- The Lambda reads the recipient's `PUSHSUB#` subs + `NOTIFPREF`, and for each
  allowed kind sends a VAPID/RFC-8291 push; prunes subs that return 404/410.
- **Open implementation decision (the gating risk):** the encryption + VAPID
  signing. Options, in order of preference:
  1. `web-push-native` (RFC 8291 ece + VAPID header) + `reqwest` (already a dep,
     rustls) for the HTTP POST — avoids `isahc`/`curl`/`openssl`, so it
     cross-compiles cleanly to the arm64 Lambda via cargo-lambda.
  2. `web-push` 0.11 — fuller, but its default HTTP client (`isahc`/libcurl) is
     painful to cross-compile; only viable if a hyper/rustls feature works.
  3. Hand-rolled (jsonwebtoken ES256 + `p256`/`hkdf`/`aes-gcm`) — most control,
     most correctness risk.
  Validate the chosen path **cross-compiles** (`cargo lambda build --arm64`)
  before wiring the rest — this is the main unknown.
- CDK: the Lambda + stream + filtered mapping + SSM read grant; `deploy.ts`
  builds the 3rd bin.
- **Verification ceiling:** real push receipt isn't reproducible in headless CI;
  verify the Lambda fires on an inbox insert and the send is **accepted by the
  push service** (a 201 from FCM), plus dead-sub pruning. Final receipt needs a
  real device.

## Out of scope

Per-project mute + quiet hours (`NOTIFPREF#<projectId>#<eventType>`), email
fallback (SES), digest/batching, DM notifications, and a prod VAPID keypair
(generated before prod push ships).

## References

- `apps/api/src/repo/push.rs`, `handlers/push.rs`, `tests/push_it.rs`
- `apps/web/src/sw.ts`, `lib/push.ts`, `routes/preferences.tsx`,
  `vite.config.ts`; `apps/infra/scripts/deploy.ts`
- Decisions 0021, 0024.
