# 0029 — User avatars (profile photos)

**Status:** accepted
**Date:** 2026-06-02
**Builds on:** 0019 (profile = backend source of truth), 0028 (push delivery)

## Context

Users were identified by coloured initials. People wanted a real photo —
in chat, member lists, and as the sender icon in push notifications (which had
been showing the app icon for everyone). The `Avatar` component already
supported an `imageUrl`; nothing supplied one.

## Decision

A profile photo, stored in S3, served over a stable CDN URL, shown wherever an
avatar appears. Initials remain the fallback.

### Storage + serving

- A new **media** S3 bucket (private, SSE), fronted by **CloudFront (OAC)** for a
  stable public URL. Avatars are **member-visible by design**, so public-read via
  the CDN (not short-lived presigned URLs) — simpler, and notifications need a
  stable URL.
- **Immutable versioned keys** `avatars/<userId>/<ulid>.webp`: every upload is a
  new key, so the CDN caches forever and a change is just a new URL — no
  invalidation, no cache-busting. The previous object is deleted on replace.

### Upload (API-first, no presigned)

- The client crops to a square + resizes to **256 px WebP** on a canvas (which
  also **strips EXIF/GPS**) and sends the bytes as **base64 in JSON** to
  `POST /v1/me/avatar`. Small enough (~15–30 KB) to go through the API with no
  API-Gateway binary config — keeps every state change on the typed API.
- The server **re-validates** (magic-bytes sniff: PNG/JPEG/WebP; 512 KB cap) —
  never trusting the client — stores the object, points the profile at it.
- `DELETE /v1/me/avatar` removes the object + clears the field.
- Presigned PUT stays the path for **large** media (chat images/voice) later.

### Resolution (no stale denormalisation)

- The profile carries `avatarKey`; the public URL is derived at the DTO layer.
- List endpoints attach `avatar_url` by a **batch profile lookup**
  (`user::avatar_keys`) rather than denormalising the avatar into membership /
  message records (which would go stale on every change). Added to `/v1/me`,
  members, and DM participants.
- The FE resolves a message author's avatar via an `avatarFor(userId)` map built
  from the conversation's members (channel) or participants (DM); the viewer's
  own avatar comes from the session. Initials when absent.

### Notifications

- The realtime consumer resolves the sender/actor avatar → `PushContent.icon`;
  the service worker uses it as the large icon (app icon as fallback). The badge
  stays the monochrome app silhouette.

## Trade-offs / notes

- **Public-read** avatars: anyone with the URL can fetch the image. Acceptable —
  avatars are shown to other members; the key has an unguessable ULID.
- **Server copy / no moderation**: deferred (handful of trusted users). Controls
  today: a user sets/removes their own photo; the operator can pull an object.
  A report→remove path is the follow-up when the user base grows.
- **GDPR**: self-removal is `DELETE /v1/me/avatar`. There is no account-delete /
  export flow yet; when it lands it must also purge `avatars/<uid>/*`.
- **Not yet avatared**: the mention popover + search rows still show initials
  (their endpoints don't carry `avatar_url` yet) — a small follow-up.

## Tests

- BE unit: image magic-byte sniff (accept PNG/JPEG/WebP, reject other/empty) +
  extension mapping.
- FE: the canvas path is exercised manually (camera + gallery on the emulator
  and a real phone): set → shows in chat/DM/member list + as the push icon;
  remove → back to initials. Light/dark, mobile + desktop.

## References

- Infra: `apps/infra/lib/constructs/media.ts`, `api.ts`, `realtime.ts`,
  `voz-stack.ts`.
- Backend: `handlers/avatar.rs`, `repo/user.rs` (avatarKey, set/clear,
  avatar_keys), `handlers/me.rs` / `members.rs` / `conversations.rs`,
  `state.rs` (MediaConfig), `realtime.rs` + `push_send.rs` (icon).
- Frontend: `lib/avatar.ts`, `routes/preferences.tsx` (AvatarPicker),
  `components/shell/Avatar.tsx`, `components/messages/*`.
- Also: app-icon/badge rebrand shipped alongside (commit "Rebrand PWA icon…").
