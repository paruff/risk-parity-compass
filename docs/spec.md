# Spec — Risk Parity Compass

**Status:** Current as of 2026-10-28 (M1–M7 merged)
**Intent:** `docs/intent.md` · **Plan:** `docs/plan.md` · **Review rules:** `REVIEW.md` · **Design:** `DESIGN.md`
**History and rationale:** `docs/superpowers/specs/2026-10-25-retirement-production-roadmap-design.md` (the long-form roadmap spec; this file is the working summary).

## 1. System

Static React 18 + Vite SPA on GitHub Pages. All state in `localStorage`. No backend. The browser fetches only same-origin static files: the price snapshot in `public/prices/` (written server-side by `scripts/update-prices.mjs`), the IRS RMD table and the 1928–2025 long-run returns are bundled static JSON.

```
src/
  App.jsx                 shared state, effects, layout; inline styles
  tabs/                   Holdings, Analysis, Trades, Retirement tab bodies (props from App)
  PortfoliosTab.jsx       Portfolios tab (self-contained data flow)
  LearnTab.jsx            learning journey
  tokens.js               colour tokens mirroring DESIGN.md
  utils/finance.js        vol, ERC weights, trades, tax location, quote + monthly fetch, correlation
  utils/withdrawal.js     drawdown, SWR/PWR, Monte Carlo, RMD, guardrails, sequencing
  utils/portfolioPath.js  weight-normalised backtest series
  utils/portfolios.js     RPR templates, macro classes, diversification score, comparison helpers
  utils/longRun.js        1928-2025 proxy map, proxy portfolio path, rolling metrics on it
  utils/long-run-returns.json  annual returns (Damodaran; CPI via FRED), sources recorded in the file
  utils/rmd-tables.json   versioned IRS Uniform Lifetime Table
  components/             charts (FanChart, DrawdownBacktestChart, WeightBar, Confetti), ErrorBoundary, Tooltip, RiskContribution, CorrelationMatrix, PerformanceChart, PlanTools
  mocks/handlers.js       MSW handlers for the price snapshot files
  utils/priceSnapshot.js  loads public/prices/<TICKER>.json; builds snapshots from Yahoo charts
scripts/update-prices.mjs  server-side snapshot refresh (npm run prices:update)
tests/e2e/                Playwright with route-intercepted snapshot mocks (tests/e2e/helpers/mockPrices.js)
```

Persistence keys: `rpcompass_state`, `rpcompass_scenarios`, `rpcompass_pricecache` (schemaVersion 2). Legacy `shannonsdemon_*` keys and plan files with `app: "shannonsdemon"` are read for migration only. Plan files export `app: "risk-parity-compass"`.

## 2. Functional requirements

| ID | Requirement | Milestone | Status |
|----|-------------|-----------|--------|
| FR-1 | Equal-risk-contribution weights (changed from inverse-volatility in M7), tax-location waterfall, drift-threshold trades | MVP | Built |
| FR-2 | Retirement inputs → SWR, PWR, success probability, max drawdown, effective horizon | M1 | Built (fixed in M3.5) |
| FR-3 | Monthly drawdown with inflation and cash buffer; rolling historical backtest | M1/M2 | Built |
| FR-4 | Seeded Monte Carlo with withdrawals, percentile fan chart | M1 | Built |
| FR-5 | RMD table (73/75 eligibility), withdrawal sequencing taxable → traditional → Roth | M2 | Built |
| FR-6 | Guardrails `rpr-80`, `guyton-klinger`, `vpw`; Social Security/pension netting; bridge years | M3 | Built |
| FR-7 | Static vs guardrail outcome comparison on the Retirement tab | M3 (Task 6) | Built (PR #25) |
| FR-8 | Correctness remediation of M1–M3 (compounding, units, honest success rate, guardrail periods) | M3.5 | Built |
| FR-9 | Template library; compare up to 3 templates with the user's portfolio; diversification score | M4 | Built (PR #19) |
| FR-10 | Versioned storage v2, export/import, backup reminder | M5 | Built (PR #27) |
| FR-11 | Data resilience: stale-price cache, manual override, overlap reporting | M5 | Built (PR #27) |
| FR-12 | Accessibility: font scale, high contrast, print CSS, PDF via `window.print()` | M5 | Built (PR #27) |
| FR-13 | Learning journey: competency rubric, short spaced modules | M6 | Built (PR #28) |
| FR-14 | Historical metrics withheld with a reason when history is too short; window count always shown | M7 | Built (#43) |
| FR-15 | Rolling metrics and Monte Carlo on 1928–2025 proxy history (block bootstrap by calendar year) when every holding has a proxy, labelled as such | M7 | Built (#48, #50, #53) |
| FR-16 | Bracket-filling draw order with optional Roth conversion, federal-only heuristic | M7 | Built (#51) |

## 3. Calculation contracts (normative)

1. **Drawdown recursion:** `B(i+1) = max(0, B(i) − spend(i)) × p(i+1)/p(i)`. Withdrawals reduce the compounding base.
2. **Units:** simulations run in dollars from the user's portfolio value; never normalise to 1 while subtracting dollars.
3. **Rates are annual.** Any function taking a rate takes `periodsPerYear` and divides before applying; band decisions evaluate on year boundaries.
4. **`successRate`** is the share of start dates where the user's actual spending survives — never derived from the SWR itself.
5. **Short history:** compute over the available window and report `effectiveYears`; never return zeros. SWR/PWR/success are withheld (with the reason) when fewer than `MIN_WINDOWS` distinct windows exist, and the window count is always shown.
6. **`vpw` requires `age`**; fail at the call site, not deep in a simulation.
7. **Portfolio path:** `Σ w × p(t)/p(0)`, weight-normalised, never `Σ w × p(t)`.
8. **Monte Carlo is deterministic** under a seed. No `Math.random` in finance code.
9. **Template allocations sum to 1** (±1e-6) or validation throws; they are never adjusted to fit. Each has a `source` (URL or named author) and `lastReviewed`; only allocations the source publishes may be labelled as that source's.
10. **Diversification warnings:** average pairwise correlation > 0.6, fewer than 4 macro classes, or any pair > 0.9.
11. **Comparison sign convention:** difference = template − current (positive = template has more).

## 4. Testing requirements

- **Numeric oracle for every financial output**: expected value computed independently (hand or closed form) at realistic scale (six-figure portfolio, four-figure monthly spend, 30-year horizon).
- UI tests assert values (`/^\d+(\.\d+)?%$/`, no `NaN`), never labels alone; an error path must never satisfy an assertion.
- The price snapshot is mocked everywhere (MSW for unit, route interception for E2E) with monthly dates so history aligns; `real-prices.spec.js` is the one unmocked check and is required post-deploy.
- Gates before merge: `npm test`, `npm run lint` (0 errors), `npm run format`, `npm run build`, `npm run test:e2e`, Lighthouse CI (perf ≥ 0.9, a11y ≥ 0.95, best-practices ≥ 0.9, SEO ≥ 0.9).
- All Node subprocesses: `env -u NODE_OPTIONS <cmd>`.

## 5. Non-functional requirements

- **Privacy:** no personal data leaves the browser; no telemetry.
- **Accessibility:** zero axe violations on every tab; 44px touch targets; visible focus; muted text ≥ 7:1.
- **Dependencies:** no new runtime dependency without justification in the commit.
- **Design:** `DESIGN.md` tokens are normative; no raw colour, radius or shadow outside it.
- **Disclaimer:** every retirement metric carries "Planning estimates only — not financial, tax, or legal advice…".

## 6. Known gaps and risks

| Gap | Where tracked |
|-----|---------------|
| Guyton-Klinger/VPW not selectable in the UI; GK state not carried across years in Monte Carlo | `Known Limitations.md`; `docs/plan.md` §Deferred |
| Pages rename (repo now `risk-parity-compass`) | Resolved; close #24 once verified | |
| Prices are a snapshot (days old, ~50 tickers); Yahoo's unofficial API can rate-limit the refresh | `Known Limitations.md`; deploy workflow |
| Template allocations are hand-transcribed | `lastReviewed` per template; `Known Limitations.md` |
| `analysisSignature` once included retirement fields and showed a permanent stale banner | Fixed in PR #19 |
| Heuristic tax model; federal only; bracket room is a fixed ~$44k/yr, not computed from income | `Known Limitations.md` |
| ~~`rpr-80` trip can raise spending~~ | Fixed, M7 #29 (PR #39) |
| ~~Contract 4 violated: rolling success at 4%, one window~~ | Fixed, M7 #30 (PR #43) |
| ~~Templates diverge from published sources~~ | Fixed, M7 #31 (unpublished templates removed; weights re-sourced 2026-10-28) |
| Annual-only long-run proxies; 10y Treasury stands in for long bonds; no REIT/EM/commodity/managed-futures series; Gaussian and own-history fallback for those holdings | `Known Limitations.md` |
| ~~"Risk parity" weights are inverse-volatility~~ | Fixed, M7 #34 (equal-risk-contribution weights) |

## 7. Definition of done (roadmap)

All milestones merged with green CI, lint, tests, a11y and Lighthouse; no Critical review finding open; `DESIGN.md` conformed to by every tab; `Known Limitations.md` and README current; a retiree can complete the flow without reading source.
