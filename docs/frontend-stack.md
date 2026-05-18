# Frontend stack — proposal

Status: **approved**, 2026-05-18. Canonical reference for FE choices. Mirrored in `CLAUDE.md` § *Stack*. Changes go through `plan-feature`.

## Guiding principles

- **Mobile-first PWA.** Every kilobyte counts on a phone over 4G.
- **Types end-to-end.** Leverage the API-first OpenAPI spec all the way into the UI.
- **Boring is good.** Pick well-maintained, well-documented libraries with healthy 2026 trajectories.
- **Small surface area.** Fewer dependencies = less to update, less to audit, less to break.
- **Swappable at the edges.** Wrap third-party APIs so any one piece can be replaced without ripple.

---

## Already locked in (`VISION.md` / `CLAUDE.md`)

| Concern | Choice |
|---|---|
| Framework | **React 19** |
| Bundler | **Vite** |
| Language | **TypeScript** (strict) |
| PWA tooling | **Workbox** (via `vite-plugin-pwa`) |
| Push | **Native Web Push + VAPID** |
| State (UI) | **Zustand** (noted "likely" — confirmed here) |
| Lint + format | **Biome 2.x** |
| Theming | Light + dark via `prefers-color-scheme` + manual override |

---

## Proposed picks

### Routing — TanStack Router *(confirmed)*
- **Why:** End-to-end type-safe URLs and search params (matches API-first/types-everywhere philosophy). First-class lazy loading, nested layouts, no manual loader plumbing.
- **Alternatives:** React Router v7 (more popular, less typed; acceptable fallback).
- **Footguns:** Smaller community than RR; breaking changes still occasional.

### Styling — Tailwind CSS v4
- **Why:** Mobile-first utilities, dark-mode-as-variant, zero runtime cost, instant rebuilds (v4 Oxide). Brand palette tokens map cleanly to CSS custom properties.
- **Alternatives:** CSS Modules (more verbose), Panda CSS (build-time CSS-in-TS, more complexity).
- **Footguns:** Long class strings — mitigated by component extraction + a `cn()` helper.

### Component primitives — Radix UI + custom wrappers *(confirmed)*
- **Why:** Accessible primitives (dialog, dropdown, popover, tooltip, switch, …) without imposing visuals. Custom wrappers in `src/components/ui/` style them with Tailwind + brand tokens.
- **Look & feel — iOS-native as the design reference:**
  - System font stack first: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif` (Inter as a fallback for desktop and consistency on Android).
  - Subtle elevation — soft shadows + 1px hairline borders rather than heavy material drop-shadows.
  - **Bottom-sheet** modals on mobile (Radix Dialog wrapped in a slide-up sheet); centered dialog only on larger viewports.
  - **Large-title** navigation header on the main scrollable surfaces (collapses to inline title on scroll, iOS-style).
  - **Segmented controls** where Apple HIG would expect them (tabs in a single row pill).
  - iOS-style **spring motion** curves for sheet transitions and reorder (cubic-bezier(0.32, 0.72, 0, 1) as the default ease).
  - `env(safe-area-inset-*)` respected on every fixed bar and sheet edge.
  - Tap-target minimum 44×44 (Apple HIG) — enforced via Tailwind sizing utilities.
  - On Android the same components should still feel clean and native-adjacent; iOS remains the design reference.
- **Alternatives considered:** shadcn-ui (copy-paste pattern; ongoing maintenance burden as Radix evolves), Mantine (heavier; harder to theme deeply), Ark UI (newer, framework-agnostic, smaller community).
- **Footguns:** Have to build the wrapper layer ourselves — worth it for control. iOS Safari quirks (status-bar handling, dynamic viewport units `100dvh`, swipe-back, keyboard avoidance, momentum scrolling on sheets) need explicit testing on a real device, not just a desktop emulator.

### Data fetching & cache — TanStack Query v5
- **Why:** De-facto standard for async server state in React. Mutations, optimistic updates, infinite queries, persistence (matters for offline-read PWA). Plays nicely with WebSocket invalidation.
- **Alternatives:** SWR (lighter, fewer features), RTK Query (requires Redux).
- **Footguns:** Easy to mis-shape query keys — establish a `queryKeys` factory early.

### Forms — react-hook-form + Zod resolver
- **Why:** Uncontrolled inputs → minimal re-renders (matters on mobile); huge ecosystem; first-class Zod integration mirrors our validation choice.
- **Alternatives:** TanStack Form (newer, lighter, less ecosystem), Formik (older, slower).
- **Footguns:** Field arrays + nested fields can be tricky — document patterns as we go.

### Validation — Zod
- **Why:** Industry standard for TS schema validation. Pairs natively with react-hook-form. Can also runtime-parse API responses as a belt-and-braces layer over generated OpenAPI types.
- **Alternatives:** Valibot (smaller bundle, modular; less ecosystem), Yup (older).
- **Footguns:** Zod 3 schemas are larger at runtime than Valibot; if bundle pressure shows up, swap.

### i18n — Lingui *(confirmed)*
- **Why:** Macro-based extraction (build-time error on missing translations), ICU MessageFormat (correct pluralization for PT), small runtime, type-safe.
- **Alternatives:** react-i18next (most popular, weaker DX), FormatJS / react-intl (similar to Lingui but more boilerplate).
- **Footguns:** Adds an SWC plugin to the toolchain.

### Date & time — date-fns
- **Why:** Tree-shakeable, functional, immutable, mature. Locale support for EN + PT.
- **Alternatives:** dayjs (smaller; some locale quirks), Luxon (heavier), Temporal polyfill (future-proof but ~60 KB and Temporal is not browser-native yet).
- **Footguns:** Function-per-operation imports — easy to bloat by accident; trust tree-shaking and verify with bundle analyzer.

### Markdown rendering — react-markdown + remark-gfm + rehype-sanitize
- **Why:** Proposal bodies, comments, and document text are user-generated; need GFM features (tables, task lists, autolinks) **and** explicit HTML sanitization.
- **Alternatives:** unified pipeline directly (more control, more code), markdown-it (faster, less React-idiomatic).
- **Footguns:** Bundle weight — lazy-load on routes that don't need it (e.g. the inbox doesn't render full proposal bodies).

### Icons — Lucide
- **Why:** Consistent stroke style, large set, tree-shakeable, MIT, integrates cleanly with Tailwind sizing.
- **Alternatives:** Phosphor (more weights), Tabler (huge set, slightly more opinionated), Heroicons (smaller).
- **Footguns:** Per-icon imports keep tree-shaking honest.

### Testing — Vitest + React Testing Library + Playwright
- **Why:** Vitest matches Vite's resolution and is fast. RTL drives component **behaviour**, not implementation. Playwright handles E2E, mobile-viewport tests, and visual regression.
- **Alternatives:** Jest (slower, separate config), Cypress (older E2E, weaker mobile story than Playwright).
- **Footguns:** Keep a small "happy-path Playwright per critical flow" budget; don't try to E2E everything.

### Package manager — bun *(confirmed)*
- **Why:** Fast installs, native TS, matches pelagus's existing toolchain.
- **Alternatives:** pnpm (also fast, more conservative), npm (slowest, baseline).
- **Footguns:** Bun occasionally differs from Node (some packages assume Node APIs). Keep an eye on edge cases.

### Monorepo — bun workspaces (no Turborepo yet)
- **Why:** Two apps at MVP; Turborepo's caching is overkill at this scale. Revisit once builds slow.
- **Proposed structure:**
  ```
  apps/
    web/         # React PWA
    infra/       # AWS CDK (TypeScript)
  packages/
    api-client/  # generated from the OpenAPI spec
    shared/      # TS types / constants shared between web and infra
  ```
- **Footguns:** Drift between FE and the (Rust) BE shows up in the OpenAPI contract — CI must regenerate `api-client` from the freshest spec on every BE merge.

### API client — openapi-typescript + openapi-fetch *(confirmed)*
- **Why:** Types generated directly from the OpenAPI spec; `openapi-fetch` gives fully-typed `client.GET('/projects/{id}')` calls with minimal runtime. Plain `useQuery` calls on top via TanStack Query — no generated hooks, no opinionated codegen output.
- **Regeneration policy:** the dev runs `bun run api:generate` locally and commits the regenerated `packages/api-client`. **CI verifies** by running the same codegen and failing the build if the committed output diverges from what the current spec would produce. No bot commits; no silent staleness. A pre-commit hook runs the same check locally so the failure is caught before push.
- **Alternatives:** orval (generates TanStack Query hooks; more code emitted), kubb (newer, plugin-based, ambitious).
- **Footguns:** No generated hooks → consistent `queryKeys` factory and hand-written `useQuery` shells. Codegen must be deterministic (sorted keys, stable formatting) or the verify step will false-positive.

### WebSocket client — native `WebSocket` + thin reconnect wrapper *(confirmed)*
- **Why:** PWA target = modern browsers; native WS is universally supported. Wrapper handles: exponential backoff, presence keepalive, message-type discrimination via AsyncAPI-generated types.
- **Alternatives:** socket.io (heavy, fallbacks we don't need), `reconnecting-websocket` (thin enough to roll ourselves).
- **Footguns:** Reconnect-on-auth-expiry; resubscribe / resync on reconnect — plan it once, don't reinvent per-feature.

---

## Bundle-size targets

| Surface | Initial JS (gzip) | Notes |
|---|---|---|
| Inbox / login | ≤ **120 KB** | First-paint critical |
| Critical CSS | ≤ **15 KB** | Inlined |
| Cold first paint, total transfer | ≤ **200 KB** | Includes fonts & icons |

Aspirational, not hard gates — but every new dependency runs the "does it fit the budget?" question before being added.

## Browser support targets

- Latest 2 versions of Chrome, Edge, Safari, Firefox (desktop + mobile).
- iOS Safari 16+ (Web Push + Service Worker fidelity).
- No support for legacy IE, old Android browsers, or WebViews lacking service workers.

---

## Resolution log

| # | Question | Resolved |
|---|---|---|
| 1 | Routing | **TanStack Router** |
| 2 | Component primitives | **Radix + custom wrappers, iOS-native look & feel** |
| 3 | i18n | **Lingui** |
| 4 | Package manager | **bun** |
| 5 | API-client regeneration | **C — dev regenerates locally, CI verifies** |
| 6 | WebSocket wrapper | **Roll our own thin reconnect wrapper** |

No further open questions. Material changes go through `plan-feature`.

---

*Picks above are mirrored in `CLAUDE.md` § *Stack*; this document remains the canonical reference for FE choices.*
