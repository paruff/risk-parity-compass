---
version: alpha
name: Risk Parity Compass
description: Dark, dense, data-first interface for a risk parity rebalancing and retirement drawdown planner. Slate neutrals on a deep navy field with a single blue-to-cyan accent, inline styles only, no CSS framework.
colors:
  background: "#0a0f1e"
  surface: "#0d1424"
  surface-input: "#131d2e"
  border: "#1e293b"
  border-strong: "#334155"
  divider: "#0f172a"
  on-surface: "#e2e8f0"
  on-surface-strong: "#f1f5f9"
  on-surface-secondary: "#cbd5e1"
  on-surface-muted: "#94a3b8"
  primary: "#3b82f6"
  primary-deep: "#1d4ed8"
  secondary: "#0891b2"
  focus: "#93c5fd"
  positive: "#16a34a"
  positive-surface: "#14532d"
  on-positive: "#86efac"
  negative: "#dc2626"
  negative-surface: "#4c0519"
  on-negative: "#fca5a5"
  warning: "#fbbf24"
  warning-strong: "#f59e0b"
  accent: "#60a5fa"
  negative-text: "#f87171"
  positive-text: "#4ade80"
  warning-surface: "#1c1200"
  warning-border: "#92400e"
  error-surface: "#1a0808"
  error-border: "#7f1d1d"
typography:
  title:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.01em
  subtitle:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
  metric-value:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.02em
  metric-label:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
  section-title:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: 0.08em
  card-title:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: 0.06em
  label:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0.06em
  body:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  control:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.4
  table-head:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0.06em
  table-cell:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  data-mono:
    fontFamily: ui-monospace, SFMono-Regular, Menlo, monospace
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  pill:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.2
rounded:
  xs: 2px
  sm: 6px
  md: 8px
  lg: 10px
  pill: 100px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  xxl: 28px
  control-gap: 10px
  card-padding-x: 18px
  card-padding-y: 16px
  touch-target: 44px
  sidebar-width: 260px
components:
  button-primary:
    backgroundColor: "{colors.primary-deep}"
    textColor: "#ffffff"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: 12px
    height: "{spacing.touch-target}"
  button-primary-disabled:
    backgroundColor: "{colors.primary-deep}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
  input:
    backgroundColor: "{colors.surface-input}"
    textColor: "{colors.on-surface}"
    typography: "{typography.control}"
    rounded: "{rounded.sm}"
    padding: 11px
    height: "{spacing.touch-target}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface-secondary}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card-padding-y}"
  tab-active:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface}"
    typography: "{typography.control}"
    height: "{spacing.touch-target}"
  tab-inactive:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface-muted}"
    typography: "{typography.control}"
    height: "{spacing.touch-target}"
  pill-buy:
    backgroundColor: "{colors.positive-surface}"
    textColor: "{colors.on-positive}"
    typography: "{typography.pill}"
    rounded: "{rounded.pill}"
    padding: 4px
  pill-sell:
    backgroundColor: "{colors.negative-surface}"
    textColor: "{colors.on-negative}"
    typography: "{typography.pill}"
    rounded: "{rounded.pill}"
    padding: 4px
  pill-neutral:
    backgroundColor: "{colors.border}"
    textColor: "{colors.on-surface-muted}"
    typography: "{typography.pill}"
    rounded: "{rounded.pill}"
    padding: 4px
  banner-warning:
    backgroundColor: "{colors.warning-surface}"
    textColor: "{colors.warning}"
    typography: "{typography.subtitle}"
    rounded: "{rounded.md}"
    padding: 10px
  banner-error:
    backgroundColor: "{colors.error-surface}"
    textColor: "{colors.on-negative}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: 12px
  table-head:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface-muted}"
    typography: "{typography.table-head}"
    padding: 10px
  table-cell:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface-secondary}"
    typography: "{typography.table-cell}"
    padding: 12px
  metric-value:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface-strong}"
    typography: "{typography.metric-value}"
  metric-label:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface-muted}"
    typography: "{typography.metric-label}"
---

# Risk Parity Compass — Design System

## Overview

Risk Parity Compass is a **dark, dense, data-first** planning tool. Its audience is a self-directed investor — often someone within a decade of retirement — who is comfortable reading a table of numbers and wants the arithmetic, not reassurance. The interface should feel **calm, precise and institutional**: a trading terminal stripped of decoration, where colour carries meaning and nothing competes with the data.

Two emotional notes matter. First, **credibility**: a tool that tells you how much you can safely spend must look like it takes that seriously. Second, **non-anxious clarity**: retirement projections are frightening; the UI lowers the temperature by keeping the layout stable, the language plain, and the numbers legible.

Layout is a fixed header, a persistent 260px control sidebar, and a scrolling main panel. On mobile the sidebar becomes an off-canvas drawer with a backdrop, and the primary action moves to a fixed bottom bar.

**Domain references.** The retirement views follow the vocabulary of Risk Parity Radio (safe/perpetual withdrawal rate, RMD, withdrawal sequencing, spending guardrails) and the work of the Guyton-Klinger and VPW literature. Visual references: Portfolio Charts, FIRECalc and cFIREsim for chart style; Bogleheads wiki tables for density.

## Colors

The palette is built for long reading sessions on a dark field. There is exactly one accent family — blue through cyan — and colour otherwise means **direction** (buy/sell) or **attention** (warning/error). Nothing is coloured for decoration.

- **Background (#0a0f1e):** The page field. Deep enough that the surface layer reads as raised without a shadow.
- **Surface (#0d1424):** Cards, header, sidebar. One step up from the field; the only elevation mechanism in the product.
- **Surface-input (#131d2e):** Form controls, one more step up so an input is distinguishable from the card it sits in.
- **Border (#1e293b) / Divider (#0f172a):** Structure. The border separates regions; the divider separates table rows.
- **On-surface (#e2e8f0):** Default text.
- **On-surface-strong (#f1f5f9):** Headings and metric values only.
- **On-surface-muted (#94a3b8):** Labels, captions, table headers, inactive tabs. Deliberately still 7.17:1 on surface — muted does not mean low-contrast.
- **Primary (#3b82f6) / Primary-deep (#1d4ed8) / Secondary (#0891b2):** The accent family. `primary` marks active state and links; the `primary-deep → secondary` gradient is reserved for the single most important action on a screen.
- **Focus (#93c5fd):** A 2px focus ring on every interactive element, 2px offset. Never removed.
- **Positive (#16a34a) / Negative (#dc2626):** Overweight-vs-target bars, gains and losses on a chart.
- **Warning (#fbbf24) on #1c1200, Error (#fca5a5) on #1a0808:** Banners for stale results and calculation failures.

**Measured contrast (WCAG 2.1, computed):** body 15.49:1, heading 17.43:1, muted 7.17:1, table body 12.38:1, input 13.71:1, warning 11.07:1, error 10.22:1, focus ring 10.59:1 — all AA or better. Two pairs fall short of AA for normal text and are restricted to large text or non-text use: **white on the cyan end of the button gradient (#0891b2) is 3.68:1** and **#dc2626 on surface is 3.81:1**. The gradient is therefore acceptable for the 15px semibold primary button only if the label stays on the deeper half, and red text is used for bars and large numerals, never for small body copy.

## Typography

One family, **Inter**, with a system fallback. Monospace (`ui-monospace`) is used only for ticker symbols and price columns, where digit alignment matters.

- **Title (18px/600/-0.01em):** The product name in the header, once.
- **Subtitle (13px/400):** The one-line descriptor beside the title. Hidden on mobile to protect the header height.
- **Metric value (24px/700/-0.02em):** The headline number in a metric card. Maximum two per row on mobile.
- **Metric label (12px/400):** Sits directly under its value; never bold, never coloured.
- **Section title (13px/700/uppercase/0.08em):** Sidebar group headings, with a bottom border.
- **Card title (13px/700/uppercase/0.06em):** The title inside a result card.
- **Label (12px/600/uppercase/0.06em):** Form labels. Uppercase tracking is the only "designed" flourish in the product.
- **Body (16px/400):** Prose, banners, disclaimers.
- **Control (15px/400):** Inputs, buttons, tabs.
- **Table head (12px/600/uppercase) / Table cell (14px/400):** The dominant surface of the app. Numbers right-align; text left-aligns.

Uppercase is reserved for labels and section headings, and is always paired with letter-spacing. Never uppercase a sentence of prose.

## Layout

A **fixed-shell, fluid-main** model:

- Header: 62px, sticky, containing the mark, product name, subtitle and total portfolio value.
- Body: `calc(100vh - 62px)`, split into a **260px fixed sidebar** (controls) and a fluid main panel that scrolls independently.
- Main panel padding: 20px vertical, 24px horizontal. Cards stack with a 14px gap.
- Spacing follows a 4px scale with 4/8/12/16/20/28 in practice. Form controls use a 10px gap.
- Every interactive control is at least **44×44px**, including icon buttons and tab targets.
- Two-column metric grids collapse to one column below 640px. Tables scroll horizontally with a sticky first column.
- On mobile the sidebar becomes an off-canvas drawer with a dimming backdrop, and the primary action is pinned to a fixed bottom bar so it is always reachable.

No content is wider than the main panel; nothing is centred in a narrow column. This is a working surface, not a landing page.

## Elevation & Depth

Depth is **tonal, not shadowed**. There is no box-shadow anywhere in the product. A raised element is simply a lighter surface: `background` → `surface` → `surface-input`. Cards are identified by their tone change plus a 1px `border`; nothing floats.

This keeps the interface flat, printable, and immune to the muddy shadows that dark themes produce. The single exception is the mobile bottom action bar, which uses a top border rather than a shadow to separate itself from scrolling content.

## Shapes

Shape language is **engineered softness**:

- `2px` — chart bars and inline micro-elements
- `6px` — inputs and selects
- `8px` — buttons and banners
- `10px` — cards
- `100px` — pills (buy / sell / neutral)
- `8px` — the header mark, a rounded square carrying the ⚖ glyph

The radius never exceeds 10px on a rectangle. Nothing is fully circular except pills. Consistent radii are what make an inline-styled single-file app read as a designed product rather than a form.

## Components

**Buttons.** One primary button per screen: full width in the sidebar, 44px tall, `rounded.md`, `primary-deep → secondary` gradient, white 15px semibold label. Disabled state drops opacity to 0.45 and desaturates — it never changes colour to grey. Secondary actions are text buttons with no background.

**Inputs.** 44px min height, `surface-input` background, 1px `border`, `rounded.sm`, 15px text. Labels sit above the control, uppercase 12px. Helper text is 13px muted below the field. Errors are announced through a banner, not inline red borders.

**Cards.** The primary container for results: `surface`, 1px border, `rounded.lg`, 16px/18px padding, 14px bottom margin. Title is uppercase 13px muted. Cards never nest more than one level.

**Tabs.** Underline-style, 44px tall, 12px/16px padding. Active: 2px `primary` bottom border, `on-surface` text, weight 600. Inactive: transparent border, muted text, weight 400. Arrow keys move between tabs; `role="tablist"` and `aria-controls` are mandatory.

**Tables.** Full width, collapsed borders, 12px uppercase muted headers, 14px `on-surface-secondary` cells, 1px `divider` row borders. First column is sticky on horizontal scroll. Numbers right-align and use tabular figures.

**Pills.** Buy: `positive-surface` / `on-positive`. Sell: `negative-surface` / `on-negative`. Neutral: `border` / muted. 12px semibold, `rounded.pill`, 4px/9px padding.

**Banners.** Warning for stale results (`warning-surface`, `warning` text, `warning-border`). Error for calculation failure (`error-surface`, `on-negative` text, `error-border`). Both are 8px radius and appear directly above the content they qualify — never as a toast.

**Metric cards.** A 24px value over a 12px muted label. At most four per row on desktop, two on tablet, one on mobile.

**Charts.** Hand-rolled SVG, no chart library. Series colours come from the accent family; the fan chart uses opacity steps of `primary`; the drawdown chart uses `negative` for underwater area and `positive` for recovery.

## Do's and Don'ts

- **Do** use inline styles. There is no stylesheet, no CSS framework, and no CSS-in-JS library — this is an architectural rule, not a preference.
- **Do** keep `src/App.jsx` the single source of UI. Extract a component only when logic is reused (ErrorBoundary, Tooltip, RiskContribution, CorrelationMatrix, PerformanceChart).
- **Do** preserve the 44px touch target on every control, including icon-only buttons.
- **Do** label every input with a matching `htmlFor`/`id`, and give every chart a text alternative or a table fallback.
- **Do** keep a visible focus ring (`2px #93c5fd`, offset 2px) on buttons, links, tabs, selects, textareas and tooltip triggers.
- **Do** keep muted text at or above 7:1 against its surface — "muted" describes role, not legibility.
- **Do** show the RMD table version and the disclaimer next to any retirement projection.
- **Don't** introduce a second accent colour, a shadow, or a radius above 10px on a rectangle.
- **Don't** rely on colour alone: buy/sell is also signalled by the label and the sign of the number.
- **Don't** place small text on the cyan end of the primary gradient (3.68:1). Keep button labels at 15px semibold or place them on the `primary-deep` half.
- **Don't** use `#dc2626` for small text on surface (3.81:1); use it for bars and large numerals, and `on-negative` for text.
- **Don't** animate anything that carries meaning. Transitions are limited to bar widths and drawer movement, and must respect `prefers-reduced-motion`.
- **Don't** add a dependency for a visual effect. Confetti is implemented in ~20 lines for a reason.
