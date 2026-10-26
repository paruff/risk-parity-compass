# Retirement-Production Roadmap — Design Spec

**Date:** 2026-10-25
**Status:** Approved; revised 2026-10-26 after code review
**Author:** OpenCode agent (with human partner)
**Scope:** Move **Risk Parity Compass** (formerly Shannon's Demon) from MVP accumulation/rebalancing tool to a production drawdown-planning tool for a retired individual, grounded in Risk Parity Radio (RPR) principles.
**Revision 2026-10-26:** adds M3.5 (correctness remediation, now the next milestone), M6 (learning journey), the `DESIGN.md` design-system requirement, and the numeric-oracle testing rule. See §13.

---

## 1. Problem & Intent

Risk Parity Compass currently answers one question well: *"Given my holdings, what should I trade to reach risk-parity targets tax-efficiently?"* That is an accumulation/rebalancing question.

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
8. Every headline number is pinned by a **numeric oracle test** — a hand-computed expectation that fails if the arithmetic changes — and no UI test may pass on an error path. (Added 2026-10-26: label-only assertions let M1–M3 ship broken maths with green CI.)
9. The visual language is defined in `DESIGN.md` and every new view conforms to its tokens and rules.

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
- A3. Expected return in Monte Carlo defaults to **historical mean returns** (per-ticker, computed from the loaded price history), with a user-selectable mode: `historical` | `zero` | `custom`.
- A4. `localStorage` remains the persistence layer; no backend.
- A5. The app remains React 18 + Vite with inline styles; no UI framework is introduced.
- A6. Historical SWR uses the longest monthly history Yahoo exposes; when ETF inception limits the window, the UI reports the effective horizon rather than pretending 30 years exist.
- A7. Tax calculations are heuristic planning aids, not filing-grade.

**Resolved decisions (approved 2026-10-25):**
- Q1 → **Historical mean returns** are the default MC drift mode. Compute per-ticker annualized mean return from the loaded history; expose a `historical | zero | custom` toggle. `zero` remains available as the conservative option.
- Q2 → **Data-driven, versioned** RMD table (JSON module) with `RMD_TABLE_VERSION` surfaced in the UI.
- Q3 → **Per-plan** guardrail policy, with `rpr-80` as the default preset.
- Q4 → **Both**: browser print CSS *and* a PDF export. PDF is produced dependency-free via print CSS + `window.print()` (browser "Save as PDF"), avoiding a new runtime dependency.

---

## 5. Architecture

### 5.1 Module layout

Repo rule says "all portfolio logic in `src/utils/finance.js`". Adding ~800 lines of retirement logic there would make the file unmaintainable, and the brainstorming guidance treats an oversized file as a boundary problem. **Approved deviation (2026-10-25):** keep existing `finance.js` as-is and add focused pure modules:

```
src/utils/
  finance.js          # unchanged responsibilities (market math, trades)
  withdrawal.js       # NEW: SWR, PWR, drawdown backtest, RMD, guardrails, MC-with-withdrawals
  rmd-tables.json     # NEW: versioned US Uniform Lifetime Table data
  portfolios.js       # NEW: RPR portfolio templates + diversification scoring
  storage.js          # NEW: versioned persistence + migration + export/import
  __tests__/
    finance.test.js
    withdrawal.test.js
    portfolios.test.js
    storage.test.js
```

All three new modules are pure (no DOM, no network) except `storage.js`, which wraps `localStorage` and is mocked in tests. This preserves the repo's purity/testing intent while keeping files focused.

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
  driftMode: 'historical',    // 'historical' | 'zero' | 'custom'
  expectedReturn: null,       // only used when driftMode === 'custom'
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

### 5.6 Design system (`DESIGN.md`)

`DESIGN.md` at the repository root is the single source of truth for visual decisions, in the [designmd.app](https://designmd.app/) / [Google design.md](https://github.com/google-labs-code/design.md) format: YAML front matter carrying normative tokens (colors, typography, spacing, rounded, components) followed by prose sections in canonical order (Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components, Do's and Don'ts).

Rules:

- Tokens in `DESIGN.md` are normative; the prose explains how to apply them. A view that needs a new colour, radius or type level adds a token there first.
- Any new view, chart or component must be checked against `DESIGN.md` in review. A deviation is a review finding, not a style preference.
- Inline styles remain mandatory (repo rule); `DESIGN.md` describes the values those styles use, not a stylesheet.
- Contrast pairs are recorded with measured WCAG ratios so the accessibility budget can be reasoned about, not guessed.

---

## 6. Calculation Contracts (`withdrawal.js`)

All functions pure; all money in real (inflation-adjusted) terms unless named `nominal`.

### 6.1 Drawdown of a single path

```js
// Withdraw a fixed real amount monthly (or annually) from a portfolio path.
// portfolioValues: number[] — monthly real portfolio value series WITHOUT withdrawals
// Returns: { balances, depletedYear, maxDrawdown, terminalReal, yearsLasted, ...bufferState }
drawdownPath(portfolioValues, monthlySpend, { periodsPerYear = 12, inflationRate = 0 })
```

**Normative recursion (revised 2026-10-26).** Withdrawals must reduce the compounding base:

```
B(0) = portfolioValues[0]
B(i+1) = max(0, B(i) - spend(i)) × (portfolioValues[i+1] / portfolioValues[i])
```

The M1 implementation instead computed `B(i) = portfolioValues[i] - Σ spend`, subtracting spend from a path that still assumed the money stayed invested. That overstates terminal balances and SWR by roughly 2–2.5×. Any implementation that does not satisfy the recursion above is wrong, regardless of what its tests assert.

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

Two corrections (2026-10-26):

- When `n < horizonMonths`, compute over the longest available window and report `effectiveYears`; do not return zeros. Zeros are indistinguishable from "you can spend nothing", and the default ticker set only has ~22 years of overlap against a 30-year horizon.
- `successRate` must be the share of start dates where the **user's actual spending** survives — not the share where the SWR (by definition the highest surviving rate) survives, which is always 1.0.

### 6.3 Monte Carlo with withdrawals

```js
// Extends monteCarloSimulation with monthly withdrawals, inflation, and
// per-step percentile bands. Deterministic under `seed`.
monteCarloWithWithdrawals(allCloses, weights, vols, corrMatrix, {
  simulations = 1000,
  steps = 360,                 // months
  monthlySpend,
  inflationRate = 0.03,
  driftMode = 'historical',    // 'historical' | 'zero' | 'custom'
  expectedReturns = null,      // {ticker: annualReturn} for 'custom'; ignored otherwise
  threshold = 0.05,
  seed = 42,
})
// Returns: { terminalValues, successRate, bands: { p10[], p25[], p50[], p75[], p90[] },
//            stats: { mean, median, p10, p90, cagr, sharpe }, depletionYears }
```

Success = fraction of paths where balance never hits zero.

**Units (revised 2026-10-26).** The simulation runs in **dollars**, starting at the user's portfolio value; `monthlySpend` is dollars. The M1 implementation started every path at `1` while subtracting a dollar spend, so every path depleted in month 1 and the fan chart was a flat line at zero.

### 6.4 Correctness fixes to existing MC (must land in M1)

1. Replace `Math.random` with a seeded PRNG (`mulberry32(seed)`); accept `seed` in options so tests are deterministic. **(already landed in `503cace`)**
2. Fix `vols[tickers[t]]` → `vols[t]` (currently zeroes drift). **(already landed)**
3. Track per-ticker terminal prices and return real `finalPrices` (median terminal price per ticker). **(already landed)**
4. Annualize Sharpe and CAGR from terminal values over the actual horizon. **(already landed)**
5. Guard empty input: return empty arrays and zeroed stats instead of `NaN`. **(already landed)**
6. Add per-ticker **historical-mean drift** as the default mode, replacing the single scalar `expectedReturn`; keep `zero` and `custom` modes.

### 6.5 RMD

```js
// US Uniform Lifetime Table. age: owner age at year end; balance: prior 12/31 balance.
requiredMinimumDistribution(age, priorYearEndBalance, { tableVersion = '2022+' })
// Returns { age, distributionPeriod, rmd, eligible }
```

- Eligibility age: 73 for those born 1951–1959, 75 for 1960+ (encode birth-year rule).
- Table stored as a **data-driven, versioned JSON module** (`src/utils/rmd-tables.json`) with `RMD_TABLE_VERSION` exported alongside it and surfaced in the UI.

### 6.6 Guardrails

```js
// nextYearSpend(currentSpend, portfolioValue, startingValue, policy)
// policies: 'none' | 'rpr-80' | 'guyton-klinger' | 'vpw'
guardrailSpend(currentSpend, portfolioValue, startingValue, policy, opts)
```

- `rpr-80`: if `portfolioValue < 0.8 × startingValue`, cut the withdrawal to **6% of current value on an annual basis** until recovery.
- `guyton-klinger`: capital-preservation and prosperity rules with user-configurable bands, evaluated **annually**.
- `vpw`: percentage-of-portfolio table by age, recomputed from the portfolio each period.

**Period contract (normative, revised 2026-10-26).** Every rate in this section is an **annual** rate. A caller stepping monthly must divide rate-derived amounts by `periodsPerYear` and evaluate band decisions on year boundaries. The M3 implementation applied annual rates monthly, so a guardrail "cut" *raised* spending roughly 13×, and Guyton-Klinger's prosperity rule fired every month until it hit its ceiling. `guardrailSpend` therefore takes an explicit `periodsPerYear` (default 12) and the guardrail signature includes it.

`vpw` requires `age`. Passing `guardrail: 'vpw'` without `age` must fail loudly at the call site, not at runtime deep inside a simulation.

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

**Numeric oracle rule (added 2026-10-26).** For every financial output there must be at least one test whose expected value is computed independently of the implementation — by hand or by a closed-form formula — at **realistic scale** (a six-figure portfolio, a four-figure monthly spend, a multi-decade horizon). Synthetic scales like "5% per month" hide period errors. Required oracles:

| Function | Oracle |
|---|---|
| `drawdownPath` | flat path, spend > growth: depletion month from the closed form; spend < growth: terminal balance from the annuity formula |
| `rollingWithdrawalRates` | flat path with known real return → SWR converges to the analytic rate |
| `monteCarloWithWithdrawals` | spend 0 → terminal = gross growth; monotonic decline in success as spend rises; success < 1 for an unaffordable spend |
| `guardrailSpend` | each policy at $1M / $4,000 per month: a trip must *reduce* spend, never raise it |
| `withdrawalSequence` | sequencing with a known RMD floor produces documented per-account amounts that sum to the total |

UI tests must assert **values, not labels**: a metric cell must match `/^\d+(\.\d+)?%$/`, `NaN%` must have zero occurrences, and the error banner must be absent. An error path must never satisfy an E2E assertion.

---

## 9. Phased Delivery (each milestone = one PR, <400 lines, human merges)

### M1 — Withdrawal engine core *(shipped, defective — see M3.5)*
- `withdrawal.js`: `drawdownPath`, `rollingWithdrawalRates`, `monteCarloWithWithdrawals`, MC correctness fixes.
- `Retirement` tab: inputs, SWR/PWR/success cards, drawdown chart, fan chart.
- Tests for all of the above.
- **Exit:** a user can enter spend/horizon/inflation and see SWR, PWR, success probability, max drawdown, and fan chart.

### M2 — Tax & account mechanics *(shipped, defective — see M3.5)*
- `requiredMinimumDistribution`, `withdrawalSequence` (taxable → traditional → Roth, bracket-aware heuristic).
- Tax-aware rebalancing preference (avoid taxable sells).
- Cash-buffer model and refill rule.
- RMD table in the Retirement tab.
- **Exit:** RMD and sequencing shown per account; buffer affects drawdown results.

### M3 — Dynamic spending & income floor *(tasks 1–5 shipped, defective — see M3.5)*
- `guardrailSpend` with `rpr-80`, `guyton-klinger`, `vpw`.
- Social Security / pension netted against spending; bridge-year display.
- **Exit:** user can compare static vs guardrail spending outcomes.

### M3.5 — Correctness remediation *(complete; blocked M4 until merged)*
Findings: `docs/superpowers/reviews/2026-10-26-code-review-m1-m3.md`.

- `drawdownPath`: compounding recursion, funded and refilled cash buffer, buffer state in the return value.
- `monteCarloWithWithdrawals`: dollar-denominated paths; removed the normalised start; requires `startingValue`.
- `rollingWithdrawalRates`: honest `successRate`; computes over available history with `effectiveYears`; uses `referenceRate` (default 4%).
- `guardrailSpend`: annual-rate/period contract (`periodsPerYear`); per-policy realistic-scale oracle tests; `vpw` age plumbed through both callers.
- `withdrawalSequence`: correct row shape in the UI, monthly RMD conversion, RMD surplus destination, no Roth RMD, single computation per render.
- Portfolio path: weight-normalised series (`Σ w × p(t)/p(0)`), not `Σ w × p(t)`.
- UI: renders `retirementResults.error`, persists retirement inputs, clamps horizon, resolves dead controls, includes guardrail parameters in `analysisSignature`.
- Tests: numeric-oracle table in §8; timestamped Yahoo mock; value assertions in E2E (partial).
- **Exit:** every §8 oracle passes; the review's Critical list is closed; no metric is `NaN` on any reachable input; build, unit, a11y and Lighthouse are green.

### M4 — Portfolio library & comparison
- `portfolios.js` templates + diversification score.
- `Portfolios` tab with load and 3-way comparison.
- **Exit:** user can load an RPR portfolio and compare it to their own on SWR/PWR/drawdown.

### M5 — Production hardening & accessibility
- `storage.js` v2 migration, export/import, backup reminder.
- Data resilience: stale-price cache, manual override, `fetchMonthlyHistory` overlap reporting.
- Accessibility: font scale, high contrast, print CSS, keyboard/screen-reader pass.
- **PDF export**: dependency-free, using print CSS + `window.print()` (browser "Save as PDF"), plus a visible "Download PDF" action on the Retirement tab.
- Observability: visible data timestamps, error boundaries on new tabs.
- E2E + a11y expansion.
- **Exit:** documented production checklist passes; Lighthouse budgets hold.

### M6 — Learning journey *(research complete 2026-10-26; unscoped)*
- Map investor development levels to observable competencies, not labels.
- Deliver short, spaced, retrieval-practised learning modules that gate nothing but recommend next steps.
- Evidence base and design constraints: `docs/superpowers/research/2026-10-26-investor-levels-and-learning-science.md`.
- **Exit (proposed):** a learner can state their current level against a rubric, complete one module, and see a measurable change on a knowledge check; no module claims an effect the evidence does not support.

---

## 13. Review outcome (2026-10-26)

Four change sets (PRs #12, #13/#15, #14 and local M3 commits) were reviewed by the `requesting-code-review` process. Ten Critical findings were raised and independently reproduced by executing the shipped functions. The summary:

- `drawdownPath` never compounded withdrawals → SWR overstated ~2–2.5×.
- Monte Carlo subtracted dollars from a portfolio normalised to 1 → every path depleted immediately.
- `successRate` was 1.0 by construction in both historical and Monte Carlo paths.
- Guardrail policies were annual rules applied monthly → "cuts" raised spending ~13×.
- Withdrawal sequencing rendered `$NaN`; RMD was passed annual where monthly was expected; the cash buffer affected no projection; Roth IRA was given a fictitious RMD.
- The backtest weighted tickers by share price instead of target weight.
- No test could detect any of the above: E2E asserted labels, the Yahoo mock lacked timestamps, and the Monte Carlo guardrail test compared `0 ≥ 0`.

Consequences now encoded in this spec: M3.5 exists and blocks M4; §6.1 and §6.6 state the normative recursion and period contract; §8 adds the numeric-oracle rule; §12 requires `DESIGN.md`.

---


## 10. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Yahoo API breaks | Last-good cache, manual override, isolated `fetchQuote` swap point, clear stale-data banner |
| Short ETF history limits 30-year SWR | Use longest monthly overlap; report effective horizon; MC covers long horizons parametrically |
| MC assumptions oversell outcomes | Default **historical mean** drift with a visible mode toggle (`historical`/`zero`/`custom`); show assumptions next to results; disclaimers |
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

- All milestones merged with green CI, lint, tests, a11y, and Lighthouse budgets.
- M3.5's numeric oracles pass; no Critical finding from the 2026-10-26 review remains open.
- `DESIGN.md` exists and every tab conforms to it.
- `Known Limitations.md` updated: RMDs implemented; remaining limitations explicit.
- README documents the Retirement and Portfolios tabs and the data-resilience behavior.
- No new runtime dependencies unless justified in the commit.
- A retiree can complete the flow without reading source code or developer docs.
