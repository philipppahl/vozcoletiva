# 0008 — Shell v2: unified dynamic chrome

**Status:** accepted
**Date:** 2026-05-29
**Slice:** Shell redesign (Phases 1–3)

## Context

The project chrome had grown inconsistent: tab routes used `ProjectShell`
(header + tab bar) but detail pages (proposal, document) used a bare `TopBar`
with no tab bar, the project switcher was a chrome-heavy two-section sheet,
and the header was static. The owner asked for a single coherent shell: a
dynamic header + footer shared by every project page, topics surfaced in the
header, a tighter switcher, and a swipeable Proposal/Discussion split.

## Decisions

### One shell, every project page
`ProjectShell` is the single wrapper for **all** project-scoped pages — tab
routes *and* detail pages (proposal, document). Detail pages pass `onBack`
(history back) and render inside the same header + footer. Non-project pages
(home, sign-in, preferences, inbox) keep their own minimal `TopBar` chrome —
the tab bar is inherently project-scoped, so "same chrome everywhere" means
"every project page."

### Dynamic header + footer (hide on scroll)
`useHideOnScroll` watches **window** scroll direction and returns a `hidden`
flag; the header translates up and the tab bar translates down when scrolling
down, both return on scroll-up or near the top. Honours
`prefers-reduced-motion` (never hides). We deliberately kept the existing
**window-scroll** model (sticky header/footer + transforms) rather than
migrating to a shell-owned scroll container — far lower risk, and it "just
works" on every list page.

### Header anatomy
`[back?] · avatar(→prefs) · project(→switcher, +unread dot) · title · bell`,
with a **subsection slot** below the title row that varies per page:
- Proposals / Documents → topic chips
- Proposal detail → a **Proposal | Discussion** segmented control
- Messages / Search → none

### Topics = categories (label only)
"Topic" is the user-facing name for the M7 `category` entity. The
`category_id` wire field and all mock/handler code are unchanged; only UI
copy + i18n changed. See decision 0007.

### Project switcher
One compact list (current project first, marked + a **gear** Manage action;
others tap to switch with a chevron). A tiny accent dot flags any project
with unread inbox items; the same signal drives a dot on the header's project
trigger. Unread-by-project derives from existing inbox data
(`useUnreadByProject`) — no new endpoint.

### Proposal / Discussion pager
The proposal detail splits into two panes — **Proposal** (alternatives + vote
+ body) and **Discussion** (comments) — switched by the subsection segmented
control or a horizontal swipe. Implemented as a **transform-based**
`SwipePager` (a flex row translated by `translateX`), *not* a scroll-snap
container: a horizontal scroll container would force vertical scrolling into
itself and break window-based hide-on-scroll. The transform approach keeps
the window as the vertical scroller, so the dynamic chrome keeps working, and
swipes are detected with lightweight touch handlers (horizontal-dominant
gestures only, so vertical page scroll is unaffected).

## Trade-offs / limits

- The shorter pane can leave whitespace below it (the pager row is as tall as
  the taller pane). Acceptable; only the active pane is visible.
- Swipe uses touchend deltas (no live finger-follow). Switching is a discrete
  animated transition — cleaner than half-dragged states, but less tactile
  than native scroll-snap. Revisit if it feels stiff on device.
- Back-nav now uses `router.history.back()` with a sensible fallback when
  there's no history entry (e.g. deep-link).

## Files

- `components/shell/useHideOnScroll.ts`, `ProjectShell.tsx`,
  `ProjectHeader.tsx`, `TabBar.tsx`, `ProjectTopSheet.tsx`
- `components/ui/Segmented.tsx`, `components/ui/SwipePager.tsx`
- `lib/inbox.ts` (`useUnreadByProject`)
- routes: `p.$slug.index`, `p.$slug.documents`, `p.$slug.proposals.$id`,
  `p.$slug.documents_.$name`, `preferences`, `inbox`
- `components/categories/*`, `components/forks/VariantTabs.tsx` (`embedded`)

## References
- Decision 0007 (categories/topics), 0004 (documents), 0005 (voting model).
