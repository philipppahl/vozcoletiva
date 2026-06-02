# 0028 — Real-time delivery: WebSockets + stream-driven push fan-out

**Status:** accepted
**Date:** 2026-06-02
**Builds on:** 0020/0021 (messaging + inbox), 0025 (Web Push — completes Phase B),
0026 (optimistic updates), 0027 (polling, now the fallback)

## Context

Chat had no real-time transport. Decision 0027 added short-interval polling as a
stopgap so an open conversation updated within a few seconds. We wanted true
live delivery while the app is open, and push when it's closed — the two halves
the polling stopgap and Web Push Phase A respectively pointed at.

## Decision

One backbone feeds both transports: a **DynamoDB stream** (NEW_IMAGE) on the
single table, consumed by a `voz-realtime` Lambda.

```
mutation writes MESSAGE / INBOX# item
        │ DynamoDB stream (NEW_IMAGE, INSERT-filtered)
        ▼
   voz-realtime
     ├─ Message insert  → resolve audience → PostToConnection to open sockets   [WebSocket]
     │                    └─ DM? → Web Push the peer (direct_message pref)
     └─ InboxItem insert → Web Push the recipient (per-kind pref)                [Web Push]
```

### WebSocket transport

- **API Gateway v2 WebSocket API** (`$connect` / `$disconnect` / `$default`)
  backed by a `voz-ws` Lambda. A **REQUEST Lambda authorizer** (reusing
  `JwtVerifier`) verifies the Cognito **access token** passed as `?token=` on the
  handshake — browsers can't set headers on a WS upgrade. Identity source is the
  querystring token.
- **Connection registry** (`repo::connection`): two directional items per socket
  — `CONN#<id>/META` (→ owner) and `USER#<uid>/CONN#<id>` (a user's sockets, for
  fan-out) — each with a `ttl` backstop. `$disconnect` removes both; the
  broadcaster prunes a 410-Gone socket.
- **Thin signal, not the DTO.** A broadcast carries
  `{ type:"message.created", conversationId, parentMessageId }`. The client
  invalidates the affected React Query keys and refetches through the same REST
  endpoints it already uses, and the 0026 optimistic-merge dedup reconciles. No
  message DTO travels over the WS, so the surface stays decoupled (this is the
  same shape the mock `useMessageBusBridge` used).
- **FE client** (`lib/realtime.ts`): one socket while signed in, capped-backoff
  reconnect with a refreshed token, transparent re-open after API Gateway's
  ~10-min idle close. When the socket is up, chat polling backs off to a slow
  safety net (20 s / 30 s) and snaps back to 4 s / 8 s when it drops — so polling
  is a fallback, not the steady-state cost. Dormant when `VITE_WS_URL` is unset.

### Web Push transport (completes 0025 Phase B)

- `push_send`: RFC 8291 (aes128gcm) encryption + VAPID via **`web-push-native`**
  (pure-Rust — RustCrypto + `superboring`, no C toolchain, cross-compiles to
  arm64), POSTed with reqwest. VAPID private key read from SSM SecureString at
  cold start; 404/410 prunes the dead subscription.
- **Who gets pushed:** inbox items push their recipient (per-kind pref — the
  existing mention / reply / comment-on-yours / proposal-closed / document-amended
  switches). **DMs aren't inbox items**, so a new **`direct_message`** preference
  gates a direct DM push to the peer. Channel messages never push per-message —
  only via their inbox items (mention / reply). Calm notifications preserved.

## Why this shape

- **Stream-driven, not inline.** Delivery runs after the write commits, off the
  request path, so posting stays fast and a delivery failure can't fail the
  user's action (best-effort: logged, never a poison batch).
- **One consumer, two transports.** WS for liveness while open, push for reach
  while closed — they share the stream + audience resolution.
- **Cost.** At a handful of users this is pennies/month; a long-lived idle socket
  is cheaper than the 0027 polling it largely replaces (REST polling every 4 s).
  DynamoDB-stream reads by a Lambda trigger aren't billed; Web Push to FCM/Apple
  is free.

## New push trigger: `direct_message`

CLAUDE.md requires justifying a new push trigger. A DM is a one-to-one message
explicitly addressed to the recipient — inherently relevant and expected to
notify, the way every messaging app does. Default on, individually
off-switchable in Preferences. It does not widen channel noise (channels stay
inbox-gated).

## Trade-offs / risks

- **Token in the query string.** It lands in API-GW access logs; mitigated by
  short-lived access tokens and not logging the querystring. Acceptable for now.
- **Idle close + reconnect churn.** Quiet sockets idle-close at ~10 min and
  reconnect; the slow polling fallback covers the gap.
- **Server-side push copy is EN-only.** The notification body carries the actual
  content; localising the title needs a stored locale (follow-up), like the
  lib-level toasts.
- **Cold-start JWKS skipped** for the consumer (`AppState::for_stream` +
  `JwtVerifier::offline`) so push/broadcast don't depend on Cognito.

## Out of scope (later)

Live vote-tally / proposal broadcasts on the same transport (a fast-follow —
the consumer already has the hook), typing indicators, presence, read receipts,
suppressing push when the recipient is actively connected, and generating
`openapi.yaml` from the handlers (still hand-maintained).

## References

- Backend: `apps/api/src/bin/ws.rs`, `src/bin/realtime.rs`, `src/realtime.rs`,
  `src/push_send.rs`, `src/repo/connection.rs`, `src/repo/push.rs`,
  `src/state.rs` (`for_stream`), `src/auth/jwt.rs` (`offline`).
- Infra: `apps/infra/lib/constructs/realtime.ts`, `data-table.ts` (stream),
  `voz-stack.ts` (WsUrl), `scripts/deploy.ts` (VITE_WS_URL).
- FE: `apps/web/src/lib/realtime.ts`, `lib/messages.ts` (poll fallback),
  `routes/__root.tsx`, `routes/preferences.tsx`.
- Decisions 0021, 0025, 0026, 0027.
