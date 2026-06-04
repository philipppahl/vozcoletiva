# 0034 — Channel creation

Status: accepted · 2026-06-04

## Context

Projects shipped with a single seeded "Commons" channel; the Messages tab's
"+ New" only showed a "planned" alert. Members need to create channels.

## Decision

Add `POST /v1/projects/{slug}/channels` `{ name, description? }` → `201 Channel`.

- **Who:** moderators and above (`perms::require_moderator`, new — Owner /
  Admin / Moderator), to keep channel sprawl in check. Members/observers get
  `403`.
- **Name:** required, trimmed, ≤ 30 chars (`domain::channel::validate_name`,
  mirrors category names). `400` otherwise.
- **Duplicates:** rejected case-insensitively within a project (`409`). The
  check is read-then-write (`list_channels` then transact) — a rare concurrent
  double-create could still slip through; acceptable at MVP scale.
- **Storage:** unchanged schema — a channel is a `Conversation` written as two
  items in one `TransactWriteItem`: `CONV#<id>/META` (`type=Channel`) +
  `PROJECT#<pid>/CONV#<id>` (`type=ChannelPointer`, denormalised name/desc that
  `list_channels` reads). ULID id. Channels stay **project-wide** — project
  membership governs access; no per-channel membership.
- **FE:** the "+ New" button opens a `NewChannelSheet` (name + optional
  description); on success it invalidates the channels query and navigates into
  the new channel. Channels run on the real backend in dev (no mock layer).

## Out of scope

Rename / archive / delete, private (membership-scoped) channels, channel icons,
per-channel notification settings.

## Events

`channel_created` (operational; project_id + channel_id + by_user, no PII).

## Tests

`domain::channel::validate_name` unit tests; endpoint verified against the
hosted dev API (create, duplicate → 409, non-moderator → 403).
