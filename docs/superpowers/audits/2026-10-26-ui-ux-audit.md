# UI/UX audit — Risk Parity Compass

**Date:** 2026-10-26
**Scope:** the product (running build), the repository surface (README, docs), the deployed site, and the planned M3.5–M6 views.
**Method:** production build served locally and walked with Playwright at 1440×900 and 390×844; contrast ratios computed programmatically from the tokens in `src/App.jsx`; source review for surfaces that are not yet reachable (Portfolios tab, learning journey).

Screens reviewed: Current Holdings, Retirement (empty state), sidebar, header, mobile drawer. Screenshots captured at `.playwright-mcp/` during the audit.

---

## Verdict

The visual language is coherent and genuinely pleasant: one accent family, tonal depth instead of shadows, disciplined type scale, 44px targets. It reads as a considered tool rather than a form.

The **interaction model is where it fails**. Retirement planning — the product's headline capability — is unreachable unless a live market-data fetch succeeds, and when that fetch fails the app says nothing. On mobile, the layout breaks. A retiree who hits either problem has no path forward and no explanation.

Severity below is judged by effect on that person, not by effort to fix.

---

## Critical

### C1. Retirement planning is gated behind a successful market-data fetch
**Evidence:** on the Retirement tab with no analysis run, the only content is "Run Analysis first to generate retirement projections." The retirement inputs (spend, horizon, inflation, Social Security, pension, guardrail) are not rendered at all.

**Why it matters:** withdrawal planning needs only the portfolio balance and the user's assumptions — no live prices. Requiring a quote fetch makes the core feature depend on the least reliable part of the system. During any Yahoo outage, a CORS change, or an API block, the retiree cannot plan at all.

**Recommendation:** render the retirement form unconditionally. Gate only the *historical backtest* on data availability, with an inline explanation and a "use Monte Carlo only" fallback. This is a small change with a large reliability payoff.

### C2. Failed analysis produces no user-facing feedback
**Evidence:** clicking **Run Analysis** with the Yahoo endpoint blocked leaves the UI visually unchanged. The sidebar marks each ticker `✗ SPY` with no legend or explanation. Twenty console errors; zero on-screen messages. The Retirement tab still reads "Run Analysis first".

**Why it matters:** the user cannot distinguish "still loading", "data unavailable", and "nothing to do". Silent failure is the worst failure mode for a financial tool.

**Recommendation:** an `role="alert"` error banner above the results area with the cause in plain language ("Market data unavailable — retirement projections need price history. You can still enter your plan and run the Monte Carlo with a custom expected return."), a per-ticker failure list, and a retry action. This is already Task 8 in the M3.5 plan for `retirementResults.error`; extend it to the analysis path.

### C3. Mobile layout is broken at 390px
**Evidence:** at 390×844 the sidebar drawer is open over the content, the `<h1>` wraps and collides with the menu button, the tab strip is clipped ("Retiremen…"), card content is cut off at the right edge, and the fixed bottom action bar overlaps the last card.

**Why it matters:** the audit's own `ux.spec.js` asserts the primary action is inside the viewport on mobile, and that test passes — so the *measured* requirement is narrower than the *actual* one. A phone user cannot read the page.

**Recommendation:** fix the drawer to be closed by default, constrain the header title (truncate or shrink), make the tab strip horizontally scrollable with a visible affordance, add `padding-bottom` equal to the action-bar height on `main`, and add an E2E assertion that `document.documentElement.scrollWidth <= innerWidth` at 390px.

### C4. The numbers presented as answers are wrong and look authoritative
**Evidence:** see `docs/superpowers/reviews/2026-10-26-code-review-m1-m3.md`. SWR is overstated roughly 2–2.5×, Monte Carlo success is 0% or 100% regardless of input, guardrails raise spending when they trip.

**Why it matters:** this is a UX finding, not only an engineering one. The interface gives no uncertainty signal, no assumption summary next to the metric, and no indication that a number is unreliable. A confident wrong number is worse than no number.

**Recommendation:** M3.5 fixes the arithmetic. In addition, every metric card should carry its basis — horizon actually used, drift assumption, guardrail policy — and the fan chart should display the assumption set above it. When `effectiveYears < horizonYears`, say so next to the number, not below the chart.

---

## High

### H1. Duplicate account-balance entry with no explanation
The sidebar has editable Taxable / Traditional / Roth balances, and the Current Holdings tab repeats them as read-only "Balance: $50,000" captions. The user cannot tell which one drives the calculations (the sidebar does) or why the same figure appears twice. **Recommendation:** label the holdings captions "Account balance (edit in sidebar)" or move the balances into the tab and remove the sidebar duplication.

### H2. Header total is ambiguous
"Total: $100,000" is the sum of account balances, not the market value of holdings. With zero holdings entered it still reads $100,000. **Recommendation:** label it "Account total" and show holdings value separately once prices are known, or show both as "Balances $100,000 · Holdings $—".

### H3. Warning colour is used for ordinary instruction
The Current Holdings guidance banner ("Enter your current share counts per account…") uses the warning palette (amber text on `#1c1200`). Warning should mean "something needs attention". **Recommendation:** use a neutral info surface (surface + border, muted text) for guidance, and reserve amber for stale results and data problems.

### H4. Sidebar footer is clipped
At 900px viewport height the disclaimer ("Uses Yahoo Finance unofficial API. Data is for planning only — not financial advice…") is cut mid-sentence with no scroll affordance and no visual indication that more exists. **Recommendation:** make the sidebar footer a fixed region that is always fully visible, or move the disclaimer into the main content footer.

### H5. Contrast shortfalls below AA
Measured: white on the cyan end of the primary gradient (#0891b2) = **3.68:1**; `#dc2626` on surface = **3.81:1**. Both fail AA for normal text. Everything else measured at 7:1 or better. **Recommendation:** keep the primary button label at 15px semibold and shift the gradient's bright end toward `#0e7490` (≈4.6:1), or darken the gradient midpoint. Use `#fca5a5` rather than `#dc2626` for any small red text. Recorded in `DESIGN.md`.

### H6. No favicon or theme colour
`index.html` declares language, title and description, but no icon and no `theme-color`. A dark app with a default browser tab icon reads as unfinished, and mobile browser chrome renders white above a navy page. **Recommendation:** add an inline SVG favicon matching the ⚖ mark and `theme-color` `#0a0f1e`.

### H7. Tab state is not in the URL
Refreshing returns to Current Holdings and the retirement inputs are lost (they are not persisted at all — review Important #9). The user cannot bookmark the Retirement view or send it to a spouse or adviser. **Recommendation:** reflect the tab in the URL (`#retirement` or `?tab=retirement`) and persist retirement inputs with the rest of the state. Persistence is already in the M3.5 plan; URL state belongs in M4.

---

## Medium

### M1. The Retirement empty state is 400px of nothing
A single centred sentence in an otherwise blank panel gives no orientation, no sample plan, and no statement of what the user will get. **Recommendation:** a three-line explanation of what the tab computes and one "Use a sample plan" action.

### M2. Numeric inputs are unformatted
`50000` rather than `50,000`. For a six- or seven-figure portfolio this is a real reading cost, and a mistyped zero is easy. **Recommendation:** format on blur with thousands separators, keep raw values in state.

### M3. Version link is misleading outside CI
The footer renders "v0.1.0-alpha.1 · local" and links to `…/commit/local`, which 404s. **Recommendation:** when `GITHUB_SHA === 'local'`, render "dev build" without a link.

### M4. "Advanced" disclosure has no state cue
The disclosure hides lookback and threshold; its arrow rotates, but there is no summary of the current values while collapsed. **Recommendation:** show a muted summary line ("6mo lookback · 5% threshold").

### M5. Labels are small for the target audience
12px uppercase labels at 0.06em are legible on desktop but at the low end for a 65-year-old user, and the font-scale control is scheduled for M5. **Recommendation:** raise the base label size to 13px when the M5 font-scale work lands, and treat 100% as ≥16px body — not as a 14px baseline.

### M6. No loading state on the primary action
Analysis can take several seconds for five tickers. The button appears to do nothing. **Recommendation:** a disabled state with a progress label ("Fetching prices… 3 of 5").

---

## Planned surfaces

**M4 — Portfolios tab and comparison.** The three-way comparison must not distinguish portfolios by colour alone; label every series and keep the same metric-card structure used on Retirement. Loading a template must visibly change the sidebar tickers, otherwise the action looks inert.

**M5 — Accessibility preferences.** Font scale, high contrast, print CSS and PDF must all be reachable from the header, not buried in the sidebar. Print output must be light-background: the dark theme is unreadable on paper and wastes ink, so the print stylesheet is a redesign, not a colour inversion.

**M6 — Learning journey.** Three constraints from the learning-science research (`docs/superpowers/research/2026-10-26-investor-levels-and-learning-science.md`): never gate a calculation behind a lesson; show progress as "what you can now do", not as a score; and make every module skippable. Streaks, badges and loss-framed nudges are excluded — they are not supported by the evidence for adult learners and they conflict with the product's credibility.

---

## What to do first

1. **C1 + C2 with M3.5** — unconditional retirement form, real error banner. These are the difference between a tool that works during an outage and one that does not.
2. **C3** — mobile layout, with a scroll-width assertion in `ux.spec.js` so it cannot regress.
3. **C4** — arithmetic (M3.5), plus the basis/assumption labels on every metric card.
4. **H1–H4, H6** — small, independent, visible improvements.
5. **H5, H7, M1–M6** — batch into M4/M5 with the design-system work.

The repository surface is in reasonable shape after the rename: README leads with what the tool does and states the roadmap honestly. It needs one screenshot of the Retirement tab and a GitHub repository description/topics refresh. The deployed site is the product itself — no separate marketing surface is needed, but the first-run empty state has to carry the orientation that a landing page would normally provide.
