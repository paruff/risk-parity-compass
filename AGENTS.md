# Risk Parity Compass — Repo Context

Risk parity portfolio rebalancing **and** retirement drawdown planning. React 18 SPA deployed to GitHub Pages.

> **Shannon's Demon is the strategy, not the product.** The name refers to the rebalancing result (harvest volatility from a diversified, low-correlation mix). Risk Parity Compass is the application.

Site: <https://paruff.github.io/risk-parity-compass/>

## Quick Commands

```bash
npm run dev          # dev server, base /risk-parity-compass/ (port 5173)
npm run build        # production build to dist/
npm run preview      # preview built app (port 4173)
npm test             # vitest unit/integration
npm run test:e2e     # playwright E2E (builds first)
npm run lint         # eslint
npm run format       # prettier --check
```

## Structure

```
src/
  App.jsx                    # Single-file UI. All views, state, styles.
  utils/finance.js           # Vol calc, weights, trades, tax location, quote fetch.
  utils/withdrawal.js        # Drawdown, SWR/PWR, Monte Carlo, RMD, guardrails, sequencing.
  utils/portfolioPath.js     # Weight-normalised backtest portfolio series.
  utils/rmd-tables.json      # Versioned IRS Uniform Lifetime Table.
  utils/__tests__/           # vitest (jsdom).
  components/                # ErrorBoundary, Tooltip, RiskContribution, CorrelationMatrix, PerformanceChart.
  mocks/handlers.js          # MSW handlers for Yahoo Finance.
tests/e2e/                   # Playwright (mocked Yahoo, never hits live API).
docs/superpowers/            # specs, plans, reviews, audits, research.
DESIGN.md                    # Normative design tokens + rules. Read before any UI change.
```

## Architecture Rules

- **Single-file UI.** `App.jsx` owns all state and views. Extract a component only when logic is reused.
- **Inline styles only.** No CSS framework, no stylesheet, no CSS-in-JS. Values come from `DESIGN.md`; `DESIGN.md` tokens are normative. Never invent a colour or radius without adding it there first.
- **Finance math is pure.** Every calculation lives in `src/utils/` as a pure function: no DOM, no network, no clock. Fully unit-testable.
- **Every financial output needs a numeric oracle.** A test whose expected value is computed independently of the implementation, at realistic scale (six-figure portfolio, four-figure monthly spend, multi-decade horizon). Label-only assertions are forbidden — they let wrong maths ship with green CI.
- **Rates are annual; periods are explicit.** Any function taking a rate takes `periodsPerYear` and divides before applying. Never apply an annual rate per month.
- **Money is dollars.** A function that simulates a portfolio starts at the user's dollar value. Never normalise to 1 while subtracting dollars.
- **Yahoo Finance only.** `fetchQuote()` / `fetchMonthlyHistory()` are the single data source. Tests mock via MSW; E2E via Playwright route interception. Never hit live Yahoo in tests.
- **localStorage for state.** Keys `shannonsdemon_v1` and `shannonsdemon_scenarios_v1` are retained deliberately across the product rename so saved portfolios survive; the key migration lands with storage v2 (M5).

## Known Gotchas

- **`NODE_OPTIONS` shim is broken.** Every node subprocess needs `env -u NODE_OPTIONS <cmd>` — hooks, vitest, eslint, Playwright, Lighthouse.
- **Prettier reformats on commit** (lint-staged). Large `App.jsx` diffs are expected.
- **Lighthouse needs Chrome.** Local: `CHROME_PATH` to Playwright's chromium. CI: ubuntu-latest has Chrome.
- **A11y budget is 0.95, not 1.0.** Lighthouse's a11y audits are stricter than axe-core. Gradient button contrast is the known friction point (white on `#0891b2` measures 3.68:1 — see `DESIGN.md`).
- **Vite preview occupies 4173.** A stale preview server will silently serve an old build; check the port before trusting a preview.
- **Yahoo's chart endpoint is CORS-blocked from some origins.** From `localhost` it often fails, which means a *successful* analysis can be impossible locally. That is why retirement inputs must never depend on a fetch.

## Conventions

- **Commits:** Conventional format (`feat:`, `fix:`, `test:`, `ux:`, `ci:`, `docs:`, `chore:`). Enforced by commitlint via the Lefthook commit-msg hook.
- **Branches:** one milestone per branch and PR, target < 400 changed lines. Agents never merge; a human reviews and merges.
- **Version:** semver with alpha tags. Current: `v0.1.0-alpha.1`.
- **No new deps without justification.** Dependency-light by design; explain any addition in the commit.
- **Docs before code for a milestone.** The spec is `docs/superpowers/specs/2026-10-25-retirement-production-roadmap-design.md`; the active plan is in `docs/superpowers/plans/`.

## Testing Strategy

| Layer | Tool | What it covers |
|---|---|---|
| Unit | vitest + jsdom | `finance.js` and `withdrawal.js`: vol, weights, trades, tax location, drawdown recursion, SWR/PWR, Monte Carlo, RMD, guardrails, sequencing, portfolio path |
| Integration | vitest + MSW | `fetchQuote`, `fetchMonthlyHistory`: happy path, 404, 429, malformed payload |
| E2E | Playwright | Full flow: run analysis → values → trades → retirement projection (mocked Yahoo, timestamped) |
| A11y | Playwright + axe | Zero-violation check on analysis results |
| Perf | Lighthouse CI | Performance ≥ 0.9, a11y ≥ 0.95, best-practices ≥ 0.9, SEO ≥ 0.9 |

## Current State

M1–M3 shipped arithmetic defects (see `docs/superpowers/reviews/2026-10-26-code-review-m1-m3.md`). **M3.5 correctness remediation is the active milestone and blocks M4.** Do not add retirement features until its exit criteria pass.
