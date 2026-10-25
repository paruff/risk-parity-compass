# Retirement-Production Roadmap — Design Spec

**Date:** 2026-10-25
**Status:** Draft for review
**Author:** OpenCode agent (with human partner)
**Scope:** Move Shannon's Demon from MVP accumulation/rebalancing tool to a production drawdown-planning tool for a retired individual, grounded in Risk Parity Radio (RPR) principles.

---

## 1. Problem & Intent

Shannon's Demon currently answers one question well: *"Given my holdings, what should I trade to reach risk-parity targets tax-efficiently?"* That is an accumulation/rebalancing question.

A retired individual needs a different primary question: *"How much can I safely spend each year, for how long, and how likely am I to run out?"* Risk Parity Radio frames the goal exactly this way:

> "construct portfolios that are robust and can be drawn down on in perpetuity, and to maximize projected Safe Withdrawal Rates."

The app therefore needs a **drawdown engine**: withdrawals, inflation, sequence-of-returns risk, safe/perpetual withdrawal rates, RMDs, tax-aware withdrawal sequencing, and dynamic spending guardrails — plus the production hardening (data resilience, accessibility, backup) that a non-technical retiree depends on.

### Success criteria

1. A retiree can enter spending, horizon, and inflation and see **SWR, PWR, success probability, max drawdown, and a percentile fan chart**.
2. The tool can model **monthly withdrawals with inflation** in both historical and Monte Carlo modes.
3. RMDs and withdrawal sequencing are calculated, not hand-waved.
4. A retiree can select a **known RPR-style portfolio** in one click and compare candidates.
5. The app remains a **static, dependency-light, local-only SPA** with no PII leaving the browser.
6. Every new calculation is a **pure, unit-tested function**; Monte Carlo is **deterministic under a seed**.
7. Accessibility and data reliability are good enough for a non-technical, older user.

### Non-goals

- Live brokerage integration or trade execution.
- Tax return preparation or personalized tax advice.
- Guaranteed return forecasting; all outputs are planning estimates.
- Server-side accounts, cloud sync, or telemetry containing personal data.

---

## 2. Grounding: What Risk Parity Radio Actually Optimizes

Research from `riskparityradio.com` (home, portfolios, Episode 7):

- **Holy Grail principle:** combine the least-correlated asset classes; 4–5 uncorrelated classes capture most of the benefit; correlations above ~0.6 provide little diversification.
- **Macro allocation principle:** >90% of performance is explained by macro asset-class percentages, not fund selection.
- **Simplicity principle:** "Complexity is a cost, simplicity is an alpha."
- **Sample portfolios:** All Seasons, Golden Butterfly, Golden Ratio, Risk Parity Ultimate, Accelerated Permanent, Aggressive 50-50, Levered Golden Ratio, O.P.T.R.A.
- **Metrics that matter:** CAGR, projected max drawdown, projected **safe withdrawal rate (SWR)**, and **perpetual withdrawal rate (PWR)**.
- **Benchmarks:** 4% is the classic stock/bond baseline; RPR targets ≥5% for a 30-year retirement and ~6% as a gold standard. Portfolio Charts defines SWR as the rate that never ran out over the worst historical period of a given length, and PWR as the rate that never ended below the original inflation-adjusted principal.
- **Withdrawal policy example:** RPR's sample portfolios distribute monthly; if a portfolio falls below 80% of its starting value, the withdrawal rate is cut to 6% until it recovers.

These definitions drive the calculation contracts in §5.

---

## 3. Current State & Gaps

### Exists today
- `src/utils/finance.js`: `annualizedVol`, `inverseVolWeights`, `taxLocationWaterfall`, `generateTrades`, `correlationMatrix`, `riskContribution`, `simulatePerformance` (single historical path, rebalanced vs buy-and-hold), `monteCarloSimulation` (new, terminal-value distribution only), `fmt`.
- `src/App.jsx`: single-file UI with Holdings / Analysis / Trades tabs, scenario save/load, localStorage.
- Tests: 26 unit/integration tests; Playwright E2E + axe; Lighthouse CI.

### Gaps for a retiree
| Gap | Impact |
|---|---|
| No withdrawals or spending model | Cannot answer the retiree's core question |
| No SWR / PWR | Cannot compare portfolios on the metric RPR optimizes |
| No sequence-of-returns analysis | Hides the dominant retirement risk |
| MC has no withdrawals, inflation, or per-step bands | Distribution is not actionable |
| MC uses `Math.random`, not seedable | Not reproducible or testable |
| MC drift bug (`vols[tickers[t]]`) | Drift is always zero |
| No RMD logic | Flagged in `Known Limitations.md` |
| No withdrawal sequencing | Tax-inefficient drawdown |
| No cash buffer | Forces selling in downturns |
| No dynamic spending guardrails | No response to bad markets |
| No portfolio templates | Users must invent allocations |
| Yahoo API fragility | Production reliability risk |
| Accessibility untested for older users | Usability risk |

---

## 4. Assumptions & Open Questions

**Assumptions (to be confirmed before M1 implementation):**
- A1. Primary user is a US-based retiree; tax/RMD rules are US federal only.
- A2. Inflation is modeled as a constant user input (default 3%/yr); no CPI series fetch in v1.
- A3. Expected return in Monte Carlo defaults to zero drift (conservative), with an optional user override.
- A4. `localStorage` remains the persistence layer; no backend.
- A5. The app remains React 18 + Vite with inline styles; no UI framework is introduced.
- A6. Historical SWR uses the longest monthly history Yahoo exposes; when ETF inception limits the window, the UI reports the effective horizon rather than pretending 30 years exist.
- A7. Tax calculations are heuristic planning aids, not filing-grade.

**Open questions:**
- Q1. Should MC use zero drift or historical mean returns by default? (Spec assumes zero drift; revisit after user testing.)
- Q2. Should RMD tables be data-driven (JSON) to survive law changes, or hard-coded with a version constant? (Spec: data-driven table with `RMD_TABLE_VERSION`.)
- Q3. Should guardrails be per-portfolio policy or per-plan? (Spec: per-plan, with RPR-80 as the default preset.)
- Q4. Do we need a printable PDF, or is browser print CSS sufficient? (Spec: print CSS in M5; PDF only if requested.)

---

## 5. Architecture

### 5.1 Module layout

Repo rule says "all portfolio logic in `src/utils/finance.js`". Adding ~800 lines of retirement logic there would make the file unmaintainable, and the brainstorming guidance treats an oversized file as a boundary problem. **Proposed deviation:** keep existing `finance.js` as-is and add focused pure modules:

```
src/utils/
  finance.js          # unchanged responsibilities (market math, trades)
  withdrawal.js       # NEW: SWR, PWR, drawdown backtest, RMD, guardrails, MC-with-withdrawals
  portfolios.js       # NEW: RPR portfolio templates + diversification scoring
  storage.js          # NEW: versioned persistence + migration + export/import
  __tests__/
    finance.test.js
    withdrawal.test.js
    portfolios.test.js
    storage.test.js
```

All three new modules are pure (no DOM, no network) except `storage.js`, which wraps `localStorage` and is mocked in tests. This preserves the repo's purity/testing intent while keeping files focused.

> **Approval needed:** if you prefer to keep everything in `finance.js`, say so and I will consolidate.

### 5.2 Data model (state additions)

```js
// persisted as shannonsdemon_v2 = { schemaVersion: 2, ...existing, retirement, plan }
retirement: {
  monthlySpend: 4000,
  inflationRate: 0.03,
  horizonYears: 30,
  legacyTarget: 0,
  socialSecurityMonthly: 0,
  pensionMonthly: 0,
  cashBufferMonths: 12,
  guardrail: 'rpr-80',        // 'none' | 'rpr-80' | 'guyton-klinger' | 'vpw'
  expectedReturn: 0,          // annual drift for MC; 0 = conservative
}

portfolio: {
  templateId: 'custom',       // e.g. 'golden-butterfly'
  weights: { SPY: 0.2, ... }, // optional explicit override
}
```

### 5.3 Persistence & migration (`storage.js`)

- `STORAGE_KEY_V2 = 'shannonsdemon_v2'`; read v2 first, fall back to v1 and migrate.
- `migrate(raw)` returns `{ state, migratedFrom }` and never throws on malformed input.
- `exportPlan(state)` → versioned JSON string; `importPlan(json)` validates via `schemaVersion` and field types.
- Keep scenario key `shannonsdemon_scenarios_v1`; add export/import for scenarios.

### 5.4 Data acquisition

- Add `fetchMonthlyHistory(ticker)` using `range=max&interval=1mo` for long-horizon analysis.
- Compute the **common date overlap** across tickers; report `effectiveYears`.
- Cache last-good quote per ticker with timestamp; manual price override in the UI.
- Fallback strategy documented but not implemented in v1 (Alpha Vantage/Polygon remain swap-in points).

### 5.5 UI (single-file `App.jsx`, inline styles)

New tabs: `Retirement` and `Portfolios`. Existing tabs unchanged.

- **Retirement tab:** inputs panel; metric cards (SWR 15/30/45y, PWR, success %, max drawdown); drawdown-backtest chart; MC fan chart; RMD table; guardrail selector.
- **Portfolios tab:** RPR template cards with description, allocation table, "Load" action; side-by-side comparison of up to 3 templates using the same metric cards.
- **Accessibility controls:** base font scale (100/115/130%), high-contrast toggle, print stylesheet.
- All charts remain dependency-free (SVG/inline styles), consistent with the current `WeightBar`/`PerformanceChart` approach.

---

## 6. Calculation Contracts (`withdrawal.js`)

All functions pure; all money in real (inflation-adjusted) terms unless named `nominal`.

### 6.1 Drawdown of a single path

```js
// Withdraw a fixed real amount monthly (or annually) from a portfolio path.
// closes: number[] (monthly or daily values for the portfolio)
// Returns: { balances, depletedYear, maxDrawdown, terminalReal, yearsLasted }
drawdownPath(portfolioValues, monthlySpend, { periodsPerYear = 12, inflationRate = 0 })
```

### 6.2 Rolling historical SWR / PWR

```js
// For every historical start period of length horizonYears, find the highest
// constant real withdrawal rate that (a) never depletes the portfolio (SWR) and
// (b) never ends below the original real principal (PWR).
// portfolioValues: monthly real portfolio value series (from weights × prices)
// Returns: { swr, pwr, successRate, worstStart, worstDepletionYear, maxDrawdown, samples }
rollingWithdrawalRates(portfolioValues, { horizonYears, periodsPerYear = 12, inflationRate })
```

Implementation: for each start index, binary-search the withdrawal rate (tolerance 1e-4) between 0 and 0.20; evaluate with `drawdownPath`. Aggregate the worst case across starts. This matches Portfolio Charts' definitions.

### 6.3 Monte Carlo with withdrawals

```js
// Extends monteCarloSimulation with monthly withdrawals, inflation, and
// per-step percentile bands. Deterministic under `seed`.
monteCarloWithWithdrawals(allCloses, weights, vols, corrMatrix, {
  simulations = 1000,
  steps = 360,                 // months
  monthlySpend,
  inflationRate = 0.03,
  expectedReturn = 0,
  threshold = 0.05,
  seed = 42,
})
// Returns: { terminalValues, successRate, bands: { p10[], p25[], p50[], p75[], p90[] },
//            stats: { mean, median, p10, p90, cagr, sharpe }, depletionYears }
```

Success = fraction of paths where balance never hits zero.

### 6.4 Correctness fixes to existing MC (must land in M1)

1. Replace `Math.random` with a seeded PRNG (`mulberry32(seed)`); accept `seed` in options so tests are deterministic.
2. Fix `vols[tickers[t]]` → `vols[t]` (currently zeroes drift).
3. Track per-ticker terminal prices and return real `finalPrices` (median terminal price per ticker).
4. Annualize Sharpe and CAGR from terminal values over the actual horizon.
5. Guard empty input: return empty arrays and zeroed stats instead of `NaN`.

### 6.5 RMD

```js
// US Uniform Lifetime Table. age: owner age at year end; balance: prior 12/31 balance.
requiredMinimumDistribution(age, priorYearEndBalance, { tableVersion = '2022+' })
// Returns { age, distributionPeriod, rmd, eligible }
```

- Eligibility age: 73 for those born 1951–1959, 75 for 1960+ (encode birth-year rule).
- Table stored as a versioned constant; `tableVersion` surfaced in the UI.

### 6.6 Guardrails

```js
// nextYearSpend(currentSpend, portfolioValue, startingValue, policy)
// policies: 'none' | 'rpr-80' | 'guyton-klinger' | 'vpw'
guardrailSpend(currentSpend, portfolioValue, startingValue, policy, opts)
```

- `rpr-80`: if `portfolioValue < 0.8 × startingValue`, cut withdrawal rate to 6% of current value until recovery.
- `guyton-klinger`: capital-preservation and prosperity rules with user-configurable bands.
- `vpw`: percentage-of-portfolio table by age.

---

## 7. Portfolio Library (`portfolios.js`)

### 7.1 Templates

```js
export const PORTFOLIO_TEMPLATES = [
  {
    id: 'golden-butterfly',
    name: 'Golden Butterfly',
    source: 'Risk Parity Radio',
    description: '...',
    allocations: { VTI: 0.20, VIOV: 0.20, VGLT: 0.20, VGSH: 0.20, GLDM: 0.20 },
  },
  // All Seasons, Golden Ratio, Permanent, Aggressive 50-50, ...
];
```

- Each template carries `source` and `lastReviewed` metadata.
- Loading a template populates tickers + target weights, then triggers the existing analysis flow.
- Exact allocations to be transcribed from RPR portfolio pages at implementation time; the spec fixes the schema, not the numbers.

### 7.2 Diversification score

```js
// corrMatrix: output of correlationMatrix()
diversificationScore(corrMatrix)
// Returns { avgPairwiseCorrelation, maxPairwiseCorrelation, classCount, warnings: string[] }
```

Warnings fire when average pairwise correlation > 0.6 (RPR's "won't work" threshold) or fewer than 4 macro classes are represented.

---

## 8. Testing Strategy

| Layer | Tool | Coverage |
|---|---|---|
| Unit | vitest | `withdrawal.js`: drawdown, SWR/PWR, MC determinism (fixed seed → exact values), RMD boundaries (73/75), guardrail rules; `portfolios.js`: template integrity, correlation warnings; `storage.js`: migration v1→v2, malformed JSON, export/import round-trip |
| Integration | vitest + MSW | `fetchMonthlyHistory` happy path, overlap calculation, stale-cache fallback, manual override |
| E2E | Playwright | Select template → run analysis → retirement tab → set spend → metrics render; export/import round-trip |
| A11y | Playwright + axe | Zero violations on Retirement and Portfolios tabs; font-scale and contrast toggles |
| Perf | Lighthouse CI | Keep existing budgets; no chart library added |

Determinism requirement: every MC test passes a fixed `seed` and asserts exact/near-exact values.

---

## 9. Phased Delivery (each milestone = one PR, <400 lines, human merges)

### M1 — Withdrawal engine core
- `withdrawal.js`: `drawdownPath`, `rollingWithdrawalRates`, `monteCarloWithWithdrawals`, MC correctness fixes.
- `Retirement` tab: inputs, SWR/PWR/success cards, drawdown chart, fan chart.
- Tests for all of the above.
- **Exit:** a user can enter spend/horizon/inflation and see SWR, PWR, success probability, max drawdown, and fan chart.

### M2 — Tax & account mechanics
- `requiredMinimumDistribution`, `withdrawalSequence` (taxable → traditional → Roth, bracket-aware heuristic).
- Tax-aware rebalancing preference (avoid taxable sells).
- Cash-buffer model and refill rule.
- RMD table in the Retirement tab.
- **Exit:** RMD and sequencing shown per account; buffer affects drawdown results.

### M3 — Dynamic spending & income floor
- `guardrailSpend` with `rpr-80`, `guyton-klinger`, `vpw`.
- Social Security / pension netted against spending; bridge-year display.
- **Exit:** user can compare static vs guardrail spending outcomes.

### M4 — Portfolio library & comparison
- `portfolios.js` templates + diversification score.
- `Portfolios` tab with load and 3-way comparison.
- **Exit:** user can load an RPR portfolio and compare it to their own on SWR/PWR/drawdown.

### M5 — Production hardening & accessibility
- `storage.js` v2 migration, export/import, backup reminder.
- Data resilience: stale-price cache, manual override, `fetchMonthlyHistory` overlap reporting.
- Accessibility: font scale, high contrast, print CSS, keyboard/screen-reader pass.
- Observability: visible data timestamps, error boundaries on new tabs.
- E2E + a11y expansion.
- **Exit:** documented production checklist passes; Lighthouse budgets hold.

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Yahoo API breaks | Last-good cache, manual override, isolated `fetchQuote` swap point, clear stale-data banner |
| Short ETF history limits 30-year SWR | Use longest monthly overlap; report effective horizon; MC covers long horizons parametrically |
| MC assumptions oversell outcomes | Default zero drift; show assumptions next to results; disclaimers |
| RMD/tax law changes | Versioned RMD table; heuristic tax logic labeled as estimates |
| Scope creep | Milestones strictly ordered; each is a shippable slice |
| Accessibility regressions | Automated axe gate on new tabs |
| Unseeded MC makes tests flaky | Seeded PRNG mandatory in M1 |
| File-size creep in `App.jsx` | New tabs may become components only if logic is reused; otherwise keep single-file per repo rule |

---

## 11. Explicit Disclaimers

The UI must state, adjacent to every retirement metric:

> Planning estimates only — not financial, tax, or legal advice. Historical and simulated results do not guarantee future outcomes. Verify RMDs and tax figures with a qualified advisor.

---

## 12. Definition of Done (roadmap)

- All five milestones merged with green CI, lint, tests, a11y, and Lighthouse budgets.
- `Known Limitations.md` updated: RMDs implemented; remaining limitations explicit.
- README documents the Retirement and Portfolios tabs and the data-resilience behavior.
- No new runtime dependencies unless justified in the commit.
- A retiree can complete the flow without reading source code or developer docs.
