# vozcoletiva — brand palette & typography

Civic, warm, modern. Not corporate-blue. The palette has to read confidently in both light and dark mode and stay legible at small mobile sizes.

## Concept

- **Primary — Teal.** Trustworthy and civic without being a SaaS-blue cliché. Carries the "voice" association (cool but alive).
- **Accent — Warm coral.** Humanity, energy, warmth. Pulls the eye to the one thing that matters on a screen.
- **Neutrals — Cool slate.** Calm reading surfaces in both themes.

## Brand colors

### Primary — Teal

| Token | Hex |
|---|---|
| primary-50  | `#ECFAF7` |
| primary-100 | `#D2F3EA` |
| primary-200 | `#A7E5D5` |
| primary-300 | `#76D2BC` |
| primary-400 | `#4ABEA4` |
| **primary-500 (brand)** | **`#2A8A7B`** |
| primary-600 | `#1F6A60` |
| primary-700 | `#185349` |
| primary-800 | `#134139` |
| primary-900 | `#0E332D` |

### Accent — Warm coral

| Token | Hex |
|---|---|
| accent-50  | `#FDF2EE` |
| accent-100 | `#FBE0D6` |
| accent-200 | `#F6BEAB` |
| accent-300 | `#EE9779` |
| accent-400 | `#E5805F` |
| **accent-500 (brand)** | **`#E07856`** |
| accent-600 | `#BD5F3F` |
| accent-700 | `#964A30` |
| accent-800 | `#6F3725` |
| accent-900 | `#4F271A` |

### Neutral — Cool slate

| Token | Hex |
|---|---|
| neutral-50  | `#F7F9FA` |
| neutral-100 | `#EEF1F4` |
| neutral-200 | `#DCE2E7` |
| neutral-300 | `#BCC5CD` |
| neutral-400 | `#8B96A1` |
| neutral-500 | `#5E6975` |
| neutral-600 | `#424B55` |
| neutral-700 | `#2D353D` |
| neutral-800 | `#1B2128` |
| neutral-900 | `#0E1216` |

### Semantic

| Token | Hex | Use |
|---|---|---|
| success | `#16A34A` | proposal passed, action confirmed |
| warning | `#D97706` | quorum risk, voting closing soon |
| danger  | `#DC2626` | destructive action, proposal rejected, error |
| info    | `#2A8A7B` | alias of primary-500 |

## Surface tokens (theme mapping)

| Role | Light | Dark |
|---|---|---|
| background        | `neutral-50` (#F7F9FA) | `neutral-900` (#0E1216) |
| surface           | `#FFFFFF`              | `neutral-800` (#1B2128) |
| surface-raised    | `neutral-100`          | `neutral-700`           |
| border            | `neutral-200`          | `neutral-700`           |
| border-strong     | `neutral-300`          | `neutral-600`           |
| text-primary      | `neutral-900`          | `neutral-50`            |
| text-secondary    | `neutral-600`          | `neutral-300`           |
| text-muted        | `neutral-500`          | `neutral-400`           |
| brand             | `primary-500`          | `primary-400`           |
| brand-hover       | `primary-600`          | `primary-300`           |
| accent            | `accent-500`           | `accent-400`            |
| focus-ring        | `primary-400`          | `primary-300`           |

Both themes must respect `prefers-color-scheme` with a manual override (system / light / dark).

## Typography

- **Sans (UI + body):** [Inter](https://rsms.me/inter/), variable. Pragmatic, open source, excellent at small sizes, supports both EN and PT diacritics cleanly.
- **Mono (code, vote IDs, hashes):** [JetBrains Mono](https://www.jetbrains.com/lp/mono/), variable.
- Stack: `Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.

Suggested scale (mobile-first; desktop scales 1× or 1.125×):

| Token | Size / line-height | Weight |
|---|---|---|
| display | 32 / 38 | 700 |
| h1 | 24 / 30 | 700 |
| h2 | 20 / 26 | 600 |
| h3 | 17 / 24 | 600 |
| body | 16 / 24 | 400 |
| body-sm | 14 / 20 | 400 |
| caption | 12 / 16 | 500 |

Tracking: `-0.01em` on headings, `0` on body, `0.02em` on caption-as-label.

## Accessibility

- Body text vs background: contrast ≥ 4.5:1 in both themes (use `text-primary` / `background`).
- Brand on white (`primary-500` on `#FFFFFF`): contrast ≈ 4.6:1 — passes AA for body.
- Brand on dark (`primary-400` on `neutral-900`): contrast ≈ 5.2:1 — passes AA.
- Never communicate state by colour alone. Pair with icon or label (passed ✓, rejected ✕, etc.).

## Usage notes

- The accent (coral) is a spotlight, not a wash. Use it for the single most important action on a screen, the proposal type badge, key empty-state CTAs. If everything is coral, nothing is.
- Borders prefer `border` (subtle); reserve `border-strong` for focus and emphasis.
- The mark (`logo-mark.svg`) is self-contained (rounded teal square with white V + coral dot) and works on any background. The wordmark (`logo-wordmark.svg`) uses `currentColor` for the text so it adopts the page's text colour automatically.
