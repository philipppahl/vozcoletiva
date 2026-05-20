# vozcoletiva — UI / UX design notes

Internal notes from the project owner before commissioning a design pass. These are opinions, gap observations, references, and anti-references — useful as **internal context** for a designer who wants the project owner's instinct, but **not** the actual brief to feed to a designer (that's [`docs/design-brief.md`](./design-brief.md), which is deliberately description-only so design isn't anchored by opinion).

Refer back to `VISION.md` and `brand/palette.md` for the canonical depth.

---

## 1. The product, in one paragraph

**vozcoletiva** is a mobile-first PWA for structured collective decision-making. A group (co-op, sports club, residents' association, open-source project, household, union local) creates a private project, invites members, and runs **proposals** that are debated in markdown comments and decided by a recorded vote under a chosen rule (simple majority / two-thirds / consensus / quorum) within a fixed runtime. When time is up, the proposal closes automatically and the outcome is sealed in the audit trail. Discussion continues after the decision.

Inspired by LiquidFeedback. Open source. One canonical hosted instance at `vozcoletiva.com`.

---

## 2. Audience and voice

- **Primary user**: an engaged member of a small-to-medium group (5–500 members) on a phone, deciding something that actually matters to them. Could be in Lisbon, São Paulo, Madrid, or Berlin.
- **They are not** technical, not procurement-driven, not project-managers. They want **clarity** about what's being decided, who's deciding, by when, and what the result is. They want their voice to feel **counted**, not lost.
- **Voice**: calm, direct, civic. Not playful (decisions are real). Not bureaucratic (people will leave). Closer to a notebook than to Slack. Confident without shouting.
- **Languages at launch**: English and Portuguese. Strings are already externalised via Lingui; designs should leave room for ~30% string-length growth on PT.

---

## 3. Brand (already locked in — please honour)

All assets live in `/brand/`.

- **Logo mark**: rounded teal square (`#2A8A7B`), white V-as-checkmark stroke, small coral accent dot (`#E07856`) at the rising tip. Reads as both *voice* and *vote*.
- **Wordmark**: mark + "vozcoletiva" in a system / Inter-fallback sans.
- **Primary**: teal `#2A8A7B` (full 50–900 scale). **Accent**: warm coral `#E07856` (50–900). **Neutrals**: cool slate.
- **Semantic**: green (success), amber (warning), red (danger).
- **Typography**: SF Pro / system font stack on Apple devices, Inter fallback. Variable; 7-step scale already specced (`brand/palette.md`).
- **Light + dark** both first-class with system-preference detection + manual override. Surface tokens already mapped per theme.

**Do not** change the mark or core palette. Sub-palette extensions (e.g. tonal layers for new surfaces) are welcome.

---

## 4. What exists today (shipped on dev)

The PWA at `https://vozcoletiva.com` (URL pending registration; currently `https://d2z77c7we4tkm9.cloudfront.net`) has these flows live and working:

1. **Auth**: email sign-up with 6-digit verification, sign-in, sign-out. Cognito User Pool under the hood.
2. **Home screen (signed-in)**:
   - Brand mark + wordmark + tagline.
   - "Hello, &lt;name&gt;" greeting.
   - "Your projects" list (project name, slug, role badge).
   - "Create a project" CTA.
   - "Got an invite code?" link.
   - "Sign out" button.
   - System / light / dark theme toggle (currently parked at the bottom).
3. **Projects**: create (name + slug + Custom template), list my memberships, view project home.
4. **Members tab** (within a project): list with role badges (Owner / Admin / Moderator / Member / Observer).
5. **Invites tab** (Owner/Admin only): issue an invite with role + expiry (days) + max-uses + free-text note → get both a **shareable URL** and a short typeable **8-character code** (unambiguous alphabet, no `0/O/1/I/l`). Revoke any invite.
6. **Accept-invite**: `/i/<token>` page shows the project, role-on-join, and expiry; `/join` page accepts a typed code.
7. **Proposals** (Decision type only for now): create with title, markdown body, voting rule (Simple majority / Two-thirds), runtime (2 min / 1 hour / 1 day / 1 week), optional quorum. List on the project overview (active + recently closed). View detail.
8. **Vote**: yes / no / abstain. Cast or change while voting is open. Retract. Tally bar updates roughly every 5 s while voting.
9. **Scheduled close**: EventBridge Scheduler fires a worker Lambda at `endsAt` that transitions the proposal to `passed / rejected / quorum_failed`.
10. **Comments** on any proposal (open or closed): markdown body, edit own (with `(edited)` marker), soft-delete own (tombstone preserves position). Admins / Owners can soft-delete any comment.
11. **i18n**: EN + PT runtime catalogues; locale auto-detected from browser, persisted in localStorage.
12. **PWA**: installable on iOS 16.4+ and Android. Service worker auto-updates with one-reload lag.

Full URL list:
`/` (home) · `/sign-up` · `/sign-up/verify` · `/sign-in` · `/sign-out` · `/projects/new` · `/p/<slug>` · `/p/<slug>/members` · `/p/<slug>/invites` · `/p/<slug>/proposals/new` · `/p/<slug>/proposals/<id>` · `/i/<token>` · `/join`

---

## 5. What's planned (the next 12–18 months of slices)

In the order they're likely to land. The design should anticipate these but **not** ship UI for them.

- **Inbox + push notifications**: cross-project "this needs your attention" surface. Closing-soon nudges via EventBridge Scheduler. Web Push (VAPID) for real notifications. Configurable per project + per event type.
- **Comment threading**: replies to comments forming a tree. `parent_comment_id` already in the schema.
- **Reactions**: a small set of emoji on comments and (later) on chat messages.
- **`@mentions`**: tag a member in a comment; triggers a notification.
- **Proposal editing**: when a published proposal's substance is edited, **the vote tally resets and every voter is notified to re-vote**. Versioned audit trail kept.
- **Document Library**: accepted *Document*-type proposals become versioned, citable artefacts at `/p/<slug>/docs/<doc-slug>`. Amendments diff against the previous version. PDF export.
- **More proposal types**: Election (vote people into roles), Poll (pick from co-created options), Petition (gather support, threshold to promote).
- **Topics**: project-scoped folders that group proposals by area (Finance, Events, Bylaws). Channels (chat) similarly.
- **Group chat**: per-project channels with text, image, voice notes. Distinct from comments (chat is fast + flat; comments are decision-anchored).
- **Delegation** (the LiquidFeedback "liquid" part): delegate your vote per project / topic / proposal. Transitive. Revocable.
- **Pseudonymous voting**: a project-level switch that hides voter identity behind per-proposal tokens (tallies stay public).
- **Public projects**: discoverable, anyone-can-join (currently private-only).
- **Project templates**: Co-op, Sports Club, Residents' Association, Open Source — pre-fill defaults at create time.
- **Settings panes**: per-user (locale, theme, notification prefs), per-project (defaults for voting mode / runtime / code of conduct).
- **Onboarding**: first-launch tutorial, especially for non-technical members.
- **Custom domain `vozcoletiva.com`**, OIDC-federated CI/CD.

See `VISION.md` for the full domain model.

---

## 6. Where I'd love a designer's eye (the specific UX gaps)

These are the rough edges I see today. A redesign could address some or all; pick the highest-leverage items.

1. **The signed-in home is functional but spartan.** It's a list, a CTA, and a theme toggle. There's no sense of *activity* — "is anything happening?" requires drilling into each project. The future inbox will help, but even the empty / between-events state needs to feel calm, not blank.

2. **Project switcher** lives only on the home. Once you're inside a project, jumping to another requires going back to home. Big nav UX question: persistent project switcher in a header? Bottom tab bar? Drawer?

3. **The proposal detail page is dense.** Stacked vertically: back link, status badge + time-remaining + mode + quorum, title, tally bar, vote buttons, markdown body, withdraw, comments section with its own composer. On a 390-wide screen that's a lot. A designer eye on hierarchy + grouping would help — what comes first? What collapses? What's a sheet?

4. **The tally bar communicates very little.** It's a tri-colour stripe. It doesn't show: the *decisive threshold* under the chosen rule (50% line for simple, 66.7% line for two-thirds), the quorum target, how many members haven't voted yet, the trajectory ("close" vs "comfortable"). A better tally visualisation could be one of the strongest moments in the product.

5. **Status badges are flat coloured pills.** Voting / Passed / Rejected / Quorum-failed / Withdrawn. Functional but no character. There's room for a more memorable visual language (icons? texture? a checkmark for passed mirroring the brand mark?).

6. **Vote buttons.** Three pills, active one tinted. Works but uninspired. The act of voting is the most important moment in the product — could it feel like more of a *commitment*? Without being heavy or alarming.

7. **Time-remaining** is a small text snippet ("Closes in 12 min"). For proposals closing soon there's no visual urgency. For proposals closing in a week there's no calm patience. One component, two opposite feelings.

8. **Comment thread.** Linear stack of cards. When threading lands (replies-to-replies), what does the indentation / collapsing look like? Designer should sketch this even though it's not built yet, so the current design accommodates it.

9. **Empty states.** "No comments yet. Start the discussion." / "No proposals yet — be the first." Functional. Could be invitations rather than absences — small illustrations? a single-line CTA framed as opportunity?

10. **Invite flow.** Currently: pick role / expiry / max-uses → get a URL + a short code → copy. Two copy buttons on the same card. The information hierarchy could be much better: which one do I share? When do I use the code vs the URL? A small explainer could carry weight.

11. **Theme toggle placement.** Currently the *last* element on the signed-in home — three pills (system / light / dark). Should it move to a settings page once we have one? Move up? Become an icon button in a header?

12. **Onboarding** is non-existent. A user signs up, lands on an empty home, sees "Create a project" or "Got an invite?". A first-launch flow with two lanes (host vs. join) might help.

13. **The brand mark currently appears once per page (top-of-home, sign-up, sign-in, accept-invite).** Inside a project + on the proposal page, it disappears. Should the brand be more pervasive (header bar)? Or stay reserved as a signature?

14. **Navigation breadcrumbs / context.** Inside a proposal we show "← All proposals" and the project name + role badge. On a member sub-route, "← All projects". There's no consistent global wayfinding. Tab bar? Header? Both?

15. **Status feedback.** Today, posting a comment or casting a vote happens silently — no toast, no micro-animation. Designer should weigh: how much visible feedback does this product need? (Likely *some*, but the "calm" voice argues against celebration.)

16. **Accessibility patterns.** All inputs are 44 × 44 tap-targets and the focus ring is wired via CSS custom properties. Designs should keep accessible affordances (visible focus, contrast, motion respecting `prefers-reduced-motion`). Screen-reader friendliness is a constraint, not a stretch.

17. **The proposal create form.** Mode + runtime are segmented controls; quorum is a number input. Workable; could be more conversational ("how should we decide?" / "by when?") or more compact (fewer visual segments).

18. **The 'iOS-native feel' direction.** We've committed to iOS-style spring motion, bottom-sheet modals on mobile, large-title navigation, system font, safe-area respect. Most of these aren't actually implemented in the current PWA — designs should make them concrete, especially the **bottom-sheet** treatment for the vote action, the invite issuer, and the comment composer.

---

## 7. What I'd love back (concrete deliverables)

Roughly in order of leverage:

1. **A "current state vs. proposed" sketch** for the **proposal detail page** at mobile width (390 × 844). The single highest-leverage screen.
2. **The signed-in home** redesign covering: empty state, 1–3 project state, 5+ project state, "you've got something to do" state (anticipating inbox).
3. **A tally visualisation** that does justice to the rule + quorum + remaining-voters story. Static plus voting-in-progress feel.
4. **A vote-action treatment** — should it be a bottom sheet on tap? Inline pills? A swipe gesture? Whatever it is, it must feel like a deliberate act, not a like-button tap.
5. **A status-badge family** (Voting / Passed / Rejected / Quorum-failed / Withdrawn) with a stronger visual language.
6. **A navigation pattern**: persistent header? Bottom tab bar? Drawer? Show how it works inside a project + on the cross-project home.
7. **Empty states** for: no projects, no proposals, no comments, no invites, no members beyond yourself.
8. **An onboarding sketch** for the first-time signed-in user: host-vs-join split, what comes after.
9. **A future-proof comment thread layout** that anticipates threading + reactions + `@mention` chips.
10. **A theme-toggle + locale-switcher placement** that makes sense once a settings surface exists.

Bonus, if scope allows: a sketch of the future **inbox** screen (cross-project "this needs you"), so we can plan the slice with a target.

---

## 8. References and inspirations

- **LiquidFeedback** — the conceptual ancestor. Read for the *what*, not the *how* (its UI is dated).
- **Discourse** — for civil discussion threading and notification calm.
- **Apple HIG** (iOS) — large-title navigation, bottom sheets, segmented controls, safe-area handling.
- **Linear** — for restraint, decisive typography, status badges that read at a glance.
- **Things 3** — for the quality of "this is what's actually on you today."
- **GOV.UK Design System** — for clarity of decision flows and accessibility hygiene.
- *Anti-references*: anything that gamifies governance (no streaks, no XP, no leaderboards). No "trending proposals." No reaction counts that incentivise loud votes.

---

## 9. Hard constraints (do not break)

- **Brand mark + primary teal `#2A8A7B` + coral accent `#E07856`** stay.
- **Mobile-first**. Every layout designed at 390 × 844 first; desktop is the upside.
- **Light + dark** at the same level of polish.
- **iOS-native default look** (system font, large titles, bottom sheets, 44 × 44 tap targets, safe-area insets, `prefers-reduced-motion`).
- **WCAG 2.2 AA** for contrast and keyboard navigation.
- **No gamification** that would distort governance (no streaks, no reaction-spam incentives, no public engagement scores).
- **Bundle weight**: every added asset / dependency has to justify itself; today's initial JS is ~110 KB gzip.
- **Calm notifications principle**: the system speaks rarely and only when it has something useful to say. Designs should not encourage adding more noise.
- **i18n-friendly**: avoid baked-in text in images; leave PT growth room.

---

## 10. Open questions (bring opinions)

- **Navigation chrome**: persistent header vs. bottom tab bar vs. minimal/none? On a phone with few projects, do we need any global nav at all, or does deep-linking + the back button suffice?
- **Action prominence on the proposal detail**: vote first (above body) or read first (vote below body, after consideration)? Today: vote-above. Possibly wrong.
- **Comment composer placement** on long threads: top (compose-first) or bottom (read-first)?
- **Iconography**: do we want a small set of branded icons, or stay icon-light and rely on type?
- **Subtle motion**: spring-on-state-change feels right for iOS; how much before it becomes noisy?
- **Project identity**: should a project have a small icon / emblem / colour? Or stays purely text-named?
- **Information density**: a co-op of 8 vs. a union local of 800 have very different needs. Where do we draw the line for "default density" on the proposal list?
- **Tone of empty states**: warm + inviting, or restrained + neutral?

---

## 11. Pointers into the codebase (for an AI tool or technical designer)

- Live dev URL: `https://d2z77c7we4tkm9.cloudfront.net/`. Public repo: `github.com/philipppahl/vozcoletiva`.
- Brand tokens: `brand/palette.md`, `brand/logo-mark.svg`, `brand/logo-wordmark.svg`.
- Current FE: React 19 + Vite + TS, TanStack Router, Tailwind v4 (CSS-first config in `apps/web/src/styles/global.css`), Radix UI + custom wrappers, Lingui, react-markdown.
- Bundle budget: 120 KB initial JS (gzip), 15 KB critical CSS, 200 KB cold-first-paint total.
- Frontend stack lock-in details: `docs/frontend-stack.md`.

---

## 12. What I expect from the response

Sketches (Figma frames, screenshots, hand-drawn-on-paper photos — anything visual) plus a short written rationale per screen. I will treat the design as a *direction* to translate into the existing Tailwind + Radix component set — pixel-perfect handoff isn't required, but **clear specs for spacing, type scale, surface tokens, and motion timing** are. The codebase will follow.

The end-to-end goal: a person who's never seen the app should open it, recognise immediately that it's about decisions, find what needs their attention in under five seconds, and feel that whatever they're about to do *matters*.

*Notes authored 2026-05-19. Lives at `docs/design-notes.md` — update directly as the thinking evolves. The lean brief to hand to a designer is at `docs/design-brief.md`.*
