# 0035 — Per-device push notification preferences

Status: accepted · 2026-06-05 · supersedes the account-level prefs of 0028

## Context

Push event preferences (which kinds push) lived in one account row
(`USER#<uid>/NOTIFPREF/SETTINGS`), so every device shared them — you couldn't be
loud on your phone and quiet on your desktop. Separately, the UI's "subscribed"
state read only the browser's local `PushManager`, never reconciled with the
server, so a failed registration / a server-side prune left a device that
*looked* subscribed but received nothing.

## Decision

**Move the per-kind prefs onto each subscription.** Each
`USER#<uid>/PUSHSUB#<endpoint>` item carries the six kind booleans (`mention,
reply, comment_on_yours, proposal_closed, document_amended, direct_message`). A
subscription's *existence* = "push on" for that device (on/off is
subscribe/unsubscribe — no separate flag). The account `NOTIFPREF/SETTINGS` row
and `push_enabled` field are **removed**.

- **Delivery:** the realtime Lambda fans out over the user's subscriptions and
  checks **each subscription's** prefs (`sub.allows(kind)`); the DM + inbox paths
  no longer pre-check one account pref. Dead subs still pruned on `404/410`; a
  `skipped` counter is logged.
- **New device default:** all-on (a fresh `subscribe` with no `prefs`).
- **Endpoint = device key.** If a browser's push endpoint rotates it's a new
  subscription with default prefs (acceptable).

### API

- `POST /me/push-subscriptions` — body gains optional `prefs`; returns the
  `PushSubscriptionView` (endpoint + prefs + created_at).
- `GET /me/push-subscriptions` — **new** — list the caller's subs with prefs, so
  the settings screen can find *this* device by its local endpoint.
- `PUT /me/push-subscriptions/prefs` — **new** — `{ endpoint, prefs }` sets one
  device's prefs (`404` if the endpoint isn't registered).
- `GET/PUT /me/notification-prefs` — **removed**.

### Frontend

The Notifications screen edits **this device's** prefs (`useDevicePrefs` /
`useUpdateDevicePrefs`), resolving the local endpoint and reading the server's
subscription list. `NotificationPrefs` drops `push_enabled`.

### Reconcile (folded in)

`useDevicePrefs` self-heals the earlier desync: if the browser has a local
subscription the server doesn't list, it **re-POSTs** it (all-on) before showing
prefs — fixing "subscribed locally but missing on the server."

## Migration

Pre-0035 subscriptions have no pref attributes → read as all-on via defaults.
The old account `NOTIFPREF/SETTINGS` row is simply no longer read.

## Tests

Rust: sub round-trips prefs; `update_subscription_prefs` (incl. `404` on a
missing endpoint); fan-out sends only to subs whose prefs allow the kind.
Verified against the hosted dev API across two devices.
