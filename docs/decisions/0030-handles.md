# 0030 — User @handles

**Status:** accepted
**Date:** 2026-06-02
**Builds on:** 0019 (profile = backend source of truth), 0029 (batch profile lookup for list DTOs)

## Context

Users were identified only by a display name (not unique) and an opaque user id.
Mentions were wired on the raw **user id** (`@<uuid>`) — unreadable, unstable to
type, and leaking the internal identifier into message bodies. We want a unique,
human, mention-friendly identifier: an `@handle` like `@marina`.

Decisions taken with the user up front:

1. **Mentions store the `@handle` in the message body** (not the user id). Render
   resolves handle → user. A rename therefore does **not** rewrite old messages;
   the historical text is preserved (and a freed handle re-points on lookup).
2. The identifier is called a **handle** (UI copy: "handle", `@`-prefixed).
3. **Standard handle rules** — see Validation below.
4. Existing accounts get a **suggested handle auto-derived** from their email
   local-part (Phase 2 gate), but must confirm/adjust it.
5. A handle is **required at signup** going forward.

Delivered in three phases — Phase 1 (model, uniqueness, validation, API), Phase 2
(signup + profile UI + null-handle gate), Phase 3 (mentions by handle, FE + BE) —
all described below.

## Decision

### Model + uniqueness

- The profile gains an optional `handle` attribute (nullable for legacy accounts
  until they pick one — Phase 2 forces the choice).
- Uniqueness is enforced with a **claim sentinel**, the same pattern as project
  slugs: a `HANDLE#<handle> / CLAIM` item holding `userId`. Claiming writes it
  under `attribute_not_exists(PK)`; a collision fails the condition → **409**.
- **Case-insensitive**: handles are normalised to lowercase before storage and
  lookup, so `@Marina` and `@marina` are the same handle.
- Set/change is **one `TransactWriteItem`**: put the new claim (conditional),
  point the profile at the new handle (bootstrapping the profile shell if needed,
  mirroring `set_avatar`), and delete the old claim if one existed. Atomic — no
  window where a user holds two handles or a handle is half-released. Re-claiming
  your own current handle is a no-op (not a conflict).

### Validation (`domain::handle`)

A single `validate_handle` returns the canonical lowercase form or `BadRequest`:

- trimmed, lowercased;
- **3–20** characters;
- charset `[a-z0-9_]`; **must start with a letter** (no leading digit/underscore);
- a **reserved list** is rejected (`admin`, `me`, `everyone`, `system`,
  `vozcoletiva`, …) so we keep them for routes/system actors.

### API (API-first — no backdoor)

- `PUT /v1/me/handle` `{ handle }` → `{ handle }`. Claims/changes the caller's
  handle. **400** malformed/reserved, **409** taken, **200** + canonical handle.
- `GET /v1/handles/{handle}/availability` → `{ handle, available }`. For the
  signup/profile form's live check. The caller's **own** current handle reads as
  available (so editing the profile doesn't flag a no-op save). Validates shape
  server-side too (400 on malformed) — never trusting the client.
- `handle` added to the `/v1/me`, **members list**, and **DM participant** DTOs
  (resolved via the existing batch `profile_refs` lookup — renamed from
  `avatar_keys`, now returning avatar + handle in one `BatchGetItem`). No
  denormalisation into membership/message records; it stays a profile lookup so a
  rename can't go stale.
- The availability endpoint is **auth-optional** (`security: [{}, bearerAuth]`)
  so the sign-up form can check before the account exists. When a token *is*
  present it's used for the own-handle-is-available rule; otherwise anonymous.

### Onboarding + profile (Phase 2)

- A shared **`HandleField`** (live shape validation + debounced availability,
  green "available" / red "taken") backs three surfaces: sign-up, the gate, and
  Preferences.
- **Sign-up** gains a handle field, auto-suggested from the email local-part
  until the user edits it; "Continue" is disabled until it's available. The
  chosen handle is carried to the verify step and claimed (`PUT /v1/me/handle`)
  right after first sign-in.
- A **null-handle gate** (`HandleGate`, mounted in the root layout) blocks a
  signed-in user without a handle behind a "Pick your handle" interstitial. It
  is the single robust handle-picker: it covers **legacy accounts** (the
  migration path — no backfill needed) and the rare sign-up race where the chosen
  handle was lost. Suppressed only on the auth-transition routes
  (`/sign-in`, `/sign-up`, `/sign-out`) so it never flashes mid-claim.
- **Preferences** shows the current `@handle` and a row to change it (same
  availability UX; own current handle reads as available so a no-op save is
  disabled).
- The handle is synced into the auth session (alongside name + avatar) so
  surfaces can show `@handle` without refetching. Pure shape logic lives in
  `lib/handle-shape.ts` (no React / no API client) so it's unit-testable.

### Mentions by handle (Phase 3)

- Mentions are now `@handle` tokens stored in the body (decision 1), replacing
  the old `@<uuid>`. The composer's member picker inserts `@handle`; only members
  **with** a handle are offered.
- Parsing is unified FE↔BE: a mention is `@` at a boundary (start or after a non
  `[A-Za-z0-9_]` char — so `marina@example.com` isn't one) + a 3–20 char handle
  ending at a non handle-character, lowercased to canonical form. The web
  `parseMentions` regex and the Rust `notify::extract_mentions` byte-scanner are
  deliberate mirrors.
- The renderer shows the literal `@handle` as a chip (display name on hover).
  Inbox fan-out resolves each handle → member `user_id` via the project's
  `profile_refs`; the stored notification preview substitutes `@handle` →
  `@Display Name` for readability.

## Trade-offs / notes

- **Handle in the body** (decision 1) means a rename leaves old mentions pointing
  at the *old* text. Resolution is by current handle at render time, so a freed +
  re-claimed handle would re-point an old mention to the new owner. Acceptable for
  a small trusted base; the alternative (storing the user id, rendering the
  handle) was rejected to keep bodies human-readable and copy-pasteable, per the
  user's explicit choice.
- **No handle-history / squatting protection** yet: a freed handle is immediately
  claimable. Fine at this scale; revisit if it becomes a vector.
- **Legacy null handles**: tolerated at the model layer (the field is optional)
  precisely so Phase 1 can ship without a blocking backfill; Phase 2 gates the
  app behind picking one.

## Tests

- BE unit (`domain::handle`): normalise-to-lowercase, length bounds, must-start-
  with-letter, charset, reserved rejected.
- BE unit (`notify`): `@handle` extraction (not emails, too-short skipped,
  lowercased + deduped, over-long runs rejected); preview name resolution
  (case-insensitive, unicode-safe, unknown left as-is).
- BE integration (`user_it`): claim + resolve; reject a taken handle (409, owner
  unchanged); change releases the old handle (and it's then re-claimable);
  idempotent re-claim of your own; `profile_refs` returns handle + avatar.
- FE unit (`handle.test.ts`): shape validation codes, `suggestHandle` derivation;
  (`messages-mention-parse.test.ts`): `@handle` parsing incl. email/too-short
  rejection + lowercasing.

## References

- Backend: `domain/handle.rs`, `repo/user.rs` (`handle` field, `user_by_handle`,
  `set_handle`, `profile_refs`), `handlers/handles.rs`, `handlers/me.rs` /
  `members.rs` / `conversations.rs`, `main.rs` (routes), `notify.rs` (handle-based
  mention fan-out).
- Spec/client: `openapi.yaml` (`setHandle`, `getHandleAvailability`,
  `SetHandleBody`, `HandleAvailability`, `handle` on `UserProfile`/`Member`/
  `DmParticipant`); regenerated `packages/api-client`.
- Frontend: `lib/handle.ts` + `lib/handle-shape.ts`, `components/HandleField.tsx`,
  `components/HandleGate.tsx`, `routes/sign-up.tsx` + `sign-up_.verify.tsx`,
  `routes/preferences.tsx`; mentions in `components/messages/mentions.ts`,
  `messageMarkdown.tsx`, `MentionPopover.tsx`, `MessageComposer.tsx`, and the
  channel/DM route candidate builders.
- Seed: `apps/web/scripts/seed-dev.ts` (demo users get `@marina`/`@tomas`/…).
