# M3.5 Correctness Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every retirement number the app displays arithmetically correct, and prove it with tests that cannot pass on wrong maths.

**Architecture:** Fix the portable engine (`src/utils/withdrawal.js`) first, task by task, each pinned by a numeric oracle computed independently of the implementation. Then rewire `src/App.jsx` to consume the corrected contracts, and finally replace label-only E2E assertions with value assertions. No new runtime dependencies; all functions stay pure.

**Tech Stack:** React 18, Vite, vitest, Playwright, MSW. Inline styles only.

**Spec:** `docs/superpowers/specs/2026-10-25-retirement-production-roadmap-design.md` (§6.1, §6.2, §6.3, §6.6, §8) and the review record `docs/superpowers/reviews/2026-10-26-code-review-m1-m3.md`.

## Global Constraints

- Every Node subprocess: `env -u NODE_OPTIONS <command>` (broken `NODE_OPTIONS` shim in this environment).
- No new dependencies. No CSS files; inline styles only. Finance logic stays in `src/utils/`, pure, no DOM, no network.
- All money is **dollars** unless a parameter or field is named `real`/`nominal`. All **rates are annual** unless named `monthly`.
- One PR for this milestone, human merges. Keep each commit independently green.
- Tests never hit live Yahoo Finance.
- Pre-existing storage keys `shannonsdemon_v1` / `shannonsdemon_scenarios_v1` stay unchanged in this milestone (data continuity); the key rename lands with storage v2 in M5.

## Review Focus

1. **Period mismatch (annual rate applied monthly)** — the failure that inverted both guardrail policies. A user who selects a guardrail must see spending fall in bad markets, never rise.
2. **Currency units (dollars vs normalised)** — a user with $1M and a $4k/month spend must get a sensible fan chart, not a flat line at zero.
3. **Insufficient history** — the default ticker set has ~22 years of overlap against a 30-year default horizon. The user must see what was actually computed, not `0.00%`.
4. **Invalid or cleared inputs** — empty horizon, zero portfolio, zero spend, spend ≥ portfolio. No `NaN`, no `Infinity`, no `20.00%` from a saturating binary search.
5. **Guardrail state across years and trials** — state must not leak between Monte Carlo trials or between rolling windows, and a policy must not ratchet in one direction only.

---

### Task 1: Compound withdrawals in `drawdownPath`

**Files:**
- Modify: `src/utils/withdrawal.js:53-134`
- Test: `src/utils/__tests__/withdrawal.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `drawdownPath(portfolioValues: number[], monthlySpend: number, options?: DrawdownOptions): DrawdownResult` where

```ts
type DrawdownOptions = {
  periodsPerYear?: number;      // default 12
  inflationRate?: number;       // default 0
  cashBufferMonths?: number;    // default 0   (Task 2)
  guardrail?: 'none' | 'rpr-80' | 'guyton-klinger' | 'vpw';  // default 'none'
  startingValue?: number;       // default portfolioValues[0]
  age?: number;                 // required when guardrail === 'vpw'
};

type DrawdownResult = {
  balances: number[];
  depletedYear: number | null;
  maxDrawdown: number;
  terminalReal: number;
  yearsLasted: number;
  bufferBalance: number;        // Task 2
  bufferRefills: number;        // Task 2
};
```

The recursion is normative:

```
balances[0] = portfolioValues[0] - spend(0)
balances[i] = max(0, balances[i-1] - spend(i)) * (portfolioValues[i] / portfolioValues[i-1])
```

`portfolioValues` is the **without-withdrawal** path. Once a balance reaches 0 it stays 0 and `depletedYear` records the first year fraction.

- [ ] **Step 1: Write the failing oracle tests**

```js
// flat 6%/yr real growth, $1M, 30 years
const g = 1.06 ** (1 / 12);
const flat = Array.from({ length: 360 }, (_, i) => 1_000_000 * g ** i);

it('compounds withdrawals: 7.2% spend depletes near year 28.25', () => {
  const r = drawdownPath(flat, 6000, {});
  expect(r.depletedYear).toBeCloseTo(28.25, 1);
  expect(r.terminalReal).toBe(0);
});

it('compounds withdrawals: 4% spend leaves the annuity value', () => {
  const r = drawdownPath(flat, 4000, {});
  expect(r.terminalReal).toBeCloseTo(1_817_618, -3);
});

it('never depletes when spend is below the sustainable rate', () => {
  const r = drawdownPath(flat, 5893.7, {});
  expect(r.depletedYear).toBeGreaterThan(29.9);
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `env -u NODE_OPTIONS npx vitest run src/utils/__tests__/withdrawal.test.js -t "compounds withdrawals"`
Expected: FAIL — `depletedYear` is `null` and `terminalReal` is ≈$3.5M.

- [ ] **Step 3: Replace the balance computation with the recursion**

Track a running `balance` instead of a cumulative spend total. Apply the growth factor between consecutive `portfolioValues` entries. Keep the existing inflation handling only for the real-value conversion of inputs; do not deflate a balance that is already being grown by the real path.

- [ ] **Step 4: Run the full unit suite**

Run: `env -u NODE_OPTIONS npm test`
Expected: PASS, including the three new oracles.

- [ ] **Step 5: Commit**

```bash
git add src/utils/withdrawal.js src/utils/__tests__/withdrawal.test.js
git commit -m "fix: compound withdrawals in drawdownPath"
```

---

### Task 2: Fund and refill the cash buffer

**Files:**
- Modify: `src/utils/withdrawal.js` (drawdown loop)
- Test: `src/utils/__tests__/withdrawal.test.js`

**Interfaces:**
- Consumes: `drawdownPath` from Task 1.
- Produces: `DrawdownResult.bufferBalance` (remaining buffer dollars at the end) and `bufferRefills` (count), per the Task 1 type.

Rules:
- The buffer is **carved out of the portfolio at month 0**: `balances[0] -= cashBufferMonths * monthlySpend`.
- Spend draws from the buffer first, then the portfolio.
- Refill to `cashBufferMonths * monthlySpend` whenever the portfolio exceeds 90% of its running peak.

- [ ] **Step 1: Write the failing tests**

```js
it('funds the buffer out of the portfolio', () => {
  const noBuffer = drawdownPath(flat, 4000, {});
  const buffered = drawdownPath(flat, 4000, { cashBufferMonths: 12 });
  expect(buffered.balances[0]).toBeCloseTo(noBuffer.balances[0] - 48_000, 0);
});

it('refills the buffer after a recovery', () => {
  const dip = [...flat.slice(0, 120), ...flat.slice(120).map(v => v * 0.7), ...flat.slice(240).map(v => v * 2)];
  const r = drawdownPath(dip, 4000, { cashBufferMonths: 12 });
  expect(r.bufferRefills).toBeGreaterThan(0);
  expect(r.bufferBalance).toBeGreaterThan(0);
});

it('drains the buffer before selling in a downturn', () => {
  const r = drawdownPath(flat, 4000, { cashBufferMonths: 12 });
  expect(r.bufferBalance).toBeLessThan(48_000);
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `env -u NODE_OPTIONS npx vitest run src/utils/__tests__/withdrawal.test.js -t "buffer"`
Expected: FAIL — `bufferRefills` is `undefined`.

- [ ] **Step 3: Implement funding, drawing and refill**

Compute `bufferTarget = monthlySpend * cashBufferMonths`. Deduct it from `balances[0]`. Each month take `min(bufferBalance, spend)` from the buffer. Track the portfolio peak ignoring the buffer; when `balance > 0.9 * peak` and `bufferBalance < bufferTarget`, move `min(bufferTarget - bufferBalance, balance)` from the portfolio into the buffer and increment `bufferRefills`.

- [ ] **Step 4: Run the suite**

Run: `env -u NODE_OPTIONS npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -am "fix: fund and refill the cash buffer in drawdownPath"
```

---

### Task 3: Run Monte Carlo in dollars

**Files:**
- Modify: `src/utils/withdrawal.js:280-474`
- Test: `src/utils/__tests__/withdrawal.test.js`

**Interfaces:**
- Consumes: `guardrailSpend` (Task 5 signature; until then keep the existing call shape).
- Produces: `monteCarloWithWithdrawals(allCloses, weights, vols, corrMatrix, options)` where `options.startingValue: number` is **required** and means portfolio dollars. Omitting it throws `TypeError('startingValue is required (dollars)')`.

- [ ] **Step 1: Write the failing tests**

```js
const closes = { SPY: Array.from({ length: 300 }, (_, i) => 100 * 1.007 ** i) };
const args = [closes, { SPY: 1 }, { SPY: 0.15 }, { SPY: { SPY: 1 } }];

it('requires a starting value in dollars', () => {
  expect(() => monteCarloWithWithdrawals(...args, { simulations: 10, steps: 12 })).toThrow(
    'startingValue is required'
  );
});

it('succeeds with no spending', () => {
  const r = monteCarloWithWithdrawals(...args, { simulations: 50, steps: 120, startingValue: 1e6, monthlySpend: 0 });
  expect(r.successRate).toBe(1);
  expect(r.stats.median).toBeGreaterThan(1e6);
});

it('gets worse as spending rises', () => {
  const low = monteCarloWithWithdrawals(...args, { simulations: 200, steps: 240, startingValue: 1e6, monthlySpend: 2000 });
  const high = monteCarloWithWithdrawals(...args, { simulations: 200, steps: 240, startingValue: 1e6, monthlySpend: 9000 });
  expect(high.successRate).toBeLessThan(low.successRate);
  expect(high.successRate).toBeLessThan(1);
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `env -u NODE_OPTIONS npx vitest run src/utils/__tests__/withdrawal.test.js -t "dollars"`
Expected: FAIL — no throw, and `successRate` is 0 for every spend.

- [ ] **Step 3: Initialise `portfolioValue = startingValue`**

Throw when `startingValue` is `null`/`undefined`. Remove `startingValue || 1`. Keep inflation applied to the spend, not to the balance.

- [ ] **Step 4: Run the suite**

Run: `env -u NODE_OPTIONS npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -am "fix: run monteCarloWithWithdrawals in dollars"
```

---

### Task 4: Honest historical success rate and available history

**Files:**
- Modify: `src/utils/withdrawal.js:141-243`
- Test: `src/utils/__tests__/withdrawal.test.js`

**Interfaces:**
- Consumes: `drawdownPath` from Task 1.
- Produces: `rollingWithdrawalRates(portfolioValues, options)` returning `{ swr, pwr, successRate, effectiveYears, referenceRate, worstStart, worstDepletionYear, maxDrawdown, samples }`.
  - `options.referenceRate?: number` — default `0.04`. `successRate` is the share of windows in which this **fixed** rate survives.
  - `effectiveYears = min(horizonYears, n / periodsPerYear)`; compute over `floor(effectiveYears * periodsPerYear)` months instead of returning zeros.

- [ ] **Step 1: Write the failing tests**

```js
it('computes over available history instead of returning zeros', () => {
  const short = flat.slice(0, 263); // ~21.9 years
  const r = rollingWithdrawalRates(short, { horizonYears: 30 });
  expect(r.effectiveYears).toBeCloseTo(21.9, 1);
  expect(r.swr).toBeGreaterThan(0.06);
});

it('reports success at a fixed reference rate, not at the SWR', () => {
  const falling = flat.map((_, i) => flat[i] * (i > 200 ? 0.6 : 1));
  expect(rollingWithdrawalRates(falling, { referenceRate: 0.12 }).successRate).toBeLessThan(1);
  expect(rollingWithdrawalRates(flat, { referenceRate: 0.04 }).successRate).toBe(1);
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `env -u NODE_OPTIONS npx vitest run src/utils/__tests__/withdrawal.test.js -t "available history"`
Expected: FAIL — `swr` is 0 and `effectiveYears` is `undefined`.

- [ ] **Step 3: Implement `effectiveYears` and `referenceRate`**

Break the early return into `horizonMonths < 1`. Evaluate `depleted` with the reference rate rather than with `swr`.

- [ ] **Step 4: Run the suite**

Run: `env -u NODE_OPTIONS npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -am "fix: report honest success rate and available history"
```

---

### Task 5: Make guardrails annual-rate correct

**Files:**
- Modify: `src/utils/withdrawal.js:630-716`, and both call sites in `drawdownPath` and `monteCarloWithWithdrawals`
- Test: `src/utils/__tests__/withdrawal.test.js`

**Interfaces:**
- Produces: `guardrailSpend(currentSpendPerPeriod, portfolioValue, startingValue, policy, opts)` returning `{ nextSpend, policyState, cutRate }`, where `nextSpend` is **per period**.
  - `opts.periodsPerYear?: number` — default 12.
  - `opts.initialRate?: number` — default `monthlySpend * periodsPerYear / startingValue` supplied by the caller.
  - `opts.originalSpend?: number` — used by rpr-80 recovery.
  - `opts.age` — required for `vpw`; throw when absent.

- [ ] **Step 1: Write the failing oracle tests at realistic scale**

```js
it('rpr-80 cuts spending when the portfolio falls below 80%', () => {
  const r = guardrailSpend(4000, 790_000, 1_000_000, 'rpr-80', { periodsPerYear: 12 });
  expect(r.nextSpend).toBeCloseTo(3_950, 0); // 6% of 790k per year / 12
  expect(r.nextSpend).toBeLessThan(4000);
});

it('guyton-klinger does not raise spending at a sustainable rate', () => {
  const r = guardrailSpend(4000, 1_000_000, 1_000_000, 'guyton-klinger', {
    periodsPerYear: 12,
    initialRate: 0.048,
  });
  expect(r.nextSpend).toBe(4000);
  expect(r.policyState).toBe('normal');
});

it('vpw tracks the age percentage', () => {
  const r = guardrailSpend(4000, 1_000_000, 1_000_000, 'vpw', { age: 70, periodsPerYear: 12 });
  expect(r.nextSpend).toBeCloseTo((1_000_000 * 0.051) / 12, 0);
});

it('never spends more than the portfolio in a period', () => {
  const r = guardrailSpend(4000, 1000, 1_000_000, 'rpr-80', { periodsPerYear: 12 });
  expect(r.nextSpend).toBeLessThanOrEqual(1000);
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `env -u NODE_OPTIONS npx vitest run src/utils/__tests__/withdrawal.test.js -t "guardrail"`
Expected: FAIL — rpr-80 returns 47,400 and Guyton-Klinger returns 40,000.

- [ ] **Step 3: Apply the period contract**

Divide every rate-derived amount by `periodsPerYear`; annualise `currentRate` before comparing against the GK bands; apply GK floor/ceiling only inside the cut/raise branches; use `originalSpend` for rpr-80 recovery and track `wasCut` locally in `drawdownPath`; clamp every result to `portfolioValue`.

- [ ] **Step 4: Thread `periodsPerYear`, `initialRate` and `age` through both callers**

`drawdownPath` passes `initialRate = (monthlySpend * periodsPerYear) / effectiveStartingValue` and `originalSpend = monthlySpend`. Both callers pass `age` when provided, and `drawdownPath` throws `Error('VPW policy requires age')` when `guardrail === 'vpw'` and `age == null`.

- [ ] **Step 5: Run the suite**

Run: `env -u NODE_OPTIONS npm test`
Expected: PASS, including the previously vacuous guardrail test, which must now assert that guarded spending differs from unguarded on a realistic config.

- [ ] **Step 6: Commit**

```bash
git commit -am "fix: apply guardrail rates on the correct period"
```

---

### Task 6: Correct withdrawal sequencing

**Files:**
- Modify: `src/utils/withdrawal.js:483-536`
- Test: `src/utils/__tests__/withdrawal.test.js`

**Interfaces:**
- Produces: `withdrawalSequence(accounts, monthlySpend, options)` returning `{ byAccount: { [account]: number }, totalSpend, rmdSurplus, shortfall }`, all monthly. `byAccount` values stay **numbers** (the UI builds its own rows). `rmdSurplus = max(0, rmdMonthly - remainingSpendBeforeTraditional)`.

- [ ] **Step 1: Write the failing tests**

```js
it('never truncates an RMD below its floor', () => {
  const r = withdrawalSequence(
    { Taxable: 100_000, 'Traditional IRA / 401k': 500_000, 'Roth IRA': 0 },
    1000,
    { bracketHeuristic: true, traditionalBracketCap: 500, rmdByAccount: { 'Traditional IRA / 401k': 2000 } }
  );
  expect(r.byAccount['Traditional IRA / 401k']).toBe(2000);
});

it('reports the RMD surplus so the columns foot', () => {
  const r = withdrawalSequence(
    { Taxable: 0, 'Traditional IRA / 401k': 500_000, 'Roth IRA': 0 },
    1000,
    { rmdByAccount: { 'Traditional IRA / 401k': 2500 } }
  );
  expect(r.totalSpend).toBe(2500);
  expect(r.rmdSurplus).toBe(1500);
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `env -u NODE_OPTIONS npx vitest run src/utils/__tests__/withdrawal.test.js -t "RMD"`
Expected: FAIL — the first returns 500, the second has no `rmdSurplus`.

- [ ] **Step 3: Implement the floor and the surplus**

`traditionalUsed = min(traditionalBalance, max(traditionalBracketCap ? min(needed, cap) : needed, rmdMonthly))`; `totalSpend = taxable + traditional + roth`; `rmdSurplus` as defined.

- [ ] **Step 4: Run the suite**

Run: `env -u NODE_OPTIONS npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -am "fix: keep RMD floors intact and report RMD surplus"
```

---

### Task 7: Weight the backtest portfolio correctly

**Files:**
- Create: `src/utils/portfolioPath.js`
- Test: `src/utils/__tests__/portfolioPath.test.js`

**Interfaces:**
- Produces: `buildPortfolioPath(seriesByTicker: Record<string, number[]>, weights: Record<string, number>, startingValue: number): number[]` — `path[i] = startingValue * Σ w_k * series_k[i] / series_k[0]`. Tickers missing from `seriesByTicker` are dropped and the remaining weights renormalised. Returns `[]` when no ticker has a series.

- [ ] **Step 1: Write the failing test**

```js
it('weights by target weight, not by share price', () => {
  const path = buildPortfolioPath(
    { SPY: [600, 660], TLT: [85, 85] },
    { SPY: 0.5, TLT: 0.5 },
    100_000
  );
  expect(path[0]).toBeCloseTo(100_000, 0);
  expect(path[1]).toBeCloseTo(105_000, 0); // SPY +10% on half the portfolio
});

it('renormalises weights for tickers without history', () => {
  const path = buildPortfolioPath({ SPY: [100, 110], TLT: [50, 52] }, { SPY: 0.5, TLT: 0.3, GLD: 0.2 }, 1000);
  expect(path[1]).toBeCloseTo(1000 * (0.5 * 1.1 + 0.3 * 1.04) / 0.8, 2);
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `env -u NODE_OPTIONS npx vitest run src/utils/__tests__/portfolioPath.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `buildPortfolioPath`**

Normalise each series to its first point, multiply by weight, sum, multiply by `startingValue`.

- [ ] **Step 4: Run the suite**

Run: `env -u NODE_OPTIONS npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/portfolioPath.js src/utils/__tests__/portfolioPath.test.js
git commit -m "fix: weight the backtest portfolio by target weight"
```

---

### Task 8: Rewire `App.jsx` to the corrected contracts

**Files:**
- Modify: `src/App.jsx` (`calculateRetirement`, Retirement tab render, `analysisSignature`)
- Test: `tests/e2e/retirement.spec.js`

**Interfaces:**
- Consumes: every function above.
- Produces: no new exports.

Required changes, each independently checkable:

1. Replace `const { netSpend } = await import('./utils/withdrawal')` with a static import; the build must fail if a named export disappears.
2. Render `retirementResults.error` as an error banner and do **not** render metric cards when it is set.
3. Pass `startingValue: totalValue` to `monteCarloWithWithdrawals` and use `buildPortfolioPath` for the historical series.
4. Pass `age = new Date().getFullYear() - retirement.birthYear` to both guardrail call sites.
5. Convert the annual RMD to monthly when building `rmdByAccount`; exclude `Roth IRA` from RMD accounts (use an explicit `RMD_ACCOUNTS` constant).
6. Build sequencing rows explicitly rather than spreading numbers; compute `withdrawalSequence` once per render.
7. Report the buffer card from `drawdownPath().bufferBalance`, guarded by `netMonthlySpend > 0`.
8. Clamp `horizonYears` to `>= 1` on input and display `rolling.effectiveYears` when it is below the requested horizon.
9. Persist `retirement` in `saveState`/`loadState` (additive to the existing v1 payload).
10. Include the guardrail, cash buffer, spend, horizon and income-floor fields in `analysisSignature` and show the stale banner when they change.
11. Hide or clearly mark as "not yet applied" any control whose value no calculation consumes; after this task, that set must be empty.

- [ ] **Step 1: Write the failing E2E assertions**

```js
test('retirement metrics are real numbers, not NaN', async ({ page }) => {
  await page.getByRole('button', { name: /run analysis/i }).click();
  await expect(page.getByText('Safe Withdrawal Rate (SWR)')).toBeVisible();
  await expect(page.getByText(/NaN/)).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0); // no error banner
  const swr = await page.locator('[data-testid="metric-swr"]').innerText();
  expect(swr).toMatch(/^\d+(\.\d+)?%$/);
});

test('the sequencing table shows dollar amounts', async ({ page }) => {
  const first = page.locator('[data-testid="seq-row-taxable"] td').nth(1);
  await expect(first).toHaveText(/^\$[\d,]+(\.\d{2})?$/);
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `env -u NODE_OPTIONS npx playwright test retirement.spec.js -g "real numbers"`
Expected: FAIL — no `data-testid="metric-swr"`, or `NaN%` present.

- [ ] **Step 3: Add the `data-testid` hooks and apply changes 1–11**

Add `data-testid="metric-swr"` and `data-testid="seq-row-taxable"` to the existing markup; change nothing else in the visual design.

- [ ] **Step 4: Run unit, E2E, lint, format and build**

Run: `env -u NODE_OPTIONS npm test && env -u NODE_OPTIONS npm run test:e2e && env -u NODE_OPTIONS npm run lint && env -u NODE_OPTIONS npm run format && env -u NODE_OPTIONS npm run build`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git commit -am "fix: wire the corrected withdrawal contracts into the UI"
```

---

### Task 9: Make the test harness able to fail

**Files:**
- Modify: `tests/e2e/retirement.spec.js` (Yahoo mock), `src/mocks/handlers.js`, `src/utils/__tests__/finance.test.js`

- [ ] **Step 1: Add `timestamp` to every mocked monthly response**

Each mock point needs `{ date, close, adjclose, timestamp }` with timestamps 30 days apart, at least 500 points, so `fetchMonthlyHistory` and `computeOverlap` run.

- [ ] **Step 2: Move `fetchMonthlyHistory` tests under MSW**

Use `setupServer(...handlers)` in `src/utils/__tests__/finance.test.js`, matching the pattern in `fetchQuote.test.js`. No test may reach `query1.finance.yahoo.com`.

- [ ] **Step 3: Prove the mock works**

Run: `env -u NODE_OPTIONS npx playwright test retirement.spec.js`
Expected: PASS, and the SWR metric shows a non-zero percentage.

- [ ] **Step 4: Commit**

```bash
git commit -am "test: give the retirement mocks real timestamps and a value oracle"
```

---

### Task 10: Document and verify

**Files:**
- Modify: `Known Limitations.md`, `README.md`, `docs/superpowers/specs/2026-10-25-retirement-production-roadmap-design.md` (§9 M3.5 state)

- [ ] **Step 1: Update `Known Limitations.md`** — remove "No RMD logic yet"; state the remaining limitations honestly: heuristic tax logic, constant inflation, Yahoo single source, historical overlap limits, and that guardrails are models not advice.

- [ ] **Step 2: Mark M3.5 shipped in the roadmap** and record the exit evidence (test counts, oracle results).

- [ ] **Step 3: Run the full gate**

```bash
env -u NODE_OPTIONS npm test
env -u NODE_OPTIONS npm run test:e2e
env -u NODE_OPTIONS npm run lint
env -u NODE_OPTIONS npm run build
```

Expected: green, with 0 ESLint warnings (fix the 10 pre-existing warnings in this PR).

- [ ] **Step 4: Commit and open one PR**

```bash
git commit -am "docs: record M3.5 correctness remediation"
```

Title: `M3.5: correctness remediation`. Body links the review record and lists each Critical finding it closes. Human merges.

---

## Self-Review

**Spec coverage:** §6.1 recursion → Task 1. §6.2 success/effective history → Task 4. §6.3 dollar units → Task 3. §6.6 period contract → Task 5. §8 numeric oracles → Tasks 1–7 plus Task 9. §5.5 UI obligations and the review's UI findings → Task 8. Buffer funding/refill (§9.2) → Task 2. Portfolio path weighting (review C9) → Task 7. Sequencing (review C5, C6, C8) → Tasks 6 and 8. Docs (§12) → Task 10.

**Gaps found and accepted:** modelling the income floor as a *step* at the SS/pension start age (review Important #6) is **deferred to M4**, because it changes the drawdown contract's spend signature. Task 8 instead labels the bridge card explicitly as "income assumed from year 0" so the current behaviour is not silently misleading. This is a deliberate scope cut, recorded here so it is not lost.

**Type consistency:** `periodsPerYear` is used with the same meaning in Tasks 1, 4 and 5. `startingValue` means dollars in Tasks 1 and 3. `byAccount` stays a map of numbers throughout; only the UI builds rows. `effectiveYears` is produced in Task 4 and consumed in Task 8.9.

**Review Focus:** each of the five lines has an owning task and a test — 1 → Task 5, 2 → Task 3, 3 → Task 4, 4 → Tasks 1 and 8.8, 5 → Task 5 Step 5 (a leak test across two `drawdownPath` calls) plus Task 3's determinism assertion.
