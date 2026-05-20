# 0001 — Design integration (2026-05-19)

**Status:** accepted
**Date:** 2026-05-19
**Slice:** 1 of 7 (see `docs/design/ext-2026-05-19/integration-plan.md`)

## Context

The team commissioned a Claude Design pass on vozcoletiva (`docs/design/ext-2026-05-19/vozcoletiva-2/`). After iterating with the designer, three substantive changes landed that the existing project hadn't made: a cool-slate + indigo palette (replacing teal + coral), a typographic system built on Newsreader / Public Sans / JetBrains Mono, and a re-organised information architecture (avatar/project/title header, four-tab bar, top sheet for project switching, Manage hub for project administration).

The integration plan called these out as decisions before the slice could be implemented. This document captures the decisions and the reasoning so a later contributor (or a later us) doesn't have to re-derive them from screenshots and chat transcripts.

## Decision 1 — Palette: adopt slate + indigo

Replace the teal `#2A8A7B` brand and coral `#E07856` accent with a cool-slate base (h ≈ 240) and an indigo default accent (h = 265, c = 0.16). Three sibling accents (violet, teal, amber) share the indigo's chroma so projects could theme differently without losing tonal harmony. Full palette in `brand/palette.md`; tokens in `apps/web/src/styles/global.css`.

Reasoning: the brief explicitly said *"if the design requires the brand to change, surface it as an explicit question rather than changing it silently"*. The designer surfaced it. The cooler palette reads modern without sliding into corporate-blue, and the unified-hue neutrals give the surfaces a one-material feel that the earlier earthy palette didn't. The logo mark gets the indigo accent dot (`brand/logo-mark.svg`); the wordmark uses `currentColor` and follows.

## Decision 2 — Typography: Newsreader + Public Sans + JetBrains Mono

Display headings (page titles, proposal titles, deliberation headers) use **Newsreader Variable** (transitional serif with optical sizing). UI body uses **Public Sans Variable**. Invitation codes, IDs, and "PLANNED" mono eyebrows use **JetBrains Mono Variable**.

All three self-hosted via `@fontsource-variable/*` packages and imported in `apps/web/src/main.tsx`. The system font stack remains as a fallback.

Reasoning: the serif/sans/mono triple gives the product a civic-document feel that matches the domain (collective decisions, statutes, by-laws) without being heavy or institutional. Three variable fonts cost ~150 KB compressed; we accept the payload for the visual identity it carries. If the load budget tightens, we can drop italics or fall back to system stack — the design degrades cleanly.

## Decision 3 — Information architecture: header + 4-tab bar + top sheet

- Every project-scoped page wears the **ProjectHeader**: avatar (→ `/preferences`), project name + chevron (opens the top sheet), and the page title below.
- Bottom **TabBar**: Proposals / Documents / Messages / Search.
- **Project top sheet** (slides down from the header on tap): current project + Manage button + other projects + New / Join with code actions.
- **`/p/$slug/manage`**: hub page with links to Members, Invites, and a placeholder for future project settings. Members and Invites keep their existing URLs (no link rot) but lose tab-level visibility.
- **`/preferences`**: top-level route with theme + language + sign-out. Replaces the home-page ThemeToggle.

Documents, Messages, Search tabs render Planned placeholder cards in this slice; they become real in Slices 4–6.

Reasoning: the tab bar is reserved for *modes* of the app (proposals/docs/messages/search), not management surfaces. Members + Invite move into the Manage hub because the user reaches them seldom and from a clear administrative intent, not from "what should I do next?". A top sheet (rather than the designer's original bottom sheet) better fits the user's mental model of "the project name is a portal back to the project list."

## Consequences

- **Brand**: `brand/palette.md` rewritten; `brand/logo-mark.svg` recoloured. The PWA manifest `theme_color` becomes `#5B5BE0`. The teal mark survives only in git history.
- **Tokens**: `apps/web/src/styles/global.css` uses OKLCH variables. Old `--brand` / `--accent` / `--surface-bg` token names alias to the new ones so we can migrate component-by-component without breaking anything.
- **Components**: new shell primitives (`ProjectHeader`, `TabBar`, `TopBar`, `Sheet`, `ProjectShell`, `ProjectTopSheet`). Existing primitives (`Button`, `Field`, `StatusBadge`, `RoleBadge`) restyled to the new tokens; `Button.variant` defaults to `'primary'` to keep call sites that didn't specify the variant rendering as the dominant CTA.
- **Routes added**: `/preferences`, `/p/$slug/documents`, `/p/$slug/messages`, `/p/$slug/search`, `/p/$slug/manage`.
- **Out of scope for this slice**: forking data model and UI (Slice 3), profile photo upload (Slice 2), functional Search (Slice 6), Documents and Messages real implementations (Slices 4–5), Competing-mode voting (Slice 7), auth-screen restyle (Slice 1b — deferred).

## Open questions

- Auth screens (sign-in, sign-up, verify, join) are not restyled in this slice. They render against the new palette and typography automatically but their layouts are pre-design. Slice 1b should bring them in line.
- The Manage hub currently only has Members + Invites links. A future "Project settings" page (rename, change visibility, transfer ownership) gets a slot in the hub.
