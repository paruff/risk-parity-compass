# M2: Tax & Account Mechanics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add RMD calculation, tax-aware withdrawal sequencing, and cash-buffer model. Extend Retirement tab with RMD table and show per-account sequencing.

**Architecture:** Extend `withdrawal.js` with `requiredMinimumDistribution`, `withdrawalSequence`, and cash-buffer logic. All pure functions. UI additions in `App.jsx` Retirement tab. No new runtime deps.

**Tech Stack:** React 18 + Vite, inline styles, vitest, Playwright, eslint/prettier.

**Spec:** `docs/superpowers/specs/2026-10-25-retirement-production-roadmap-design.md` (sections 6.5, 6.6, 9.2)

**Depends on:** M1 complete (withdrawal.js, Retirement tab, monthly history, overlap)

---

## Global Constraints

- Same as M1: single-file UI, inline styles, pure functions, Yahoo-only, localStorage, dependency-light, seeded MC, `env -u NODE_OPTIONS`, conventional commits, <400 lines/PR.
- RMD table is data-driven JSON (`rmd-tables.json` from M1 Task 5).
- Tax logic is heuristic, labeled as estimates.

---

## Review Focus (M2-specific)

1. **RMD eligibility boundary** — age 73 vs 75 by birth year; ensure the birth-year input from user is wired and used.
2. **Sequencing order invariant** — taxable → traditional → Roth must hold even when buffer refills or RMDs force traditional withdrawals.
3. **Cash buffer depletion/refill** — buffer draws first; refill rule must not create infinite loops or negative balances.
4. **RMD + sequencing interaction** — RMD from traditional IRA counts toward that account's withdrawal for the year; sequencing must respect that.
5. **Multi-account depletion** — when one account empties, sequencing shifts correctly to next account.

---

## File Structure

```
src/utils/
  withdrawal.js           # MODIFY: add withdrawalSequence, cashBuffer logic
  __tests__/
    withdrawal.test.js    # MODIFY: add sequencing, buffer, RMD integration tests
src/
  App.jsx                 # MODIFY: RMD table UI, sequencing display, buffer inputs
tests/e2e/
  retirement.spec.js      # MODIFY: extend with RMD, sequencing, buffer tests
```

---

### Task 1: `withdrawalSequence` — tax-aware ordering

**Files:**
- Modify: `src/utils/withdrawal.js`
- Modify: `src/utils/__tests__/withdrawal.test.js`

**Interfaces:**
- Produces: `withdrawalSequence(accounts, monthlySpend, { bracketHeuristic?: boolean, rmdByAccount?: Record<string, number> }) => { byAccount: Record<string, { taxable: number, traditional: number, roth: number }>, totalSpend: number, bracketUsed: number, shortfall: number }`

- [ ] **Step 1: Write failing tests**

```js
// src/utils/__tests__/withdrawal.test.js
import { withdrawalSequence } from '../withdrawal';

test('withdrawalSequence uses taxable first, then traditional, then Roth', () => {
  const accounts = { Taxable: 50000, 'Traditional IRA / 401k': 100000, 'Roth IRA': 30000 };
  const r = withdrawalSequence(accounts, 4000);
  expect(r.byAccount.Taxable).toBe(4000);
  expect(r.byAccount['Traditional IRA / 401k']).toBe(0);
  expect(r.byAccount['Roth IRA']).toBe(0);
});

test('withdrawalSequence spills to traditional when taxable exhausted', () => {
  const accounts = { Taxable: 2000, 'Traditional IRA / 401k': 100000, 'Roth IRA': 30000 };
  const r = withdrawalSequence(accounts, 4000);
  expect(r.byAccount.Taxable).toBe(2000);
  expect(r.byAccount['Traditional IRA / 401k']).toBe(2000);
  expect(r.byAccount['Roth IRA']).toBe(0);
});

test('withdrawalSequence respects RMD floor on traditional', () => {
  const accounts = { Taxable: 50000, 'Traditional IRA / 401k': 100000, 'Roth IRA': 30000 };
  const rmdByAccount = { 'Traditional IRA / 401k': 5000 }; // RMD > spend
  const r = withdrawalSequence(accounts, 4000, { rmdByAccount });
  expect(r.byAccount['Traditional IRA / 401k']).toBe(5000); // at least RMD
});

test('withdrawalSequence bracketHeuristic limits traditional to bracket', () => {
  const accounts = { Taxable: 0, 'Traditional IRA / 401k': 200000, 'Roth IRA': 100000 };
  const r = withdrawalSequence(accounts, 10000, { bracketHeuristic: true });
  // Heuristic: don't push traditional withdrawal into next marginal bracket
  // Implementation detail: cap traditional at ~44k (2024 12% bracket top for single)
  expect(r.byAccount['Traditional IRA / 401k']).toBeLessThanOrEqual(44000/12);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `env -u NODE_OPTIONS npx vitest run src/utils/__tests__/withdrawal.test.js -t "withdrawalSequence"`
Expected: FAIL

- [ ] **Step 3: Implement `withdrawalSequence` in `src/utils/withdrawal.js`**

Algorithm:
1. Compute RMD for each traditional account (using `requiredMinimumDistribution`).
2. Spend order: Taxable → Traditional (max of needed and RMD) → Roth.
3. If `bracketHeuristic`, cap traditional at estimated bracket ceiling (configurable, default ~$44k/yr for 12% bracket).
4. Track shortfall if all accounts depleted.
5. Return per-account breakdown and metadata.

- [ ] **Step 4: Run tests to verify they pass**

Run: `env -u NODE_OPTIONS npx vitest run src/utils/__tests__/withdrawal.test.js -t "withdrawalSequence"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/withdrawal.js src/utils/__tests__/withdrawal.test.js
git commit -m "feat: add withdrawalSequence with tax-aware ordering"
```

---

### Task 2: Cash buffer model

**Files:**
- Modify: `src/utils/withdrawal.js`
- Modify: `src/utils/__tests__/withdrawal.test.js`

**Interfaces:**
- Produces: `applyCashBuffer(monthlySpend, bufferMonths, portfolioValue, { refillThreshold?: number }) => { fromBuffer: number, fromPortfolio: number, newBufferMonths: number }`, integrated into `drawdownPath` when `cashBufferMonths > 0`.

- [ ] **Step 1: Write failing tests**

```js
// src/utils/__tests__/withdrawal.test.js
import { drawdownPath } from '../withdrawal';

test('drawdownPath with cash buffer draws from buffer first', () => {
  const values = Array.from({ length: 120 }, (_, i) => 100000);
  const r = drawdownPath(values, 4000, { inflationRate: 0, cashBufferMonths: 12 });
  // First 12 months should come from buffer, portfolio untouched
  expect(r.balances[11]).toBe(100000);
  expect(r.balances[12]).toBeLessThan(100000);
});

test('drawdownPath buffer refills when portfolio grows', () => {
  const values = Array.from({ length: 120 }, (_, i) => 100000 * 1.01**i); // growing
  const r = drawdownPath(values, 4000, { inflationRate: 0, cashBufferMonths: 12 });
  // Buffer should refill; portfolio balance should reflect refill
  expect(r.balances[24]).toBeGreaterThan(100000 - 4000*12);
});

test('drawdownPath buffer depletion forces portfolio withdrawal', () => {
  const values = Array.from({ length: 60 }, (_, i) => 100000); // flat
  const r = drawdownPath(values, 4000, { inflationRate: 0, cashBufferMonths: 3 });
  // Buffer lasts 3 months, then portfolio draws
  expect(r.balances[2]).toBe(100000);
  expect(r.balances[3]).toBe(96000);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `env -u NODE_OPTIONS npx vitest run src/utils/__tests__/withdrawal.test.js -t "cashBuffer|drawdownPath.*buffer"`
Expected: FAIL

- [ ] **Step 3: Implement cash buffer logic in `drawdownPath`**

Add `cashBufferMonths` parameter. Track buffer balance = `monthlySpend * cashBufferMonths`. Each month: if buffer > 0, draw from buffer; else draw from portfolio. Refill: if portfolio value > peak * (1 - 0.1) (10% below peak), refill buffer up to `cashBufferMonths * monthlySpend` from portfolio gains.

- [ ] **Step 4: Run tests to verify they pass**

Run: `env -u NODE_OPTIONS npx vitest run src/utils/__tests__/withdrawal.test.js -t "cashBuffer|drawdownPath.*buffer"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/withdrawal.js src/utils/__tests__/withdrawal.test.js
git commit -m "feat: add cash buffer model to drawdownPath"
```

---

### Task 3: RMD table UI in Retirement tab

**Files:**
- Modify: `src/App.jsx` (add RMD table panel)

**Interfaces:**
- Consumes: `requiredMinimumDistribution` from `withdrawal.js`, user birth year input
- Produces: RMD table in Retirement tab showing age, distribution period, RMD amount per traditional account

- [ ] **Step 1: Write failing E2E test**

```js
// tests/e2e/retirement.spec.js
test('Retirement tab shows RMD table for traditional accounts', async ({ page }) => {
  await page.click('button:has-text("Run Analysis")');
  await expect(page.getByText('Risk Parity Weights')).toBeVisible({ timeout: 15000 });
  await page.click('button:has-text("Retirement")');
  await page.fill('[placeholder*="Birth year"]', '1955');
  await expect(page.getByText(/Required Minimum Distribution/i)).toBeVisible({ timeout: 5000 });
  await expect(page.getByText(/Age 73/i)).toBeVisible();
  await expect(page.getByText(/Distribution period/i)).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `env -u NODE_OPTIONS npx playwright test tests/e2e/retirement.spec.js -t "RMD table" --retries=0`
Expected: FAIL

- [ ] **Step 3: Add RMD UI to Retirement tab in `App.jsx`**

- Add birth year input (label, 44px height)
- Add "RMD Projection" card/table showing per-account RMD by age (73–90)
- Use `requiredMinimumDistribution` for each traditional account balance
- Show `RMD_TABLE_VERSION` badge

- [ ] **Step 4: Run test to verify it passes**

Run: `env -u NODE_OPTIONS npx playwright test tests/e2e/retirement.spec.js -t "RMD table" --retries=0`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add RMD table to Retirement tab"
```

---

### Task 4: Withdrawal sequencing display in Retirement tab

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `withdrawalSequence` output
- Produces: Per-account breakdown table in Retirement tab

- [ ] **Step 1: Write failing E2E test**

```js
// tests/e2e/retirement.spec.js
test('Retirement tab shows withdrawal sequencing by account', async ({ page }) => {
  await page.click('button:has-text("Run Analysis")');
  await expect(page.getByText('Risk Parity Weights')).toBeVisible({ timeout: 15000 });
  await page.click('button:has-text("Retirement")');
  await page.fill('[placeholder*="Monthly spend"]', '5000');
  await expect(page.getByText(/Withdrawal sequencing/i)).toBeVisible({ timeout: 5000 });
  await expect(page.getByText(/Taxable/i)).toBeVisible();
  await expect(page.getByText(/Traditional/i)).toBeVisible();
  await expect(page.getByText(/Roth/i)).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `env -u NODE_OPTIONS npx playwright test tests/e2e/retirement.spec.js -t "sequencing" --retries=0`
Expected: FAIL

- [ ] **Step 3: Add sequencing table to Retirement tab in `App.jsx`**

Table columns: Account, Taxable withdrawal, Traditional withdrawal (incl. RMD), Roth withdrawal, Total. Show yearly totals.

- [ ] **Step 4: Run test to verify it passes**

Run: `env -u NODE_OPTIONS npx playwright test tests/e2e/retirement.spec.js -t "sequencing" --retries=0`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add withdrawal sequencing display to Retirement tab"
```

---

### Task 5: Cash buffer inputs & display

**Files:**
- Modify: `src/App.jsx` (buffer months input, buffer status in results)

- [ ] **Step 1: Add buffer months input to Retirement tab inputs** (label, number input, 44px)
- [ ] **Step 2: Show buffer status in results** — "Cash buffer: X months (Y months remaining)"
- [ ] **Step 3: Run E2E**

Run: `env -u NODE_OPTIONS npx playwright test tests/e2e/retirement.spec.js --retries=0`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add cash buffer inputs and status to Retirement tab"
```

---

### Task 6: Full verification & PR

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
git push origin m2-tax-account-mechanics
gh pr create --title "M2: Tax & account mechanics" --body "Adds RMD, withdrawal sequencing, cash buffer. Closes #8"
```

---

## Self-Review Checklist

- [ ] Spec coverage: M2 exit criteria (RMD, sequencing per account, buffer affects drawdown) all mapped.
- [ ] Step scan: each step is one checkable action.
- [ ] Type consistency: `withdrawalSequence` signature used in Task 3/4; `drawdownPath` extended with buffer param.
- [ ] Review Focus: all five M2-specific items have tests (Task 1 RMD floor, Task 1 bracket, Task 2 buffer first/refill, Task 1 RMD+sequence, Task 2 multi-account depletion).
- [ ] Proportion: plan is focused on 5 tasks for ~300 lines.