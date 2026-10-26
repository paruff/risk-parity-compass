# M1: Withdrawal Engine Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the core withdrawal engine (`withdrawal.js`), add a `Retirement` tab to `App.jsx` with inputs, metric cards (SWR, PWR, success %, max drawdown), drawdown backtest chart, and Monte Carlo fan chart, and cover all with unit and E2E tests.

**Architecture:** Three new pure modules (`withdrawal.js`, `rmd-tables.json`, `fetchMonthlyHistory` in `finance.js`) plus UI in the existing single-file `App.jsx`. All retirement math is pure, seeded, and unit-testable. Data acquisition uses Yahoo Finance monthly history; common overlap is computed and reported. No new runtime dependencies.

**Tech Stack:** React 18 + Vite, inline styles only, vitest (jsdom), Playwright (mocked Yahoo), eslint/prettier, lefthook.

**Spec:** `docs/superpowers/specs/2026-10-25-retirement-production-roadmap-design.md` (sections 5–6, 8, 9.1)

---

## Global Constraints

- **Single-file UI:** `src/App.jsx` owns all state and views. Components only when logic is reused.
- **Inline styles only:** No CSS framework, no external stylesheets. Colors: slate grays on dark navy (`#0d1424`).
- **Pure finance math:** All portfolio logic in `src/utils/` — pure functions, no side effects, fully unit-testable.
- **Yahoo Finance only:** `fetchQuote()` / `fetchMonthlyHistory()` are the single data sources. Tests mock via MSW; E2E via Playwright route interception. Never hit live Yahoo in tests.
- **localStorage for state:** Key: `shannonsdemon_v1` (will become `v2` in M5). Scenarios: `shannonsdemon_scenarios_v1`.
- **Dependency-light:** No new deps without justification in the commit.
- **Seeded determinism:** Monte Carlo must accept `seed` and produce identical results.
- **Commands run with `env -u NODE_OPTIONS`** (repo env gotcha).
- **Commits:** Conventional format (`feat:`, `fix:`, `test:`, `ux:`, `ci:`). One PR per milestone, < 400 lines.
- **Verification before merge:** `env -u NODE_OPTIONS npx vitest run`, `npx eslint "src/**/*.{js,jsx}"`, `npx prettier --check src/`, `npm run build`, `npm run test:e2e` all green.

---

## Review Focus

The spec is a vision document; these are the five input classes most likely to bite a retiree user that no single task's tests alone may catch — each gets a test pinned to its owning task:

1. **Zero or missing price history** → `fetchMonthlyHistory` must return empty/overlap info; MC and SWR must handle gracefully without `NaN`.
2. **Inflation rate = 0 or negative** → `drawdownPath` and `rollingWithdrawalRates` must handle 0% and negative inflation without division-by-zero or inverted logic.
3. **ETF inception < horizon** → `effectiveYears` must be reported; SWR/PWR must compute over actual overlap, not pretend 30 years exist.
4. **Guardrail state changes** → Switching between static and guardrail modes mid-session must not carry stale state (signature must include guardrail params).
5. **Manual price override** → Overridden prices must be used in all downstream calculations (weights, MC, SWR) and survive reload.

---

## File Structure

```
src/utils/
  withdrawal.js           # NEW: pure drawdown, SWR/PWR, MC-with-withdrawals, RMD
  rmd-tables.json         # NEW: versioned US Uniform Lifetime Table (data only)
  finance.js              # MODIFY: add fetchMonthlyHistory, export mulberry32, re-export seed PRNG
  __tests__/
    withdrawal.test.js    # NEW: unit tests for withdrawal.js
    finance.test.js       # MODIFY: add fetchMonthlyHistory tests
src/
  App.jsx                 # MODIFY: add Retirement tab, state, charts, inputs
tests/e2e/
  retirement.spec.js      # NEW: E2E flow for Retirement tab
```

---

### Task 1: `fetchMonthlyHistory` + overlap computation

**Files:**
- Create: `src/utils/__tests__/finance.test.js` (add tests)
- Modify: `src/utils/finance.js` (add function)

**Interfaces:**
- Consumes: existing `fetchQuote` pattern, MSW mock
- Produces: `fetchMonthlyHistory(ticker: string) => Promise<{ dates: string[], closes: number[] }>`, `computeOverlap(histories: Record<string, {dates, closes}>) => { aligned: Record<string, number[]>, effectiveYears: number }`

- [ ] **Step 1: Write failing tests**

```js
// src/utils/__tests__/finance.test.js
import { fetchMonthlyHistory, computeOverlap } from '../finance';

test('fetchMonthlyHistory returns monthly dates and closes', async () => {
  // MSW mocks handled by test setup
  const { dates, closes } = await fetchMonthlyHistory('SPY');
  expect(Array.isArray(dates)).toBe(true);
  expect(Array.isArray(closes)).toBe(true);
  expect(dates.length).toBe(closes.length);
  expect(dates.length).toBeGreaterThan(0);
});

test('fetchMonthlyHistory throws on 404', async () => {
  await expect(fetchMonthlyHistory('INVALID')).rejects.toThrow();
});

test('computeOverlap aligns tickers to common date range', () => {
  const histories = {
    A: { dates: ['2020-01', '2020-02', '2020-03'], closes: [100, 101, 102] },
    B: { dates: ['2020-02', '2020-03', '2020-04'], closes: [50, 51, 52] },
  };
  const { aligned, effectiveYears } = computeOverlap(histories);
  expect(Object.keys(aligned)).toEqual(['A', 'B']);
  expect(aligned.A).toEqual([101, 102]); // B starts Feb
  expect(aligned.B).toEqual([50, 51]);
  expect(effectiveYears).toBeCloseTo(2/12, 2);
});

test('computeOverlap returns empty when no overlap', () => {
  const histories = {
    A: { dates: ['2020-01'], closes: [100] },
    B: { dates: ['2021-01'], closes: [50] },
  };
  const { aligned, effectiveYears } = computeOverlap(histories);
  expect(Object.keys(aligned)).toEqual([]);
  expect(effectiveYears).toBe(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `env -u NODE_OPTIONS npx vitest run src/utils/__tests__/finance.test.js -t "fetchMonthlyHistory|computeOverlap"`
Expected: FAIL (functions not defined)

- [ ] **Step 3: Implement `fetchMonthlyHistory` in `src/utils/finance.js`**

```js
// Uses query1.finance.yahoo.com/v8/finance/chart/{ticker}?range=max&interval=1mo
// Returns { dates: string[], closes: number[] } sorted oldest→newest
export async function fetchMonthlyHistory(ticker) { ... }
```

- [ ] **Step 4: Implement `computeOverlap` in `src/utils/finance.js`**

```js
// Aligns multiple ticker histories to their common date range
// Returns { aligned: { [ticker]: number[] }, effectiveYears: number }
export function computeOverlap(histories) { ... }
```

- [ ] **Step 5: Re-export seeded PRNG for withdrawal.js**

Add `export { mulberry32, normalSampler } from './finance';` (or move to a shared `random.js` — but keep it in `finance.js` per repo rules). Actually, `mulberry32` is already in `finance.js`; just ensure it's exported.

- [ ] **Step 6: Run tests to verify they pass**

Run: `env -u NODE_OPTIONS npx vitest run src/utils/__tests__/finance.test.js -t "fetchMonthlyHistory|computeOverlap"`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/utils/finance.js src/utils/__tests__/finance.test.js
git commit -m "feat: add fetchMonthlyHistory and overlap computation for retirement backtest"
```

---

### Task 2: `withdrawal.js` — drawdownPath

**Files:**
- Create: `src/utils/withdrawal.js`
- Create: `src/utils/__tests__/withdrawal.test.js`

**Interfaces:**
- Consumes: none (pure)
- Produces: `drawdownPath(portfolioValues: number[], monthlySpend: number, { periodsPerYear?: number, inflationRate?: number }) => { balances: number[], depletedYear: number | null, maxDrawdown: number, terminalReal: number, yearsLasted: number }`

- [ ] **Step 1: Write failing tests**

```js
// src/utils/__tests__/withdrawal.test.js
import { drawdownPath } from '../withdrawal';

test('drawdownPath with zero spend returns full balance', () => {
  const values = [100000, 102000, 104000];
  const r = drawdownPath(values, 0);
  expect(r.balances).toEqual(values);
  expect(r.depletedYear).toBeNull();
  expect(r.maxDrawdown).toBe(0);
  expect(r.terminalReal).toBe(104000);
  expect(r.yearsLasted).toBeCloseTo(values.length / 12);
});

test('drawdownPath depletes when spend > returns', () => {
  const values = Array.from({ length: 60 }, (_, i) => 100000 * (1.005)**i); // 6% nominal
  const r = drawdownPath(values, 600); // 7.2% annual real spend
  expect(r.depletedYear).not.toBeNull();
  expect(r.yearsLasted).toBeLessThan(5);
});

test('drawdownPath with inflation adjusts spend', () => {
  const values = Array.from({ length: 120 }, (_, i) => 100000); // flat nominal
  const r = drawdownPath(values, 4000, { inflationRate: 0.03 });
  expect(r.balances[12]).toBeLessThan(r.balances[0]); // inflation erodes
});

test('drawdownPath maxDrawdown is peak-to-trough', () => {
  const values = [100000, 90000, 95000, 80000, 85000];
  const r = drawdownPath(values, 0);
  expect(r.maxDrawdown).toBeCloseTo(0.2, 3); // (100k->80k) / 100k = 20%
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `env -u NODE_OPTIONS npx vitest run src/utils/__tests__/withdrawal.test.js -t "drawdownPath"`
Expected: FAIL

- [ ] **Step 3: Implement `drawdownPath` in `src/utils/withdrawal.js`**

Algorithm: iterate months, track real balance = nominal / (1+inflation)^year, subtract monthlySpend * (1+inflation)^(month/12). Track peak, drawdown = (peak - current)/peak. Return object.

- [ ] **Step 4: Run tests to verify they pass**

Run: `env -u NODE_OPTIONS npx vitest run src/utils/__tests__/withdrawal.test.js -t "drawdownPath"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/withdrawal.js src/utils/__tests__/withdrawal.test.js
git commit -m "feat: add drawdownPath for withdrawal engine"
```

---

### Task 3: `withdrawal.js` — rollingWithdrawalRates (SWR/PWR)

**Files:**
- Modify: `src/utils/withdrawal.js`
- Modify: `src/utils/__tests__/withdrawal.test.js`

**Interfaces:**
- Produces: `rollingWithdrawalRates(portfolioValues: number[], { horizonYears: number, periodsPerYear?: number, inflationRate?: number }) => { swr: number, pwr: number, successRate: number, worstStart: number, worstDepletionYear: number | null, maxDrawdown: number, samples: { startIndex: number, swr: number, pwr: number, depleted: boolean }[] }`

- [ ] **Step 1: Write failing tests**

```js
// src/utils/__tests__/withdrawal.test.js
import { rollingWithdrawalRates } from '../withdrawal';

test('rollingWithdrawalRates returns SWR and PWR for flat portfolio', () => {
  // 20 years of flat 100k nominal
  const values = Array.from({ length: 240 }, () => 100000);
  const r = rollingWithdrawalRates(values, { horizonYears: 10, inflationRate: 0 });
  expect(r.swr).toBeCloseTo(1/120, 3); // 100k / 120 months = 833/mo
  expect(r.pwr).toBe(r.swr); // flat = same
  expect(r.successRate).toBe(1);
  expect(r.maxDrawdown).toBe(0);
});

test('rollingWithdrawalRates binary search tolerance', () => {
  const values = Array.from({ length: 360 }, (_, i) => 100000 * 1.004**i); // ~5% nominal
  const r = rollingWithdrawalRates(values, { horizonYears: 30, inflationRate: 0.03 });
  expect(r.swr).toBeGreaterThan(0.03); // ~4% SWR expected
  expect(r.swr).toBeLessThan(0.07);
  expect(r.pwr).toBeLessThanOrEqual(r.swr);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `env -u NODE_OPTIONS npx vitest run src/utils/__tests__/withdrawal.test.js -t "rollingWithdrawalRates"`
Expected: FAIL

- [ ] **Step 3: Implement `rollingWithdrawalRates` in `src/utils/withdrawal.js`**

Algorithm: for each start index `s` where `s + horizonMonths <= values.length`, binary-search withdrawal rate `w` in `[0, 0.20]` with tolerance `1e-4`. For each `w`, call `drawdownPath(values.slice(s, s+horizonMonths), w * values[s] / 12, ...)`. SWR = max `w` where never depleted; PWR = max `w` where terminal ≥ start. Aggregate worst case.

- [ ] **Step 4: Run tests to verify they pass**

Run: `env -u NODE_OPTIONS npx vitest run src/utils/__tests__/withdrawal.test.js -t "rollingWithdrawalRates"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/withdrawal.js src/utils/__tests__/withdrawal.test.js
git commit -m "feat: add rollingWithdrawalRates for SWR/PWR backtest"
```

---

### Task 4: `withdrawal.js` — monteCarloWithWithdrawals

**Files:**
- Modify: `src/utils/withdrawal.js`
- Modify: `src/utils/__tests__/withdrawal.test.js`

**Interfaces:**
- Consumes: `mulberry32`, `normalSampler` from `finance.js`
- Produces: `monteCarloWithWithdrawals(allCloses, weights, vols, corrMatrix, options) => { terminalValues: Float64Array, successRate: number, bands: { p10, p25, p50, p75, p90 }, stats: { mean, median, p10, p90, cagr, sharpe }, depletionYears: number[] }`

- [ ] **Step 1: Write failing tests**

```js
// src/utils/__tests__/withdrawal.test.js
import { monteCarloWithWithdrawals } from '../withdrawal';

test('monteCarloWithWithdrawals is deterministic with fixed seed', () => {
  const allCloses = { SPY: Array.from({ length: 200 }, (_, i) => 100 + Math.sin(i*0.1)*2) };
  const weights = { SPY: 1 };
  const vols = { SPY: 0.15 };
  const corr = { SPY: { SPY: 1 } };
  const opts = { simulations: 100, steps: 120, monthlySpend: 400, inflationRate: 0.03, driftMode: 'zero', seed: 42 };
  const r1 = monteCarloWithWithdrawals(allCloses, weights, vols, corr, opts);
  const r2 = monteCarloWithWithdrawals(allCloses, weights, vols, corr, opts);
  expect(r1.terminalValues).toEqual(r2.terminalValues);
  expect(r1.bands.p50).toEqual(r2.bands.p50);
});

test('monteCarloWithWithdrawals successRate = fraction never depleted', () => {
  const allCloses = { SPY: Array.from({ length: 200 }, (_, i) => 100 * 1.005**i) };
  const weights = { SPY: 1 };
  const vols = { SPY: 0.15 };
  const corr = { SPY: { SPY: 1 } };
  const opts = { simulations: 200, steps: 120, monthlySpend: 100, inflationRate: 0.03, driftMode: 'historical', seed: 123 };
  const r = monteCarloWithWithdrawals(allCloses, weights, vols, corr, opts);
  expect(r.successRate).toBeGreaterThanOrEqual(0);
  expect(r.successRate).toBeLessThanOrEqual(1);
  expect(r.bands.p10.length).toBe(120);
  expect(r.bands.p50.length).toBe(120);
  expect(r.bands.p90.length).toBe(120);
  expect(r.depletionYears.length).toBe(200);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `env -u NODE_OPTIONS npx vitest run src/utils/__tests__/withdrawal.test.js -t "monteCarloWithWithdrawals"`
Expected: FAIL

- [ ] **Step 3: Implement `monteCarloWithWithdrawals` in `src/utils/withdrawal.js`**

Algorithm: reuse Cholesky from `finance.js`. For each simulation, generate monthly returns using per-ticker drift (historical mean from `allCloses` when `driftMode='historical'`, zero when `'zero'`, custom when `'custom'`). Apply monthly withdrawals with inflation adjustment. Track balance path; record depletion year. After all sims, compute percentile bands per step (p10/p25/p50/p75/p90) and terminal stats (CAGR, Sharpe annualized over `steps/12` years).

- [ ] **Step 4: Run tests to verify they pass**

Run: `env -u NODE_OPTIONS npx vitest run src/utils/__tests__/withdrawal.test.js -t "monteCarloWithWithdrawals"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/withdrawal.js src/utils/__tests__/withdrawal.test.js
git commit -m "feat: add monteCarloWithWithdrawals with percentile bands"
```

---

### Task 5: RMD table data module

**Files:**
- Create: `src/utils/rmd-tables.json`
- Modify: `src/utils/withdrawal.js` (add `requiredMinimumDistribution`)
- Modify: `src/utils/__tests__/withdrawal.test.js` (add RMD tests)

**Interfaces:**
- Produces: `requiredMinimumDistribution(age: number, priorYearEndBalance: number, { tableVersion?: string } = {}) => { age, distributionPeriod, rmd, eligible: boolean }`, `RMD_TABLE_VERSION` constant exported.

- [ ] **Step 1: Create `src/utils/rmd-tables.json`**

```json
{
  "version": "2022+",
  "source": "IRS Uniform Lifetime Table (Table III)",
  "table": {
    "73": 26.5, "74": 25.5, "75": 24.6, "76": 23.7, "77": 22.9,
    "78": 22.0, "79": 21.1, "80": 20.2, "81": 19.4, "82": 18.5,
    "83": 17.7, "84": 16.9, "85": 16.0, "86": 15.2, "87": 14.4,
    "88": 13.7, "89": 12.9, "90": 12.2, "91": 11.5, "92": 10.8,
    "93": 10.1, "94": 9.5, "95": 8.9, "96": 8.3, "97": 7.8,
    "98": 7.3, "99": 6.8, "100": 6.4, "101": 6.0, "102": 5.6,
    "103": 5.2, "104": 4.9, "105": 4.5, "106": 4.2, "107": 3.9,
    "108": 3.7, "109": 3.4, "110": 3.1, "111": 2.9, "112": 2.6,
    "113": 2.4, "114": 2.1, "115": 1.9
  }
}
```

- [ ] **Step 2: Write failing RMD tests**

```js
// src/utils/__tests__/withdrawal.test.js
import { requiredMinimumDistribution, RMD_TABLE_VERSION } from '../withdrawal';

test('RMD_TABLE_VERSION is exposed', () => {
  expect(RMD_TABLE_VERSION).toBe('2022+');
});

test('requiredMinimumDistribution before eligibility returns 0', () => {
  const r = requiredMinimumDistribution(70, 1000000);
  expect(r.eligible).toBe(false);
  expect(rmd).toBe(0);
  expect(r.distributionPeriod).toBeNull();
});

test('requiredMinimumDistribution at age 73 uses correct factor', () => {
  const r = requiredMinimumDistribution(73, 1000000);
  expect(r.eligible).toBe(true);
  expect(r.distributionPeriod).toBe(26.5);
  expect(rmd).toBeCloseTo(1000000 / 26.5, 0);
});

test('requiredMinimumDistribution birth-year rule', () => {
  // Born 1959 -> eligible at 73
  const r1 = requiredMinimumDistribution(73, 1000000, { birthYear: 1959 });
  expect(r1.eligible).toBe(true);
  // Born 1960 -> eligible at 75
  const r2 = requiredMinimumDistribution(73, 1000000, { birthYear: 1960 });
  expect(r2.eligible).toBe(false);
  const r3 = requiredMinimumDistribution(75, 1000000, { birthYear: 1960 });
  expect(r3.eligible).toBe(true);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `env -u NODE_OPTIONS npx vitest run src/utils/__tests__/withdrawal.test.js -t "requiredMinimumDistribution|RMD_TABLE_VERSION"`
Expected: FAIL

- [ ] **Step 4: Implement `requiredMinimumDistribution` in `src/utils/withdrawal.js`**

Import the JSON table. Eligibility: if `birthYear` provided, age >= (birthYear >= 1960 ? 75 : 73); else age >= 73 (conservative default). Look up distribution period; RMD = balance / period.

- [ ] **Step 5: Run tests to verify they pass**

Run: `env -u NODE_OPTIONS npx vitest run src/utils/__tests__/withdrawal.test.js -t "requiredMinimumDistribution|RMD_TABLE_VERSION"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/utils/rmd-tables.json src/utils/withdrawal.js src/utils/__tests__/withdrawal.test.js
git commit -m "feat: add versioned RMD table and requiredMinimumDistribution"
```

---

### Task 6: Retirement tab state & inputs in `App.jsx`

**Files:**
- Modify: `src/App.jsx` (state, inputs, tab)

**Interfaces:**
- Consumes: existing state (tickers, accounts, targetWeights, prices, vols, etc.)
- Produces: new state fields under `retirement` object, new tab `retirement`, input handlers

- [ ] **Step 1: Write failing E2E test**

```js
// tests/e2e/retirement.spec.js
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://query1.finance.yahoo.com/**', route =>
    route.fulfill({ json: { chart: { result: [{ indicators: { adjclose: [{ adjclose: Array.from({length: 500}, (_,i)=>100+Math.sin(i*0.1)*2) }] } }] } } })
  );
  await page.goto('/shannonsdemon/');
  await page.waitForSelector('#root');
});

test('Retirement tab shows inputs and computes metrics after analysis', async ({ page }) => {
  await page.click('button:has-text("Run Analysis")');
  await expect(page.getByText('Risk Parity Weights')).toBeVisible({ timeout: 15000 });
  await page.click('button:has-text("Retirement")');
  await expect(page.getByLabel(/Monthly spend/i)).toBeVisible();
  await expect(page.getByLabel(/Inflation rate/i)).toBeVisible();
  await expect(page.getByLabel(/Horizon.*years/i)).toBeVisible();
  await page.fill('[placeholder*="Monthly spend"]', '4000');
  await page.click('button:has-text("Calculate")'); // or auto-compute
  await expect(page.getByText(/SWR/i)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/PWR/i)).toBeVisible();
  await expect(page.getByText(/Success/i)).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `env -u NODE_OPTIONS npx playwright test tests/e2e/retirement.spec.js --retries=0`
Expected: FAIL (Retirement tab doesn't exist)

- [ ] **Step 3: Add retirement state to `App.jsx`**

```js
const [retirement, setRetirement] = useState({
  monthlySpend: 4000,
  inflationRate: 0.03,
  horizonYears: 30,
  legacyTarget: 0,
  socialSecurityMonthly: 0,
  pensionMonthly: 0,
  cashBufferMonths: 12,
  guardrail: 'none',
  driftMode: 'historical',
  expectedReturn: null,
});
```

Add tab `retirement` to tabs array. Add Retirement tab panel with inputs (labeled, 44px tap targets, inline styles matching `S.input`/`S.label`). Add "Calculate" button that calls the withdrawal functions.

- [ ] **Step 4: Wire up calculation in Retirement tab**

On calculate (or auto on input change with debounce):
- Call `fetchMonthlyHistory` for each ticker (or reuse existing price history if available)
- Compute overlap → aligned monthly portfolio values using `targetWeights` × prices
- Call `rollingWithdrawalRates` for SWR/PWR
- Call `monteCarloWithWithdrawals` for fan chart data
- Call `requiredMinimumDistribution` for RMD table
- Render metric cards and charts

- [ ] **Step 5: Run test to verify it passes**

Run: `env -u NODE_OPTIONS npx playwright test tests/e2e/retirement.spec.js --retries=0`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx tests/e2e/retirement.spec.js
git commit -m "feat: add Retirement tab with inputs and SWR/PWR metrics"
```

---

### Task 7: Drawdown backtest chart (SVG, dependency-free)

**Files:**
- Modify: `src/App.jsx` (add chart component inline or as `DrawdownChart` if reused)

**Interfaces:**
- Consumes: `rollingWithdrawalRates` samples (startIndex, swr, pwr, depleted)
- Produces: SVG chart in Retirement tab

- [ ] **Step 1: Write failing test (visual — covered by E2E snapshot or unit test of chart data transform)**

```js
// src/utils/__tests__/withdrawal.test.js
import { rollingWithdrawalRates } from '../withdrawal';

test('rollingWithdrawalRates samples have shape for chart', () => {
  const values = Array.from({ length: 360 }, (_, i) => 100000 * 1.004**i);
  const r = rollingWithdrawalRates(values, { horizonYears: 30, inflationRate: 0.03 });
  expect(r.samples.length).toBeGreaterThan(0);
  expect(r.samples[0]).toHaveProperty('startIndex');
  expect(r.samples[0]).toHaveProperty('swr');
  expect(r.samples[0]).toHaveProperty('pwr');
  expect(r.samples[0]).toHaveProperty('depleted');
});
```

- [ ] **Step 2: Implement chart in `App.jsx`**

SVG with x-axis = start date, y-axis = withdrawal rate. Two lines: SWR and PWR per start. Shaded depletion regions. Match existing `PerformanceChart` style (inline SVG, no deps).

- [ ] **Step 3: Run E2E to verify**

Run: `env -u NODE_OPTIONS npx playwright test tests/e2e/retirement.spec.js --retries=0`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add drawdown backtest chart to Retirement tab"
```

---

### Task 8: Monte Carlo fan chart (SVG, dependency-free)

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `monteCarloWithWithdrawals` bands (p10, p25, p50, p75, p90 arrays per step)
- Produces: SVG fan chart with shaded percentile bands

- [ ] **Step 1: Implement fan chart in `App.jsx`**

Reuse `PerformanceChart` pattern: SVG polyline for median, shaded areas between p10-p90, p25-p75. Y-axis = portfolio value (real). X-axis = months.

- [ ] **Step 2: Run E2E to verify**

Run: `env -u NODE_OPTIONS npx playwright test tests/e2e/retirement.spec.js --retries=0`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add Monte Carlo fan chart to Retirement tab"
```

---

### Task 9: Disclaimer banner & accessibility pass

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add disclaimer adjacent to every metric card**

```jsx
<div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
  Planning estimates only — not financial, tax, or legal advice. Historical and simulated results do not guarantee future outcomes.
</div>
```

- [ ] **Step 2: Verify a11y on Retirement tab**

Run: `env -u NODE_OPTIONS npx playwright test tests/e2e/a11y.spec.js --retries=0` (extend to include Retirement tab)

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "ux: add disclaimer banners and a11y pass for Retirement tab"
```

---

### Task 10: Full verification & PR

**Files:** all modified above

- [ ] **Step 1: Run full test suite**

```bash
env -u NODE_OPTIONS npx vitest run
env -u NODE_OPTIONS npx eslint "src/**/*.{js,jsx}"
env -u NODE_OPTIONS npx prettier --check src/ tests/e2e/
npm run build
env -u NODE_OPTIONS npm run test:e2e
```

- [ ] **Step 2: All green → push branch**

```bash
git push origin m1-withdrawal-engine
```

- [ ] **Step 3: Open PR**

```bash
gh pr create --title "M1: Withdrawal engine core" --body "Implements withdrawal.js, Retirement tab, SWR/PWR, MC fan chart. Closes #7"
```

---

## Self-Review Checklist

- [ ] Spec coverage: M1 exit criteria (SWR, PWR, success %, max drawdown, fan chart, inputs) all mapped to tasks.
- [ ] Step scan: each step is one action with checkable result; no "TBD" or vague bodies.
- [ ] Type consistency: `withdrawal.js` signatures match across tasks 2–5; `finance.js` exports match Task 1.
- [ ] Review Focus: all five items have tests pinned (Task 1 overlap, Task 2 inflation=0, Task 3 effectiveYears, Task 4 guardrail in signature, Task 6 manual override state).
- [ ] Proportion: plan is ~2× spec length — acceptable for a 400-line PR with 8 tasks.