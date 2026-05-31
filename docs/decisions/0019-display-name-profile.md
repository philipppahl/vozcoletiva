# 0019 — Display name in the backend profile; Cognito for auth only

**Status:** accepted
**Date:** 2026-05-31
**Builds on:** 0016 (FE↔real-API), 0017/0018 (messaging), and the auth slice's `/v1/me`

## Context

Display names rendered as the user's Cognito `sub` (a UUID) everywhere the
backend is authoritative — member lists, comments, and message authors — even
though the FE showed the real name client-side. Root cause: the name was
**dual-sourced**. Cognito held a `name` attribute, the FE decoded it from the id
token, and the backend profile needed its own copy for denormalisation — but the
**access** token (all the backend verifies) carries no `name` claim, and the
`GET /me?display_name=` bootstrap hint was never wired. So
`get_or_create_profile(user_id, user_id)` defaulted every profile's display name
to the UUID, which then propagated onto memberships (at join) and messages (at
post).

## Decision

**Cognito holds authentication only (email + password). The backend user profile
is the single source of truth for the display name** (and future profile fields).

- **`PATCH /v1/me { display_name }`** — validates + upserts the caller's profile
  display name; returns the profile. This is the single bootstrap/edit path.
  `repo::user::upsert_display_name` uses one `UpdateItem` with `if_not_exists`
  for `locale`/`theme`/`createdAt`/`type`/`userId`, so an edit preserves prefs.
- **`domain::display_name::validate_display_name`** — trims, strips control
  chars, enforces non-empty + ≤80 chars (keeps accents/emoji).
- **`GET /v1/me`** no longer takes a `display_name` query (a GET must not mutate);
  it still creates-on-first-call with the user-id fallback, corrected by the
  first `PATCH`.
- **FE**: Cognito sign-up no longer sets the `name` attribute; `signIn` no longer
  decodes `name` from the id token (placeholder = email local-part). The
  canonical name comes from `GET /v1/me` (`lib/profile.ts::useProfile`), synced
  into the auth session by `useSyncProfileName` mounted at the root. Sign-up's
  verify step bootstraps the profile via `PATCH /me` with the chosen name.
  Preferences gains an editable **Display name** field (same `PATCH /me`).
- **Seed** sets each demo user's name via `PATCH /me` right after login, before
  creating projects/invites, so memberships + messages denormalise real names.

### Why not server-side Cognito lookup

`AdminGetUser`/`GetUser` would make the name authoritative from Cognito without
client input, but pulls in the heavy `aws-sdk-cognitoidentityprovider` crate (or
SigV4 signing) plus IAM, to fetch data the FE already holds. A display name is a
**self-asserted label** (sign-up already collected it from the user), so
client-asserted-then-stored is consistent, needs no new dependency or IAM, and
makes the seed work with zero extra wiring. Trade: one cacheable `GET /me` on
load instead of a free token decode — accepted.

## API

- New: `PATCH /v1/me` → `UpdateProfileBody { display_name: 1..=80 }` → 200
  `UserProfile`, 400 invalid, 401 unauth.
- Changed: `GET /v1/me` drops the `display_name` query parameter.
- OpenAPI + api-client regenerated.

## Data model

No new entity. The existing `USER#<sub>/PROFILE` item's `displayName` is updated
in place. Memberships (`displayName`) and messages (`author_display_name`) remain
**denormalised snapshots** taken from the profile at creation time — unchanged
model (stale-on-rename, per 0017). Correctness depends on the profile carrying
the real name *before* a membership/message is created; the sign-up bootstrap and
the seed ordering guarantee this.

## Events

`profile_updated` — `user_id` only. The display name may be a real name (PII), so
the **value is never logged**.

## Tests

- Unit (`domain/display_name.rs`): trim, accents/emoji kept, control-char strip,
  empty/whitespace rejected, length bound.
- Integration (`tests/user_it.rs`, DDB-Local): upsert creates then updates
  in place (createdAt preserved); `get_or_create_profile` after an upsert returns
  the real name (the path memberships use).
- Not integration-covered (handler-layer, needs auth): `PATCH` 400 on bad body,
  401 unauth — flagged, consistent with 0017.
- FE: `tsc` + `biome` clean; manual browser walkthrough (below).

## Manual UI verification

(filled in on the execution run — re-seed, then hosted CloudFront, mobile +
desktop, light + dark: real names show on message authors, member lists, and
comments; editing the name in Preferences persists and updates the avatar;
console clean.)

## Migration

No real users exist yet — only seeded dev users — so dropping the Cognito-name
path needs no backfill: the seed sets names authoritatively and new sign-ups
bootstrap correctly. If real users ever predated this, a one-time Cognito→profile
name copy would be needed.

## Out of scope

Richer profile fields (avatar, bio, pronouns), changing the denormalisation model
to live joins, and Cognito hosted-UI / OAuth providers.

## References

- `apps/api/src/domain/display_name.rs`, `repo/user.rs` (`upsert_display_name`),
  `handlers/me.rs`, `main.rs`, `openapi.yaml`
- `apps/web/src/lib/profile.ts`, `lib/auth/cognito.ts`, `routes/__root.tsx`,
  `routes/sign-up_.verify.tsx`, `routes/preferences.tsx`, `mocks/handlers/me.ts`
- `apps/web/scripts/seed-dev.ts`
- Decisions 0017, 0018.
