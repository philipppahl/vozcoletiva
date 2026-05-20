# Design integration plan — ext-2026-05-19

Source: `vozcoletiva-2/` (Claude Design bundle, exported 2026-05-19).
Reads from: `vozcoletiva-2/chats/chat1.md`, `project/theme.jsx`, `project/ui.jsx`, `project/app.jsx`, `project/screens.jsx`, `project/screens-2.jsx`, `project/forks.jsx`, `project/new-shell.jsx`.

## What the design landed on

After iterating with the user, the designer's last state:

1. **Shell**: `avatar | project-name+chevron | page title` header on every project page; 4-tab bar (Proposals / Documents / Messages / Search); bottom sheet for project switching that also houses Members + Invite (those stop being top-level tabs).
2. **Forking as first-class**: every multi-variant proposal collapses into a single deliberation card on the list; every variant page wears a sticky variant tree under the header; "Propose an alternative" is a dashed action inside the vote card. Competing mode is a different page (root question + ranked-choice picker, badged PLANNED).
3. **Profile**: avatar upload via file input + camera capture; lives in Preferences (reachable by tapping the header avatar).
4. **Aesthetic refresh**: iOS-leaning — soft elevation, 18 px card radius, 14 px fields, glassy sticky chrome, larger Newsreader display + Public Sans UI + JetBrains Mono for codes.
5. **Palette swap**: designer rejected our warm teal+coral as "earthy" and shipped a cool-slate base with **indigo** as the default accent (violet / teal / amber as siblings).
6. **Two new "Planned" surfaces** (Documents, Messages) and **one functional** (Search). All three reflect VISION future-capabilities.

## Current state of the FE (as built)

- React + Vite + TanStack Router file-based. Tailwind v4 CSS-first config in `apps/web/src/styles/global.css`.
- Brand tokens: teal `--brand` + coral `--accent`, Inter / system font stack.
- Shell: top-level `__root.tsx`; `index.tsx` (signed-in landing + theme toggle); `/p/$slug` layout with pill-tab nav (Overview / Members / Invites); `proposals/$id` detail with comments.
- No fork data model (proposals have no `parent_id` or `fork_mode`), no project selector sheet, no preferences screen, no documents / messages / search.

## Decisions (resolved 2026-05-19)

- **D1 — Palette**: adopt the designer's slate + indigo. Rewrite `brand/palette.md` with the OKLCH-defined neutrals (cool slate, h≈240) + the four-accent family (indigo default, violet / teal / amber). Logo mark needs its coral dot recoloured to indigo; wordmark uses `currentColor` so it follows.
- **D2 — Typography**: adopt Newsreader (display serif) + Public Sans (UI) + JetBrains Mono (codes). Self-host via Vite where possible; Google Fonts fallback acceptable for MVP. Update the brand palette doc's typography section.
- **D3 — Search**: ship as project-scoped DDB Scan + FilterExpression. Cap results, log a warning if Scan ever touches > 500 items so we know when to swap in OpenSearch.

## Slice plan

Each slice is a plan-feature cycle. Slices are ordered so each is shippable on its own; later slices depend on the earlier shell.

### Slice 1 — Shell IA + visual refresh (no new product features)

The biggest visible change with the smallest data-model risk. Captures most of the design value before we touch forks.

**Frontend only:**
- New `ProjectHeader` (avatar / project / page title) replaces the per-route `<header>` blocks in `p.$slug.tsx`, `p.$slug.index.tsx`, `p.$slug.members.tsx`, `p.$slug.invites.tsx`, `p.$slug.proposals.$id.tsx`.
- `TabBar` component (Proposals / Documents / Messages / Search — but Documents/Messages/Search may be hidden behind D3).
- `ProjectSelectorSheet` (Radix Dialog or custom): current project, other projects, "+ New project" / "Join with code", Members + Invite actions. Replaces the Members / Invites tabs at the layout level — those routes still exist, just reachable via the sheet.
- `PreferencesScreen` at `/preferences`: theme + language + sign-out. Replaces the home-page theme toggle. Reachable by tapping the header avatar.
- Apply the design's visual language to existing components: card radius 18 / field radius 14 / glassy sticky chrome / Newsreader display headings.
- Palette + font changes per D1/D2.
- Update `Logo` if D1 changes the brand.

**No backend changes.**

### Slice 2 — Profile picture upload

Self-contained, useful on its own.

**Backend:**
- New endpoint `PUT /v1/me/avatar` accepting multipart image. Lambda streams to a private S3 bucket (`voz-avatars-<env>`), stores a CloudFront-signed URL or a presigned-GET URL on the user profile row.
- `DELETE /v1/me/avatar` to clear.
- Adds `avatar_url?: string` to `UserProfile`.

**Frontend:**
- Avatar component reads `avatar_url` from `useAuth().session` (extend the cached `/v1/me` response).
- Preferences screen: take photo (`capture="user"`) + upload + remove buttons.

**Risks**: S3 lifecycle (re-uploads → orphans), image stripping/resizing (we trust the client today; a malformed image is acceptable for MVP but we should bound size to ≤ 2 MB on the API and reject non-image content types).

### Slice 3 — Forking (independent mode only)

The biggest scope addition. Touches data model + a new compose flow + a new tree view. Competing mode stays a Planned placeholder.

**Backend:**
- Add `parent_id?: ProposalId`, `root_id: ProposalId` (materialised) and `fork_mode: 'independent' | 'competing'` (NULL on non-root) to Proposal. New GSI3 on `root_id` so the variant tree is one Query, not a tree-walk.
- `POST /v1/projects/{slug}/proposals` accepts optional `parent_id`. When present, the new proposal's `fork_mode` is inherited from root and `root_id` set accordingly. Body + title default-copied client-side.
- Validation: parent must be in the same project, must be voting (open) or recently passed/rejected (rule TBD — the brief says "fork any open proposal", so I'd restrict forks to `voting` parents at first).
- Atomic write same as proposal create today (TransactWriteItems creates Proposal + indexes).
- New endpoint `GET /v1/projects/{slug}/proposals/{root_id}/tree` returning the flat tree (rows with depth + isLast + tally).

**Frontend:**
- `DeliberationCard` (multi-variant) vs `ProposalCard` (solo) on the project home; pick by counting tree size.
- `VariantTabs` (sticky tree under the header) on the detail page.
- "Propose an alternative" inside the vote card → opens the compose route with `?fork=<parent_id>`.
- Compose route reads `?fork=` and pre-fills + shows "Forking from" banner.
- Competing mode option is rendered as **disabled with PLANNED badge** in the compose `ForkModePicker`. Don't implement the ranked-choice UI yet.

**Vision update**: VISION.md already covers forking in spirit ("forks of a parent proposal"). Worth re-reading and tightening with the design's framing — "alternative" as the user-facing word, "fork" as data.

### Slice 4 — Documents tab (placeholder)

The design renders Documents as a "Planned" card with sample-shaped entries. Implementing the placeholder is one component + one route + i18n strings.

If D3 keeps Documents in the tab bar, ship this in the shell slice (Slice 1). Otherwise defer.

### Slice 5 — Messages tab (placeholder)

Same as Documents: placeholder card + sample list. Same call as Slice 4 depending on D3.

### Slice 6 — Search

Depends on D3. If yes:
- BE: `GET /v1/projects/{slug}/search?q=` returns matching proposals + members. Implementation = DDB Scan + FilterExpression for MVP; refactor to OpenSearch later. Cap result size + emit a warning log if Scan touches > N items.
- FE: search input + result rendering per the design's `SearchScreen`.

### Slice 7 — Competing-mode fork voting (post-MVP)

Out of scope for the design integration. Wait until ranked-choice (Schulze) is a committed product decision. The designer's `CompetingDecision` component is a reasonable UI starting point when we get there.

## What the design does that we already do

So we don't re-do these:
- StatusBadge / Pill / TallyBar / Field / Button / Card — we have equivalents. Keep ours, just restyle.
- TimeRemaining / RelativeTime — keep ours.
- Comment composer + edit + soft-delete UX — already match.
- 6-digit verify input — already match.

## What we don't keep from the design

- **Tweaks panel** + screen rail: design-only inspection chrome; lives in `app.jsx` and is gated by `showScreensRail`. Drop it.
- **Inline React 18 via UMD + Babel-standalone in HTML**: design's delivery mode. Not relevant to our Vite + TanStack Router app.
- **Sample data hardcoded in `theme.jsx`**: replace with our typed API client.
- **Phone shell + status-bar mock**: design previewing chrome, not shipped UI.

## Open product questions surfaced by the design

These are decisions the designer made that I want to flag because they affect the product, not just the look:

1. **Members and Invites as "project actions in a sheet" vs top-level tabs.** The design's IA pushes these into the project-selector sheet. Operationally fine for MVP, but a project owner who lives in invites might feel them get harder to reach. Counter-argument: tab bar is now reserved for *modes* (proposals / docs / messages / search), and management surfaces don't belong there.
2. **"Alternative" as the user-facing word for fork.** I agree with this. VISION should follow.
3. **Forks can be forked.** The design shows a depth-3 tree (`p3 → p3f1 → p3f1a`). VISION already implies trees. Worth confirming we want >2 levels in MVP; the data model and UI accommodate it cheaply.
4. **Withdraw author-only.** Design preserves this. No change.
5. **Discussion stays open after close.** Design preserves this. No change.
6. **Edit a proposal resets the tally.** Not exercised in the design (designer didn't model edit). Our memory rule still applies; no design change needed.

## File-by-file impact (Slice 1 only)

- `apps/web/src/styles/global.css` — palette tokens (D1), font stack (D2), surface radius + shadow tokens.
- `apps/web/src/routes/__root.tsx` — render the tab bar only when in a project; otherwise unchanged.
- `apps/web/src/routes/p.$slug.tsx` — strip the per-route header; render the new `ProjectHeader` + outlet + `TabBar` here.
- `apps/web/src/routes/p.$slug.index.tsx` — render via the new layout, no own header.
- `apps/web/src/routes/p.$slug.members.tsx`, `p.$slug.invites.tsx` — same.
- `apps/web/src/routes/p.$slug.proposals.$id.tsx` — replace per-route header with a `<TopBar>` that has a back chevron + project label (the design's secondary header pattern).
- `apps/web/src/routes/preferences.tsx` — **new**. Theme + language + sign-out moves here.
- `apps/web/src/routes/index.tsx` — drop the theme toggle from home; it's now in Preferences.
- `apps/web/src/components/shell/ProjectHeader.tsx` — **new**.
- `apps/web/src/components/shell/TabBar.tsx` — **new**.
- `apps/web/src/components/shell/ProjectSelectorSheet.tsx` — **new** (Radix Dialog or custom; iOS-style bottom sheet).
- `apps/web/src/components/ui/Card.tsx` — **new** (the design's 18 px radius, soft shadow primitive).
- `apps/web/src/components/Logo.tsx` — update if D1 swaps the brand.

## Next step

After D1 / D2 / D3 are answered, start with **Slice 1** via the `plan-feature` skill. Slices 2 and 3 follow independently.
