# Spec — Risk Parity Compass

**Status:** Current as of 2026-10-26 (M1–M5 merged; M6 in review)
**Intent:** `docs/intent.md` · **Plan:** `docs/plan.md` · **Review rules:** `REVIEW.md` · **Design:** `DESIGN.md`
**History and rationale:** `docs/superpowers/specs/2026-10-25-retirement-production-roadmap-design.md` (the long-form roadmap spec; this file is the working summary).

## 1. System

Static React 18 + Vite SPA on GitHub Pages. All state in `localStorage`. No backend. The only network calls are Yahoo Finance chart requests from the browser.

```
src/
  App.jsx                 single-file UI: state, views, inline styles
  PortfoliosTab.jsx       Portfolios tab (extracted: self-contained data flow)
  utils/finance.js        vol, weights, trades, tax location, quote + monthly fetch, correlation
  utils/withdrawal.js     drawdown, SWR/PWR, Monte Carlo, RMD, guardrails, sequencing
  utils/portfolioPath.js  weight-normalised backtest series
  utils/portfolios.js     RPR templates, macro classes, diversification score, comparison helpers
  utils/rmd-tables.json   versioned IRS Uniform Lifetime Table
  components/             ErrorBoundary, Tooltip, RiskContribution, CorrelationMatrix, PerformanceChart
  mocks/handlers.js       MSW handlers for Yahoo
tests/e2e/                Playwright with route-intercepted, timestamped Yahoo mocks
```

Persistence keys: `shannonsdemon_v1` (state) and `shannonsdemon_scenarios_v1` (scenarios). They keep the old prefix on purpose across the product rename; migration is M5.

## 2. Functional requirements

| ID | Requirement | Milestone | Status |
|----|-------------|-----------|--------|
| FR-1 | Inverse-volatility weights, tax-location waterfall, drift-threshold trades | MVP | Built |
| FR-2 | Retirement inputs → SWR, PWR, success probability, max drawdown, effective horizon | M1 | Built (fixed in M3.5) |
| FR-3 | Monthly drawdown with inflation and cash buffer; rolling historical backtest | M1/M2 | Built |
| FR-4 | Seeded Monte Carlo with withdrawals, percentile fan chart | M1 | Built |
| FR-5 | RMD table (73/75 eligibility), withdrawal sequencing taxable → traditional → Roth | M2 | Built |
| FR-6 | Guardrails `rpr-80`, `guyton-klinger`, `vpw`; Social Security/pension netting; bridge years | M3 | Built |
| FR-7 | Static vs guardrail outcome comparison on the Retirement tab | M3 (Task 6) | Built (PR #25) |
| FR-8 | Correctness remediation of M1–M3 (compounding, units, honest success rate, guardrail periods) | M3.5 | Built |
| FR-9 | Template library; compare up to 3 templates with the user's portfolio; diversification score | M4 | Built (PR #19) |
| FR-10 | Versioned storage v2, export/import, backup reminder | M5 | Planned |
| FR-11 | Data resilience: stale-price cache, manual override, overlap reporting | M5 | Planned |
| FR-12 | Accessibility: font scale, high contrast, print CSS, PDF via `window.print()` | M5 | Planned |
| FR-13 | Learning journey: competency rubric, short spaced modules | M6 | Built (PR #28) |

## 3. Calculation contracts (normative)

1. **Drawdown recursion:** `B(i+1) = max(0, B(i) − spend(i)) × p(i+1)/p(i)`. Withdrawals reduce the compounding base.
2. **Units:** simulations run in dollars from the user's portfolio value; never normalise to 1 while subtracting dollars.
3. **Rates are annual.** Any function taking a rate takes `periodsPerYear` and divides before applying; band decisions evaluate on year boundaries.
4. **`successRate`** is the share of start dates where the user's actual spending survives — never derived from the SWR itself.
5. **Short history:** compute over the available window and report `effectiveYears`; never return zeros.
6. **`vpw` requires `age`**; fail at the call site, not deep in a simulation.
7. **Portfolio path:** `Σ w × p(t)/p(0)`, weight-normalised, never `Σ w × p(t)`.
8. **Monte Carlo is deterministic** under a seed. No `Math.random` in finance code.
9. **Template allocations sum to 1** (±1e-6); each has `source` and `lastReviewed`.
10. **Diversification warnings:** average pairwise correlation > 0.6, fewer than 4 macro classes, or any pair > 0.9.
11. **Comparison sign convention:** difference = template − current (positive = template has more).

## 4. Testing requirements

- **Numeric oracle for every financial output**: expected value computed independently (hand or closed form) at realistic scale (six-figure portfolio, four-figure monthly spend, 30-year horizon).
- UI tests assert values (`/^\d+(\.\d+)?%$/`, no `NaN`), never labels alone; an error path must never satisfy an assertion.
- Yahoo is mocked everywhere (MSW for unit, route interception for E2E) with **timestamps** so monthly history aligns.
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
| Pages site broken by half-finished rename (repo `shannonsdemon`, base `/risk-parity-compass/`) | `docs/plan.md` §Housekeeping |
| Yahoo unofficial API may break; CORS blocks localhost | `Known Limitations.md`; M5 resilience |
| Template allocations are hand-transcribed | `lastReviewed` per template; `Known Limitations.md` |
| `analysisSignature` once included retirement fields and showed a permanent stale banner | Fixed in PR #19 |
| Heuristic tax model; federal only | `Known Limitations.md` |

## 7. Definition of done (roadmap)

All milestones merged with green CI, lint, tests, a11y and Lighthouse; no Critical review finding open; `DESIGN.md` conformed to by every tab; `Known Limitations.md` and README current; a retiree can complete the flow without reading source.
