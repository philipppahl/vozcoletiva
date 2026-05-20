# vozcoletiva — brand palette & typography

Modern, civic, calm. The system reads as one material — neutrals, surfaces, borders and ink all sit on the same cool slate hue (h ≈ 240) at very low chroma. Accents share chroma (≈ 0.16) and orbit the wheel evenly so the four picker options read as siblings rather than competing brands. Indigo is the default — sleek, civic, distinct from corporate blue.

## Concept

- **Accent — Indigo.** Default. Modern and contemporary; carries trust without leaning corporate.
- **Sibling accents — Violet, Teal, Amber.** Same chroma, even spacing. Available for theming if a project wants to lean differently.
- **Neutrals — Cool slate.** h ≈ 240 at ~0.005–0.015 chroma. Calm reading surfaces in both themes.
- **States** (yes / no / abstain / warn) share chroma (~0.13–0.16) so they don't pop out of the neutral family.

The palette is defined in OKLCH; CSS-variable hex fallbacks are provided for older browsers. Target browsers (iOS 16+ Safari, Chrome 111+, Firefox 113+) all support OKLCH natively.

## Light mode

| Token | OKLCH | Approx. hex |
|---|---|---|
| `bg`         | `oklch(0.978 0.004 240)` | `#F8F9FB` |
| `surface`    | `oklch(1.000 0.000 0)`   | `#FFFFFF` |
| `surface-2`  | `oklch(0.955 0.005 240)` | `#F0F2F5` |
| `ink`        | `oklch(0.210 0.012 250)` | `#171A20` |
| `ink-soft`   | `oklch(0.460 0.015 250)` | `#54596A` |
| `ink-muted`  | `oklch(0.620 0.014 250)` | `#7A7F90` |
| `border`     | `oklch(0.920 0.006 240)` | `#E1E5EB` |
| `border-hi`  | `oklch(0.820 0.010 240)` | `#C3CAD3` |
| `field-bg`   | `oklch(0.962 0.005 240)` | `#F3F5F8` |

## Dark mode

| Token | OKLCH | Approx. hex |
|---|---|---|
| `bg`         | `oklch(0.165 0.012 250)` | `#0F1216` |
| `surface`    | `oklch(0.205 0.012 250)` | `#15191F` |
| `surface-2`  | `oklch(0.185 0.012 250)` | `#11151B` |
| `ink`        | `oklch(0.965 0.005 240)` | `#F1F3F6` |
| `ink-soft`   | `oklch(0.740 0.010 240)` | `#A6ABB5` |
| `ink-muted`  | `oklch(0.560 0.010 240)` | `#787E89` |
| `border`     | `oklch(0.290 0.012 250)` | `#252A33` |
| `border-hi`  | `oklch(0.420 0.014 250)` | `#3D4250` |
| `field-bg`   | `oklch(0.225 0.012 250)` | `#191D24` |

## Accents

All accents share chroma `0.16` (teal lower at `0.13` for legibility). Rendered at `L=0.55` on light surfaces and `L=0.72` on dark.

| Token | Hue | Label |
|---|---|---|
| **`accent-indigo`** (default) | 265 | Indigo |
| `accent-violet` | 305 | Violet |
| `accent-teal`   | 195 | Teal |
| `accent-amber`  | 70  | Amber |

Soft fills derived from the accent: `L=0.94, C=accent_c*0.3` (light) or `L=0.28, C=accent_c*0.3` (dark).

## States

| Token | OKLCH (light) | OKLCH (dark) | Use |
|---|---|---|---|
| `yes`     | `oklch(0.52 0.15 155)` | `oklch(0.74 0.15 155)` | proposal passed; affirmative vote |
| `no`      | `oklch(0.55 0.20 25)`  | `oklch(0.74 0.18 25)`  | proposal rejected; negative vote; destructive action |
| `abstain` | `oklch(0.58 0.010 250)` | `oklch(0.70 0.010 240)` | abstain vote; muted |
| `warn`    | `oklch(0.66 0.16 75)`  | `oklch(0.78 0.15 75)`  | quorum risk; closing soon |

Both themes must respect `prefers-color-scheme` with a manual override (system / light / dark) persisted in `localStorage`.

## Typography

Three families, each loaded as a single variable font file via `@fontsource-variable/*`. All are open source.

- **Display — Newsreader.** Variable transitional serif with optical sizing. Used for page titles, proposal titles, deliberation headers. Italic available; the wordmark uses italic.
- **UI — Public Sans.** Variable. Authoritative but friendly. Used everywhere else: labels, body, captions, button text.
- **Mono — JetBrains Mono.** Variable. Used for invitation codes, IDs, version markers, "PLANNED" eyebrows.

Stacks:

```
--font-display: 'Newsreader Variable', Newsreader, Georgia, serif;
--font-sans:    'Public Sans Variable', 'Public Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
--font-mono:    'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
```

Suggested scale (mobile-first):

| Token | Size / line-height | Weight | Family |
|---|---|---|---|
| display | 32 / 38 | 400 | display |
| h1      | 26 / 32 | 400 | display |
| h2      | 20 / 26 | 500 | display |
| h3      | 17 / 22 | 500 | display |
| body    | 15 / 24 | 400 | sans |
| body-sm | 13 / 20 | 400 | sans |
| caption | 11 / 16 | 600 | sans (uppercase, tracking +0.06) |
| mono-eyebrow | 10 / 14 | 600 | mono (uppercase, tracking +1.2) |

Tracking: `-0.3` on display headings, `-0.005` on body, `+0.04` on captions.

## Surfaces, radii, shadows

| Token | Light | Dark | Notes |
|---|---|---|---|
| `--radius-card`  | 18 | 18 | proposal cards, deliberation cards, surface containers |
| `--radius-field` | 14 | 14 | text inputs, textareas, sheet content |
| `--radius-button` | 12 | 12 | medium button default; sm = 10, lg = 14 |
| `--radius-pill` | 999 | 999 | pills, role badges, status pills |

Shadows are multi-layer for soft elevation:

- `--shadow-sm`: `0 1px 2px rgba(15,23,42,0.05)` (dark: `rgba(0,0,0,0.5)`)
- `--shadow-md`: `0 1px 2px rgba(15,23,42,0.05), 0 6px 18px rgba(15,23,42,0.06)`
- `--shadow-lg`: `0 4px 12px rgba(15,23,42,0.07), 0 18px 40px rgba(15,23,42,0.10)`

## Accessibility

- Body text vs background: contrast ≥ 4.5:1 in both themes.
- Indigo accent on white (`oklch(0.55 0.16 265)` ≈ `#5B5BE0`): contrast ≈ 4.7:1 — passes AA.
- Indigo accent on dark bg (`oklch(0.72 0.16 265)` ≈ `#A0A0F2`): contrast ≈ 6.1:1 — passes AA.
- Never communicate state by colour alone. Pair with icon or label (passed ✓, rejected ✕).
- Sticky chrome uses `backdrop-filter: blur(20px) saturate(180%)` over a low-opacity bg fill; falls back cleanly when the filter is unsupported.

## Usage notes

- The accent is a spotlight, not a wash. Use it for the single most important action on a screen, the focused-input ring, the unread badge, the "PLANNED" eyebrow. If everything is accent, nothing is.
- Borders prefer `--border`; reserve `--border-hi` for focused / pressed states.
- The mark (`logo-mark.svg`) carries the accent dot — when adopting a sibling accent for a project, the dot follows. The wordmark (`logo-wordmark.svg`) uses `currentColor` so it picks up `--ink`.

## Migration note (2026-05-19)

This palette replaces the earlier teal `#2A8A7B` + coral `#E07856` brand. The change was made on the back of the design integration recorded in `docs/decisions/0001-design-integration-2026-05-19.md`. The teal mark remains in `git` history; nothing else preserves it.
