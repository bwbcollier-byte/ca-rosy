# Rosy Recruits Design System

*Last updated: 2026-05-19. Extracted from [project/styles.css](project/styles.css) `:root` block — that file is the runtime truth. When values diverge, the code wins, then this file gets updated.*

## Register

**Product app.** Rosy Recruits is a recruitment platform UI — gig management, talent matching, brand work. The interface serves daily operational use: lists, cards, forms, sidebar nav, status states. Design supports task density without feeling clinical. Warmth is a feature, not a decoration.

## Aesthetic Position

**Clay-skinned product.** Cream canvas (`#fffaf0`) with a soft serif display (Recoleta), sans body (Manrope), and saturated brand pals living inside feature cards and badges. Coral + teal are the brand axes; everything else stays in clay-warm neutrals. Soft shadows allowed, hairlines preferred.

The inverse of a terminal app: warm where Rmtctrl is cold, light where PromptKit is dark, soft-edged where HypeBase is shadcn-strict.

**Anti-references:** Generic recruiter-blue SaaS. Cold pure white #fff backgrounds. Stripe-clone gradients. Dribbble glassmorphism. Light-on-dark hero with neon accent (that's Rmtctrl's lane).

## Color System

### Clay base (canvas + surfaces)

| Token | Hex | Role |
|---|---|---|
| `--color-canvas` | `#fffaf0` | Page background. Warm cream, never pure white. |
| `--color-surface-soft` | `#faf5e8` | Soft elevated surface. |
| `--color-surface-card` | `#f5f0e0` | Card surface. |
| `--color-surface-strong` | `#ebe6d6` | Strong elevated surface, panels. |
| `--color-surface-dark` | `#0a1a1a` | Dark inverse surface (footer, dark cards). |
| `--color-hairline` | `#e5e5e5` | Standard 1px divider. |
| `--color-hairline-strong` | `#d6d4cc` | Strong divider, section breaks. |

### Text (warm-neutral ramp)

| Token | Hex | Role |
|---|---|---|
| `--color-ink` | `#0a0a0a` | Primary text, headings. |
| `--color-body-strong` | `#1a1a1a` | Strong body. |
| `--color-body` | `#3a3a3a` | Body copy. |
| `--color-muted` | `#6a6a6a` | Metadata, captions. |
| `--color-muted-soft` | `#9a9a9a` | Soft muted, placeholders. |

### Rosy brand accents

| Token | Hex | Role |
|---|---|---|
| `--rosy-coral` | `#E8473F` | Primary brand accent, CTAs, active states. |
| `--rosy-coral-hover` | `#D03B33` | Coral hover state. |
| `--rosy-coral-soft` | `#FEF2F1` | Coral soft background. |
| `--rosy-coral-border` | `#FCCAC7` | Coral border treatment. |
| `--rosy-teal` | `#1ABCB0` | Secondary accent, focus, "alive" indicators. |
| `--rosy-teal-hover` | `#138F85` | Teal hover. |
| `--rosy-teal-dark` | `#0E6B63` | Teal pressed. |
| `--rosy-teal-soft` | `#E6F9F8` | Teal soft background. |
| `--rosy-teal-border` | `#A7EDE9` | Teal border treatment. |

**Strategy:** Coral does CTAs and active-state lift; teal does focus rings and live-indicators. The two never compete in the same component.

### Saturated brand pals (taxonomy, used inside cards/badges)

| Token | Hex | Role |
|---|---|---|
| `--color-brand-pink` | `#ff4d8b` | Tag/badge typing. |
| `--color-brand-lavender` | `#b8a4ed` | Tag/badge typing. |
| `--color-brand-peach` | `#ffb084` | Tag/badge typing. |
| `--color-brand-ochre` | `#e8b94a` | Tag/badge typing. |
| `--color-brand-mint` | `#a4d4c5` | Tag/badge typing. |
| `--color-brand-coral` | `#ff6b5a` | Tag/badge typing. |
| `--color-brand-teal` | `#1a3a3a` | Dark-mode brand surface. |

Use deliberately for content typing (gig type chips, badges). Never as page-level decoration.

### Gig type chips (locked palette)

| Type | Background | Text |
|---|---|---|
| Strike | `#EEF2FF` | `#4F46E5` |
| Lead | `#F0FDF4` | `#16A34A` |
| Design | `#FFFBEB` | `#B45309` |
| Assist | `#FEF2F1` | `#E8473F` |

### Status

| Token | Hex | Background |
|---|---|---|
| `--color-success` | `#16A34A` | `#DCFCE7` |
| `--color-warning` | `#D97706` | `#FEF3C7` |
| `--color-error` | `#DC2626` | `#FEE2E2` |
| `--color-info` | `#1D4ED8` | `#EFF6FF` |

## Typography

| Role | Font | CSS Variable | Weights |
|---|---|---|---|
| Display | Recoleta (fallback Fraunces, Georgia) | `--font-display` | 500, 600 |
| Body / UI | Manrope (fallback system-ui) | `--font-body` | 400, 500, 600, 700, 800 |
| Data / mono | JetBrains Mono (fallback SF Mono) | `--font-mono` | 400, 500 |

Loaded via Google Fonts in [project/styles.css](project/styles.css) line 7. Three families; never a fourth.

**Display strategy:** Recoleta is a soft serif used at weight 500 with tight tracking (`-0.02em` to `-0.03em`). Display sizes use `clamp()` to scale fluidly:
- `.display-xl` — `clamp(48px, 6vw, 72px)`, line-height 1.0
- `.display-lg` — `clamp(40px, 4.5vw, 56px)`, line-height 1.05
- `.display-md` — 40px, line-height 1.1
- `.display-sm` — 30px, line-height 1.15

**Body scale (`--text-*`):** 0.75rem · 0.875rem · 1rem · 1.125rem · 1.25rem · 1.5rem · 1.875rem · 2.25rem · 3rem · 3.75rem.

**Eyebrows:** 12px, weight 600, letter-spacing `0.12em`, uppercase, `--color-muted`.

**Portfolio convention applied:** data is JetBrains Mono. Rosy uses it for IDs, timestamps, currency, tabular numerics via the `.t-mono` utility (includes `font-variant-numeric: tabular-nums`). See `Rascals Inc HQ/AI Staff Resources/decisions.md` 2026-05-17.

## Layout

### Shell

| Token | Value |
|---|---|
| `--sidebar-width` | `256px` |
| `--header-height` | `72px` |
| Sidebar collapsed | `72px` |

Shell pattern: 2-column grid (sidebar + main). Sidebar is sticky, full-height, scrollable on overflow. Header is sticky inside main, z-index 10. `.no-chrome` variant collapses to single column for landing/auth surfaces.

### Sidebar variants

- Default — accent-fill active state.
- `.style-bar` — left accent bar, transparent active background.
- `.style-subtle` — soft accent background on active.
- `.dark` — dark inverse (`#131312` bg, `#f5f0e0` text).

### Radius scale

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | 4px | Hairline controls. |
| `--radius-sm` | 8px | Inputs, small chips. |
| `--radius-md` | 12px | Buttons, nav items. |
| `--radius-lg` | 16px | Cards. |
| `--radius-xl` | 24px | Feature blocks. |
| `--radius-pill` | 9999px | Pills, badges. |

Container corners use the scale; never introduce ad-hoc values.

### Spacing

Density tokens:
- `--row-py` — `14px` (row vertical padding)
- `--card-pad` — `24px`

Header padding `0 32px`. Sidebar padding `20px 12px 16px`.

## Motion

Centralised, no bounce, no elastic.

**Easing:**
- `--ease-out-quart` — `cubic-bezier(0.25, 1, 0.5, 1)`
- `--ease-out-quint` — `cubic-bezier(0.22, 1, 0.36, 1)`
- `--ease-out-expo` — `cubic-bezier(0.16, 1, 0.3, 1)`

**Duration:**
- `--dur-fast` — 140ms (hover, button states)
- `--dur-base` — 220ms (default)
- `--dur-medium` — 320ms (drawers, panels)
- `--dur-slow` — 480ms (page-level)

**Rules:** ease-out only. No spring on UI. Reduced-motion preference respected.

## Shadows

Allowed — this is the one Rascals product where soft shadows are part of the visual system (the others are hairline-only).

| Token | Use |
|---|---|
| `--shadow-soft` | Cards at rest. `0 1px 2px rgba(10, 10, 10, 0.04)` |
| `--shadow-hover` | Card hover. `0 8px 24px rgba(10, 10, 10, 0.06)` |
| `--shadow-modal` | Modals. `0 24px 48px rgba(10, 10, 10, 0.16), 0 0 0 1px rgba(10, 10, 10, 0.04)` |
| `--shadow-focus` | Focus ring. `0 0 0 3px rgba(26, 188, 176, 0.22)` (teal-tinted) |

## Focus and Accessibility

- Focus ring uses `--shadow-focus` (3px teal halo). Visible on every interactive element. Never `outline: none`.
- Body text minimum 16px (`--text-base = 1rem`).
- Hover transitions 120ms ease on background/color only.

## Hard Rules

1. **Canvas is `#fffaf0`, never `#fff`.** Pure white is reserved for sidebar active text on coral fill.
2. **Coral and teal never co-occur as primary in the same surface.** Pick one per page region.
3. **Data uses `.t-mono`.** Tabular numerics get JetBrains Mono with `tabular-nums`.
4. **Container corners come from the 6-slot radius scale.** No `15px`, no `18px`, no inline radius.
5. **Saturated brand pals live inside cards/badges only.** Never as page background.
6. **Motion is ease-out only.** No spring, no bounce, no elastic.

## Scope Wall

Rosy Recruits is **client work**, not a Rascals brand. It does NOT inherit the Rascals admin token vocabulary (`ink-*` / `line-*`). It does NOT inherit hype.works pink, drop.limited lime, PromptKit mint+UV, or roam.limited terminal-green. The clay+coral+teal palette is the client's brand.

## Open Questions

- **Dark mode coverage** — sidebar has a `.dark` variant but a full dark-mode token mapping is not yet defined. If the client requests dark mode, build a `[data-theme="dark"]` shadow palette before shipping.
- **Density modes** — `--row-py` and `--card-pad` are flagged "tweakable" in source. No `[data-density]` switcher exists yet; if multi-density is requested, port the HypeBase pattern.

## Implementation Files

- [project/styles.css](project/styles.css) — runtime tokens (CSS variables, utility classes, shell, sidebar, header)
- [index.html](index.html) — single-page app shell
- [project/src/](project/src) — JS components
