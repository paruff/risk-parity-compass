# M3: Dynamic Spending & Income Floor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement guardrail spending policies (`rpr-80`, `guyton-klinger`, `vpw`), net Social Security/pension against spending, and add a static vs guardrail comparison view in the Retirement tab.

**Architecture:** Extend `withdrawal.js` with `guardrailSpend` and integrate into `drawdownPath` / `monteCarloWithWithdrawals`. Add income floor inputs and comparison UI in `App.jsx`. All pure.

**Tech Stack:** React 18 + Vite, inline styles, vitest, Playwright, eslint/prettier.

**Spec:** `docs/superpowers/specs/2026-10-25-retirement-production-roadmap-design.md` (sections 6.6, 9.3)

**Depends on:** M2 complete (RMD, sequencing, buffer)

---

## Global Constraints

- Same as M1/M2: single-file UI, inline styles, pure functions, Yahoo-only, localStorage, dependency-light, seeded MC, `env -u NODE_OPTIONS`, conventional commits, <400 lines/PR.
- Guardrails are per-plan (state already has `guardrail` field from M1).
- Income floor (SS/pension) netted against spending before any withdrawal logic.

---

## Review Focus (M3-specific)

1. **Guardrail state persistence** — switching policies mid-session must not leak state; `analysisSignature` must include guardrail params.
2. **Guyton-Klinger boundary conditions** — prosperity rule (increase after good years) and preservation rule (cut after bad years) must not oscillate or violate floor/ceiling.
3. **VPW age indexing** — VPW table must handle ages beyond table range gracefully (cap at 100%).
4. **Income floor timing** — SS/pension start ages can differ; bridge years must be calculated correctly and shown.
5. **Comparison determinism** — static vs guardrail MC must use identical seeds for fair comparison.

---

## File Structure

```
src/utils/
  withdrawal.js           # MODIFY: add guardrailSpend, integrate into drawdownPath/MC
  __tests__/
    withdrawal.test.js    # MODIFY: add guardrail tests, income floor tests
src/
  App.jsx                 # MODIFY: guardrail selector, SS/pension inputs, comparison view
tests/e2e/
  retirement.spec.js      # MODIFY: extend with guardrail comparison, income floor tests
```

---

### Task 1: `guardrailSpend` — RPR-80 policy

**Files:**
- Modify: `src/utils/withdrawal.js`
- Modify: `src/utils/__tests__/withdrawal.test.js`

**Interfaces:**
- Produces: `guardrailSpend(currentSpend, portfolioValue, startingValue, policy, opts) => { nextSpend: number, policyState: 'normal' | 'cut' | 'recovering', cutRate: number }` where `policy` = `'rpr-80'`

- [ ] **Step 1: Write failing tests**

```js
// src/utils/__tests__/withdrawal.test.js
import { guardrailSpend } from '../withdrawal';

test('rpr-80 cuts to 6% when portfolio < 80% of starting', () => {
  const r = guardrailSpend(50000, 70000, 100000, 'rpr-80');
  expect(r.nextSpend).toBeCloseTo(0.06 * 70000, 0); // 6% of current value
  expect(r.policyState).toBe('cut');
  expect(r.cutRate).toBe(0.06);
});

test('rpr-80 stays at 6% until recovery above 80%', () => {
  let r = guardrailSpend(50000, 70000, 100000, 'rpr-80');
  expect(r.policyState).toBe('cut');
  r = guardrailSpend(r.nextSpend, 75000, 100000, 'rpr-80');
  expect(r.policyState).toBe('cut');
  r = guardrailSpend(r.nextSpend, 85000, 100000, 'rpr-80');
  expect(r.policyState).toBe('recovering'); // or 'normal'
  expect(r.nextSpend).toBeGreaterThan(0.06 * 85000); // back to normal rate
});

test('rpr-80 normal when portfolio >= 80%', () => {
  const r = guardrailSpend(50000, 90000, 100000, 'rpr-80');
  expect(r.nextSpend).toBe(50000);
  expect(r.policyState).toBe('normal');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `env -u NODE_OPTIONS npx vitest run src/utils/__tests__/withdrawal.test.js -t "guardrailSpend.*rpr-80"`
Expected: FAIL

- [ ] **Step 3: Implement `guardrailSpend` for 'rpr-80' in `src/utils/withdrawal.js`**

```js
export function guardrailSpend(currentSpend, portfolioValue, startingValue, policy, opts = {}) {
  if (policy === 'rpr-80') {
    const threshold = 0.8 * startingValue;
    if (portfolioValue < threshold) {
      return { nextSpend: 0.06 * portfolioValue, policyState: 'cut', cutRate: 0.06 };
    }
    // Recovery: if previously cut and now above threshold, return to normal
    if (opts.wasCut && portfolioValue >= threshold) {
      return { nextSpend: currentSpend, policyState: 'normal', cutRate: 0 };
    }
    return { nextSpend: currentSpend, policyState: 'normal', cutRate: 0 };
  }
  // other policies handled in Tasks 2-3
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `env -u NODE_OPTIONS npx vitest run src/utils/__tests__/withdrawal.test.js -t "guardrailSpend.*rpr-80"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/withdrawal.js src/utils/__tests__/withdrawal.test.js
git commit -m "feat: add rpr-80 guardrail spending policy"
```

---

### Task 2: `guardrailSpend` — Guyton-Klinger policy

**Files:**
- Modify: `src/utils/withdrawal.js`
- Modify: `src/utils/__tests__/withdrawal.test.js`

**Interfaces:**
- Produces: `guardrailSpend(..., policy = 'guyton-klinger', { initialRate, upperGuardrail, lowerGuardrail, ... })` with full GK rules.

- [ ] **Step 1: Write failing tests**

```js
// src/utils/__tests__/withdrawal.test.js
import { guardrailSpend } from '../withdrawal';

test('guyton-klinger cuts when portfolio drops below lower guardrail', () => {
  const opts = { initialRate: 0.05, upperGuardrail: 0.06, lowerGuardrail: 0.04 };
  // Portfolio dropped 20% from start
  const r = guardrailSpend(50000, 80000, 100000, 'guyton-klinger', opts);
  expect(r.nextSpend).toBeLessThan(50000); // cut by 10% per GK
  expect(r.policyState).toBe('cut');
});

test('guyton-klinger increases when portfolio above upper guardrail', () => {
  const opts = { initialRate: 0.05, upperGuardrail: 0.06, lowerGuardrail: 0.04 };
  // Portfolio up 20%
  const r = guardrailSpend(50000, 120000, 100000, 'guyton-klinger', opts);
  expect(r.nextSpend).toBeGreaterThan(50000); // increase by 10%
  expect(r.policyState).toBe('prosperity');
});

test('guyton-klinger respects floor/ceiling', () => {
  const opts = { initialRate: 0.05, upperGuardrail: 0.06, lowerGuardrail: 0.04 };
  // Many cuts — should not go below floor (initialRate * 0.8)
  let r = guardrailSpend(50000, 50000, 100000, 'guyton-klinger', opts);
  for (let i = 0; i < 10; i++) {
    r = guardrailSpend(r.nextSpend, 40000, 100000, 'guyton-klinger', opts);
  }
  expect(r.nextSpend).toBeGreaterThanOrEqual(50000 * 0.8);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `env -u NODE_OPTIONS npx vitest run src/utils/__tests__/withdrawal.test.js -t "guardrailSpend.*guyton"`
Expected: FAIL

- [ ] **Step 3: Implement Guyton-Klinger in `guardrailSpend`**

Rules (simplified from GK 2006):
- Withdrawal rate = spend / portfolio
- If rate > upperGuardrail → cut spend by 10%
- If rate < lowerGuardrail → increase spend by 10%
- Floor = 0.8 × initialRate; Ceiling = 1.2 × initialRate (or similar)
- Track state to prevent oscillation

- [ ] **Step 4: Run tests to verify they pass**

Run: `env -u NODE_OPTIONS npx vitest run src/utils/__tests__/withdrawal.test.js -t "guardrailSpend.*guyton"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/withdrawal.js src/utils/__tests__/withdrawal.test.js
git commit -m "feat: add guyton-klinger guardrail spending policy"
```

---

### Task 3: `guardrailSpend` — VPW (Variable Percentage Withdrawal)

**Files:**
- Modify: `src/utils/withdrawal.js`
- Modify: `src/utils/__tests__/withdrawal.test.js`

**Interfaces:**
- Produces: `guardrailSpend(..., policy = 'vpw', { age, vpwTable? })` — VPW table by age.

- [ ] **Step 1: Write failing tests**

```js
// src/utils/__tests__/withdrawal.test.js
import { guardrailSpend } from '../withdrawal';

test('vpw returns age-based percentage', () => {
  const r = guardrailSpend(50000, 100000, 100000, 'vpw', { age: 70 });
  // VPW at 70 ~ 5-6%
  expect(r.nextSpend).toBeGreaterThan(0);
  expect(r.nextSpend / 100000).toBeGreaterThan(0.04);
  expect(r.nextSpend / 100000).toBeLessThan(0.1);
});

test('vpw increases with age', () => {
  const r70 = guardrailSpend(50000, 100000, 100000, 'vpw', { age: 70 });
  const r80 = guardrailSpend(50000, 100000, 100000, 'vpw', { age: 80 });
  expect(r80.nextSpend).toBeGreaterThan(r70.nextSpend);
});

test('vpw caps at 100% for very old ages', () => {
  const r = guardrailSpend(50000, 100000, 100000, 'vpw', { age: 110 });
  expect(r.nextSpend).toBeLessThanOrEqual(100000);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `env -u NODE_OPTIONS npx vitest run src/utils/__tests__/withdrawal.test.js -t "guardrailSpend.*vpw"`
Expected: FAIL

- [ ] **Step 3: Implement VPW in `guardrailSpend`**

Embed standard VPW table (age → percentage) or compute via mortality table. Cap at 100%. Use age from user input (birth year + current year).

- [ ] **Step 4: Run tests to verify they pass**

Run: `env -u NODE_OPTIONS npx vitest run src/utils/__tests__/withdrawal.test.js -t "guardrailSpend.*vpw"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/withdrawal.js src/utils/__tests__/withdrawal.test.js
git commit -m "feat: add vpw guardrail spending policy"
```

---

### Task 4: Integrate guardrails into drawdownPath & MC

**Files:**
- Modify: `src/utils/withdrawal.js` (drawdownPath, monteCarloWithWithdrawals)
- Modify: `src/utils/__tests__/withdrawal.test.js`

**Interfaces:**
- `drawdownPath` and `monteCarloWithWithdrawals` accept `guardrail` option and call `guardrailSpend` each month/step.

- [ ] **Step 1: Write failing tests**

```js
// src/utils/__tests__/withdrawal.test.js
import { drawdownPath, monteCarloWithWithdrawals } from '../withdrawal';

test('drawdownPath with rpr-80 reduces spend after drop', () => {
  const values = Array.from({ length: 60 }, (_, i) => i < 12 ? 100000 : 70000); // drop at month 12
  const r = drawdownPath(values, 5000, { guardrail: 'rpr-80' });
  // Spend should drop after month 12
  expect(r.balances[13]).toBeGreaterThan(r.balances[12]); // less withdrawn
});

test('monteCarloWithWithdrawals guardrail affects successRate', () => {
  const allCloses = { SPY: Array.from({ length: 200 }, (_, i) => 100 * 1.005**i) };
  const weights = { SPY: 1 };
  const vols = { SPY: 0.15 };
  const corr = { SPY: { SPY: 1 } };
  const base = monteCarloWithWithdrawals(allCloses, weights, vols, corr, { simulations: 200, steps: 120, monthlySpend: 400, guardrail: 'none', seed: 1 });
  const guarded = monteCarloWithWithdrawals(allCloses, weights, vols, corr, { simulations: 200, steps: 120, monthlySpend: 400, guardrail: 'rpr-80', seed: 1 });
  expect(guarded.successRate).toBeGreaterThanOrEqual(base.successRate);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `env -u NODE_OPTIONS npx vitest run src/utils/__tests__/withdrawal.test.js -t "drawdownPath.*guardrail|monteCarloWithWithdrawals.*guardrail"`
Expected: FAIL

- [ ] **Step 3: Integrate guardrail into `drawdownPath` and `monteCarloWithWithdrawals`**

In `drawdownPath`: each month, call `guardrailSpend` with current spend, portfolio value, starting value, policy. Use returned `nextSpend` for next month.

In `monteCarloWithWithdrawals`: same, per-simulation. Track policy state per simulation.

- [ ] **Step 4: Run tests to verify they pass**

Run: `env -u NODE_OPTIONS npx vitest run src/utils/__tests__/withdrawal.test.js -t "drawdownPath.*guardrail|monteCarloWithWithdrawals.*guardrail"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/withdrawal.js src/utils/__tests__/withdrawal.test.js
git commit -m "feat: integrate guardrails into drawdownPath and Monte Carlo"
```

---

### Task 5: Income floor (Social Security / pension) inputs & netting

**Files:**
- Modify: `src/utils/withdrawal.js` (net spend helper)
- Modify: `src/App.jsx` (SS/pension inputs, bridge years display)
- Modify: `src/utils/__tests__/withdrawal.test.js`

**Interfaces:**
- Produces: `netSpend(grossSpend, ssMonthly, pensionMonthly, ssStartAge, pensionStartAge, currentAge) => { netMonthlySpend: number, bridgeYears: number, ssActive: boolean, pensionActive: boolean }`

- [ ] **Step 1: Write failing tests**

```js
// src/utils/__tests__/withdrawal.test.js
import { netSpend } from '../withdrawal';

test('netSpend subtracts SS when active', () => {
  const r = netSpend(5000, 2000, 0, 67, 0, 70);
  expect(r.netMonthlySpend).toBe(3000);
  expect(r.ssActive).toBe(true);
  expect(r.bridgeYears).toBe(0);
});

test('netSpend shows bridge years before SS starts', () => {
  const r = netSpend(5000, 2000, 0, 67, 0, 62);
  expect(r.netMonthlySpend).toBe(5000); // SS not started
  expect(r.ssActive).toBe(false);
  expect(r.bridgeYears).toBe(5);
});

test('netSpend handles both SS and pension', () => {
  const r = netSpend(5000, 2000, 1500, 67, 65, 70);
  expect(r.netMonthlySpend).toBe(1500);
  expect(r.ssActive).toBe(true);
  expect(r.pensionActive).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `env -u NODE_OPTIONS npx vitest run src/utils/__tests__/withdrawal.test.js -t "netSpend"`
Expected: FAIL

- [ ] **Step 3: Implement `netSpend` in `src/utils/withdrawal.js`**

Calculate active income based on age vs start ages. Return net spend and bridge years.

- [ ] **Step 4: Wire into Retirement tab in `App.jsx`**

Add inputs: SS monthly, SS start age, pension monthly, pension start age. Show bridge years banner. Use `netSpend` result as input to `drawdownPath` and MC.

- [ ] **Step 5: Run tests to verify they pass**

Run: `env -u NODE_OPTIONS npx vitest run src/utils/__tests__/withdrawal.test.js -t "netSpend"`
Expected: PASS

- [ ] **Step 6: Run E2E**

Run: `env -u NODE_OPTIONS npx playwright test tests/e2e/retirement.spec.js -t "income floor|bridge" --retries=0`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/utils/withdrawal.js src/App.jsx src/utils/__tests__/withdrawal.test.js
git commit -m "feat: add income floor (SS/pension) netting and bridge years"
```

---

### Task 6: Static vs Guardrail comparison view

**Files:**
- Modify: `src/App.jsx` (comparison panel in Retirement tab)

**Interfaces:**
- Consumes: two sets of results (static + guardrail) from same inputs
- Produces: side-by-side metric cards + overlaid fan charts

- [ ] **Step 1: Write failing E2E test**

```js
// tests/e2e/retirement.spec.js
test('Retirement tab shows static vs guardrail comparison', async ({ page }) => {
  await page.click('button:has-text("Run Analysis")');
  await expect(page.getByText('Risk Parity Weights')).toBeVisible({ timeout: 15000 });
  await page.click('button:has-text("Retirement")');
  await page.selectOption('select[name="guardrail"]', 'rpr-80');
  await expect(page.getByText(/Static vs Guardrail/i)).toBeVisible({ timeout: 5000 });
  await expect(page.getByText(/SWR.*Static/i)).toBeVisible();
  await expect(page.getByText(/SWR.*Guardrail/i)).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `env -u NODE_OPTIONS npx playwright test tests/e2e/retirement.spec.js -t "comparison" --retries=0`
Expected: FAIL

- [ ] **Step 3: Implement comparison view in `App.jsx`**

When guardrail !== 'none', run both static and guardrail calculations. Show two columns of metric cards (SWR, PWR, success %, max DD, terminal median). Overlay fan charts with different colors.

- [ ] **Step 4: Run test to verify it passes**

Run: `env -u NODE_OPTIONS npx playwright test tests/e2e/retirement.spec.js -t "comparison" --retries=0`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add static vs guardrail comparison view"
```

---

### Task 7: Full verification & PR

**Files:** all modified above

- [ ] **Step 1: Run full test suite**

```bash
env -u NODE_OPTIONS npx vitest run
env -u NODE_OPTIONS npx eslint "src/**/*.{js,jsx}"
env -u NODE_OPTIONS npx prettier --check src/ tests/e2e/
npm run build
env -u NODE_OPTIONS npm run test:e2e
```

- [ ] **Step 2: Push branch & open PR**

```bash
git push origin m3-dynamic-spending-income-floor
gh pr create --title "M3: Dynamic spending & income floor" --body "Adds rpr-80, guyton-klinger, vpw guardrails; SS/pension income floor; static vs guardrail comparison. Closes #9"
```

---

## Self-Review Checklist

- [ ] Spec coverage: M3 exit criteria (guardrails, income floor, comparison) all mapped.
- [ ] Step scan: each step is one checkable action; no vague bodies.
- [ ] Type consistency: `guardrailSpend` signature consistent across 3 policies; `drawdownPath`/`MC` accept guardrail option.
- [ ] Review Focus: all five M3 items have tests (Task 1 recovery state, Task 2 floor/ceiling, Task 3 age cap, Task 4 comparison seed, Task 5 bridge years).
- [ ] Proportion: 6 tasks for ~300 lines.