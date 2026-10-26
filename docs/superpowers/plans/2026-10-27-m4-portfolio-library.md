# M4 Portfolio Library & Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a portfolio template library (`portfolios.js`), a diversification score function, and a `Portfolios` tab that lets users load RPR portfolio templates and compare them 3-way against their current portfolio on SWR/PWR/drawdown metrics.

**Architecture:** Pure function `portfolios.js` module exports templates and diversification score. `App.jsx` gains a new `Portfolios` tab with template selector, 3-column comparison view (Current / Template / Difference), and reuses existing retirement engine for metrics. No new runtime dependencies.

**Tech Stack:** React 18, Vite, vitest, Playwright. Inline styles only. Pure functions in `src/utils/`. `DESIGN.md` tokens normative.

**Spec:** `docs/superpowers/specs/2026-10-25-retirement-production-roadmap-design.md` (§7, §7.1, §7.2, §9 M4, §8 numeric oracle rule, §12 DoD)

## Global Constraints

- Every Node subprocess: `env -u NODE_OPTIONS <command>` (broken `NODE_OPTIONS` shim).
- No new runtime dependencies. Inline styles only; values from `DESIGN.md` tokens.
- Finance logic stays in `src/utils/` as pure functions: no DOM, no network, no clock.
- Every financial output needs a numeric oracle test — independently computed expectation at realistic scale ($100k+ portfolio, $4k+ monthly spend, 30yr horizon).
- Rates are annual; periods explicit via `periodsPerYear`. Money is dollars.
- Yahoo Finance only via `fetchQuote`/`fetchMonthlyHistory`; tests mock via MSW; E2E via Playwright route interception.
- localStorage keys `shannonsdemon_v1` / `shannonsdemon_scenarios_v1` retained for data continuity.
- One PR per milestone, < 400 lines changed. Human merges; agents never merge.
- Prettier reformats on commit (lint-staged). Large `App.jsx` diffs expected.

## Review Focus

1. **Template data accuracy** — allocations must match RPR source pages exactly; `lastReviewed` dates must be current.
2. **Diversification score thresholds** — avg correlation > 0.6 or < 4 macro classes must trigger warnings per RPR rules.
3. **Comparison math** — difference columns must show Template - Current with correct signs (positive = template has more).
4. **Template load UX** — loading a template must visibly update the sidebar tickers/weights; no silent failure.
5. **State isolation** — loading a template must not mutate the user's saved scenario until explicitly saved.

---

### Task 1: Portfolio templates module (`portfolios.js`)

**Files:**
- Create: `src/utils/portfolios.js`
- Create: `src/utils/__tests__/portfolios.test.js`

**Interfaces:**
- Consumes: nothing new (self-contained).
- Produces: `PORTFOLIO_TEMPLATES` (array of template objects), `diversificationScore(corrMatrix)`.

Template schema:
```js
{
  id: string;              // slug, e.g. 'golden-butterfly'
  name: string;            // display name
  source: string;          // 'Risk Parity Radio' or URL
  lastReviewed: string;    // ISO date YYYY-MM-DD
  description: string;     // 1-2 sentence summary
  allocations: Record<string, number>; // ticker -> weight (sum = 1)
}
```

`diversificationScore(corrMatrix)` returns:
```js
{
  avgPairwiseCorrelation: number,
  maxPairwiseCorrelation: number,
  classCount: number,        // macro classes represented (equity, bonds, commodities, real estate, etc.)
  warnings: string[]         // empty or contains warnings per RPR rules
}
```

- [ ] **Step 1: Write failing oracle tests**

```js
// portfolios.test.js
import { describe, it, expect } from 'vitest';
import { PORTFOLIO_TEMPLATES, diversificationScore } from '../portfolios';

describe('PORTFOLIO_TEMPLATES', () => {
  it('has at least 5 templates with valid allocations summing to 1', () => {
    expect(PORTFOLIO_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    for (const t of PORTFOLIO_TEMPLATES) {
      expect(t.id).toBeTypeOf('string');
      expect(t.name).toBeTypeOf('string');
      expect(t.source).toBeTypeOf('string');
      expect(t.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(t.allocations).toBeTypeOf('object');
      const sum = Object.values(t.allocations).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 6);
      for (const w of Object.values(t.allocations)) {
        expect(w).toBeGreaterThan(0);
        expect(w).toBeLessThanOrEqual(1);
      }
    }
  });

  it('contains Golden Butterfly template per RPR', () => {
    const gb = PORTFOLIO_TEMPLATES.find(t => t.id === 'golden-butterfly');
    expect(gb).toBeDefined();
    expect(gb.source).toBe('Risk Parity Radio');
    // Exact allocations from RPR page (to be filled at implementation)
    expect(gb.allocations).toEqual({
      VTI: 0.20, VIOV: 0.20, VGLT: 0.20, VGSH: 0.20, GLDM: 0.20
    });
  });

  it('contains All Seasons template', () => {
    const as = PORTFOLIO_TEMPLATES.find(t => t.id === 'all-seasons');
    expect(as).toBeDefined();
    expect(as.source).toBe('Risk Parity Radio');
  });
});

describe('diversificationScore', () => {
  it('flags high average correlation > 0.6', () => {
    const highCorr = {
      A: { A: 1, B: 0.8, C: 0.8 },
      B: { A: 0.8, B: 1, C: 0.8 },
      C: { A: 0.8, B: 0.8, C: 1 }
    };
    const r = diversificationScore(highCorr);
    expect(r.avgPairwiseCorrelation).toBeCloseTo(0.8, 2);
    expect(r.warnings).toContain('Average pairwise correlation exceeds 0.6 — portfolio may lack diversification');
  });

  it('flags low macro class count < 4', () => {
    const equityOnly = {
      VTI: { VTI: 1, VOO: 0.95 },
      VOO: { VTI: 0.95, VOO: 1 }
    };
    const r = diversificationScore(equityOnly);
    expect(r.classCount).toBeLessThan(4);
    expect(r.warnings).toContain('Fewer than 4 macro asset classes represented');
  });

  it('passes for well-diversified matrix', () => {
    const wellDiv = {
      VTI: { VTI: 1, TLT: -0.2, GLD: 0.1 },
      TLT: { VTI: -0.2, TLT: 1, GLD: 0.05 },
      GLD: { VTI: 0.1, TLT: 0.05, GLD: 1 }
    };
    const r = diversificationScore(wellDiv);
    expect(r.avgPairwiseCorrelation).toBeLessThan(0.6);
    expect(r.classCount).toBeGreaterThanOrEqual(3);
    expect(r.warnings.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `env -u NODE_OPTIONS npx vitest run src/utils/__tests__/portfolios.test.js`
Expected: FAIL — module not found / exports missing.

- [ ] **Step 3: Implement `portfolios.js`**

Create `src/utils/portfolios.js` with:
- `PORTFOLIO_TEMPLATES` array with at least 6 templates (Golden Butterfly, All Seasons, Golden Ratio, Permanent, 50/50, Aggressive) sourced from RPR pages with exact allocations and `lastReviewed` dates.
- `diversificationScore(corrMatrix)` — computes average/max pairwise correlation (excluding diagonal), counts macro classes from ticker classification heuristic (equity/bonds/commodities/real estate/cash), applies RPR warning thresholds (avg > 0.6, classes < 4).
- Export `PORTFOLIO_TEMPLATES`, `diversificationScore`, `MACRO_CLASS_MAP` (ticker -> class).

- [ ] **Step 4: Run full unit suite**

Run: `env -u NODE_OPTIONS npm test`
Expected: PASS, including new oracle tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/portfolios.js src/utils/__tests__/portfolios.test.js
git commit -m "feat: add portfolios.js with templates and diversificationScore"
```

---

### Task 2: Portfolios tab UI in `App.jsx`

**Files:**
- Modify: `src/App.jsx` (add `Portfolios` tab, template selector, 3-way comparison view)
- Modify: `src/utils/portfolios.js` (add `loadTemplate` helper if needed)

**Interfaces:**
- Consumes: `PORTFOLIO_TEMPLATES` from Task 1, `calculateRetirement` engine, `targetWeights`, `totalValue`, `accounts`.
- Produces: new tab UI state (`selectedTemplateId`, `comparisonMode`), comparison render.

UI requirements (per `DESIGN.md`):
- Tab in tab strip: "Portfolios"
- Left panel: template selector dropdown with search/filter
- Main panel: 3-column comparison (Current | Template | Difference) showing:
  - Ticker | Current Weight | Template Weight | Difference (pp)
  - SWR / PWR / Success Probability / Max Drawdown for each
- "Load Template" button → populates sidebar tickers/weights, triggers analysis
- "Compare" toggle to show/hide difference column
- Warning banner if template lacks sufficient history (effectiveYears < horizonYears)

- [ ] **Step 1: Write failing E2E test**

```js
// tests/e2e/portfolios.spec.js
import { test, expect } from '@playwright/test';

test('Portfolios tab loads templates and shows comparison', async ({ page }) => {
  await page.goto('/risk-parity-compass/');
  await page.waitForSelector('#root');
  await page.click('button:has-text("Run Analysis")');
  await expect(page.getByText('Risk Parity Weights')).toBeVisible({ timeout: 60000 });
  await page.click('button:has-text("Portfolios")');
  await expect(page.getByText('Portfolio Templates')).toBeVisible();
  await expect(page.getByRole('combobox', { name: /select template/i })).toBeVisible();
  // Select Golden Butterfly
  await page.getByRole('combobox', { name: /select template/i }).click();
  await page.getByRole('option', { name: /Golden Butterfly/i }).click();
  await expect(page.getByText('Golden Butterfly')).toBeVisible();
  // Comparison table visible
  await expect(page.getByText('Current')).toBeVisible();
  await expect(page.getByText('Template')).toBeVisible();
  await expect(page.getByText('Difference')).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `env -u NODE_OPTIONS npx playwright test tests/e2e/portfolios.spec.js -g "loads templates"`
Expected: FAIL — tab/button not found.

- [ ] **Step 3: Add Portfolios tab in `App.jsx`**

- Add tab button in tab strip (after Retirement).
- Add tab panel with template selector, comparison table, "Load Template" button.
- Reuse `targetWeights`, `totalValue`, `calculateRetirement` for metric computation.
- Add `selectedTemplateId` state, `comparisonMode` state.
- Implement `loadTemplate(templateId)` → updates `tickers`, `targetWeights`, triggers `runAnalysis`.
- Implement 3-column comparison render using `targetWeights` vs template allocations.
- Show SWR/PWR/Success/MaxDD for both current and template (reuse `calculateRetirement` results).

- [ ] **Step 4: Run unit, E2E, lint, format, build**

Run: `env -u NODE_OPTIONS npm test && env -u NODE_OPTIONS npm run test:e2e && env -u NODE_OPTIONS npm run lint && env -u NODE_OPTIONS npm run format && env -u NODE_OPTIONS npm run build`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add Portfolios tab with template library and 3-way comparison"
```

---

### Task 3: Template load triggers analysis & comparison metrics

**Files:**
- Modify: `src/App.jsx` (wire template load → analysis → retirement comparison)

**Interfaces:**
- Consumes: `calculateRetirement` (async), `rollingWithdrawalRates`, `monteCarloWithWithdrawals`.
- Produces: `comparisonResults` state with `{ current: metrics, template: metrics, difference: metrics }`.

Behavior:
- User selects template → clicks "Load Template" → tickers/weights update → "Run Analysis" auto-triggers → retirement results computed for both current and template portfolios → comparison view renders with difference column.

- [ ] **Step 1: Write failing E2E test**

```js
test('Load template triggers analysis and shows SWR comparison', async ({ page }) => {
  await page.goto('/risk-parity-compass/');
  await page.waitForSelector('#root');
  await page.click('button:has-text("Run Analysis")');
  await expect(page.getByText('Risk Parity Weights')).toBeVisible({ timeout: 60000 });
  await page.click('button:has-text("Portfolios")');
  await page.getByRole('combobox', { name: /select template/i }).click();
  await page.getByRole('option', { name: /Golden Butterfly/i }).click();
  await page.click('button:has-text("Load Template")');
  // Analysis should auto-run
  await expect(page.getByText('Risk Parity Weights')).toBeVisible({ timeout: 60000 });
  // Comparison shows SWR for both
  const swrCards = page.locator('.sd-card').filter({ hasText: 'Safe Withdrawal Rate (SWR)' });
  await expect(swrCards).toHaveCount(2); // Current + Template
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `env -u NODE_OPTIONS npx playwright test tests/e2e/portfolios.spec.js -g "Load template triggers"`
Expected: FAIL — comparison logic missing.

- [ ] **Step 3: Implement comparison logic in `App.jsx`**

- Add `comparisonResults` state.
- In `calculateRetirement`, when `comparisonMode` is true, compute metrics for both current `targetWeights` and `templateWeights`.
- Store `comparisonResults = { current: rolling, template: rolling, difference: { swr: t - c, ... } }`.
- Render comparison cards with both values and difference.
- Show "Inputs changed" stale banner when template differs from current.

- [ ] **Step 4: Run full suite**

Run: `env -u NODE_OPTIONS npm test && env -u NODE_OPTIONS npm run test:e2e && env -u NODE_OPTIONS npm run lint && env -u NODE_OPTIONS npm run build`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire template load → analysis → 3-way retirement comparison"
```

---

### Task 4: Diversification score integration & warnings

**Files:**
- Modify: `src/App.jsx` (show diversification score in Portfolios tab)
- Modify: `src/utils/portfolios.js` (ensure `diversificationScore` exported)

**Interfaces:**
- Consumes: `diversificationScore` from `portfolios.js`, `corrMatrix` from analysis.
- Produces: diversification score card + warning banner in Portfolios tab.

- [ ] **Step 1: Write failing E2E test**

```js
test('Portfolios tab shows diversification score and warnings', async ({ page }) => {
  await page.goto('/risk-parity-compass/');
  await page.waitForSelector('#root');
  await page.click('button:has-text("Run Analysis")');
  await expect(page.getByText('Risk Parity Weights')).toBeVisible({ timeout: 60000 });
  await page.click('button:has-text("Portfolios")');
  await page.getByRole('combobox', { name: /select template/i }).click();
  await page.getByRole('option', { name: /Golden Butterfly/i }).click();
  await page.click('button:has-text("Load Template")');
  await expect(page.getByText('Risk Parity Weights')).toBeVisible({ timeout: 60000 });
  // Diversification score card visible
  await expect(page.getByText(/Diversification Score/i)).toBeVisible();
  await expect(page.getByText(/Avg Pairwise Correlation/i)).toBeVisible();
  // No warning for Golden Butterfly (well-diversified)
  await expect(page.getByRole('alert')).not.toBeVisible();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `env -u NODE_OPTIONS npx playwright test tests/e2e/portfolios.spec.js -g "diversification score"`
Expected: FAIL — score card missing.

- [ ] **Step 3: Implement diversification score display**

- Call `diversificationScore(corrMatrix)` in `Portfolios` tab render.
- Render metric cards: Avg Pairwise Correlation, Max Pairwise Correlation, Macro Classes.
- Show warning banner (amber) if `warnings.length > 0` with each warning on a line.
- Use `DESIGN.md` `banner-warning` style.

- [ ] **Step 4: Run full suite**

Run: `env -u NODE_OPTIONS npm test && env -u NODE_OPTIONS npm run test:e2e && env -u NODE_OPTIONS npm run lint && env -u NODE_OPTIONS npm run build`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/utils/portfolios.js
git commit -m "feat: show diversification score and warnings in Portfolios tab"
```

---

### Task 5: Persist/load template selection & comparison state

**Files:**
- Modify: `src/App.jsx` (add `selectedTemplateId` and `comparisonMode` to persisted state)

**Interfaces:**
- Consumes: existing `saveState`/`loadState` persistence.
- Produces: `selectedTemplateId`, `comparisonMode` persisted in `shannonsdemon_v1`.

- [ ] **Step 1: Write failing test**

```js
test('Template selection and comparison mode persist across reload', async ({ page }) => {
  await page.goto('/risk-parity-compass/');
  await page.waitForSelector('#root');
  await page.click('button:has-text("Run Analysis")');
  await expect(page.getByText('Risk Parity Weights')).toBeVisible({ timeout: 60000 });
  await page.click('button:has-text("Portfolios")');
  await page.getByRole('combobox', { name: /select template/i }).click();
  await page.getByRole('option', { name: /Golden Butterfly/i }).click();
  await page.click('button:has-text("Load Template")');
  await expect(page.getByText('Risk Parity Weights')).toBeVisible({ timeout: 60000 });
  await page.reload();
  await page.waitForSelector('#root');
  await page.click('button:has-text("Portfolios")');
  // Template still selected
  await expect(page.getByRole('combobox', { name: /select template/i })).toHaveValue(/Golden Butterfly/i);
  // Comparison mode still on
  await expect(page.getByText('Difference')).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `env -u NODE_OPTIONS npx playwright test tests/e2e/portfolios.spec.js -g "persist"`
Expected: FAIL — state not persisted.

- [ ] **Step 3: Implement persistence**

- Add `selectedTemplateId` and `comparisonMode` to `saveState` payload.
- Restore in `loadState` effect.
- Ensure `comparisonMode` toggle persists.

- [ ] **Step 4: Run full suite**

Run: `env -u NODE_OPTIONS npm test && env -u NODE_OPTIONS npm run test:e2e && env -u NODE_OPTIONS npm run lint && env -u NODE_OPTIONS npm run build`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: persist template selection and comparison mode"
```

---

### Task 6: E2E value assertions & timestamped mocks (complete Task 9)

**Files:**
- Modify: `tests/e2e/portfolios.spec.js` (add numeric assertions)
- Modify: `src/mocks/handlers.js` (ensure timestamps for monthly history)
- Modify: `src/utils/__tests__/finance.test.js` (move `fetchMonthlyHistory` under MSW)

**Interfaces:**
- Consumes: timestamped Yahoo mock, numeric oracle expectations.
- Produces: E2E tests asserting metric values, not labels.

- [ ] **Step 1: Update Yahoo mock with timestamps**

Ensure `handlers.js` returns `timestamp` array for monthly history (already done in Task 9 partial).

- [ ] **Step 2: Move `fetchMonthlyHistory` tests under MSW**

```js
// src/utils/__tests__/finance.test.js
import { setupServer } from 'msw/node';
import { handlers } from '../../mocks/handlers';
const server = setupServer(...handlers);
beforeAll(() => server.listen());
afterAll(() => server.close());
```

- [ ] **Step 3: Add numeric value assertions to E2E tests**

```js
test('SWR metric is a valid percentage, not NaN', async ({ page }) => {
  // ... setup ...
  const swrText = await page.locator('[data-testid="metric-swr"]').textContent();
  expect(swrText).toMatch(/^\d+(\.\d+)?%$/);
  expect(swrText).not.toMatch(/NaN/);
});
```

Add `data-testid="metric-swr"` to metric cards in `App.jsx`.

- [ ] **Step 4: Run full suite**

Run: `env -u NODE_OPTIONS npm test && env -u NODE_OPTIONS npm run test:e2e && env -u NODE_OPTIONS npm run lint && env -u NODE_OPTIONS npm run build`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/portfolios.spec.js src/mocks/handlers.js src/utils/__tests__/finance.test.js src/App.jsx
git commit -m "test: add numeric assertions and timestamped mocks for Portfolios E2E"
```

---

### Task 7: Documentation & verification (Task 10)

**Files:**
- Modify: `README.md` (add Portfolios tab docs)
- Modify: `Known Limitations.md` (update with M4 status)
- Modify: `docs/superpowers/specs/2026-10-25-retirement-production-roadmap-design.md` (mark M4 complete)

**Interfaces:**
- Consumes: all M4 work.
- Produces: updated docs, roadmap marked complete.

- [ ] **Step 1: Update README**

Add Portfolios tab section: template list, comparison view, diversification score, load template flow.

- [ ] **Step 2: Update Known Limitations.md**

Remove "No portfolio templates yet"; note RPR template data fidelity, manual override for tickers.

- [ ] **Step 3: Update roadmap spec**

Mark M4 complete with exit evidence (test counts, template count, E2E pass).

- [ ] **Step 4: Final verification gate**

```bash
env -u NODE_OPTIONS npm test
env -u NODE_OPTIONS npm run test:e2e
env -u NODE_OPTIONS npm run lint
env -u NODE_OPTIONS npm run build
env -u NODE_OPTIONS npx playwright test tests/e2e/portfolios.spec.js
```
Expected: all green, 0 ESLint errors, build passes, E2E portfolios tests pass.

- [ ] **Step 5: Commit and push**

```bash
git add README.md "Known Limitations.md" docs/superpowers/specs/2026-10-25-retirement-production-roadmap-design.md
git commit -m "docs: record M4 portfolio library completion"
git push origin m4-portfolio-library
```

---

## Self-Review

**Spec coverage:**
- §7.1 Templates → Task 1
- §7.2 Diversification score → Task 1 + Task 4
- §9 M4 Portfolios tab & comparison → Task 2, Task 3
- §8 Numeric oracles → Task 1, Task 6
- §12 DoD → Task 7

**Type consistency:**
- `PORTFOLIO_TEMPLATES` schema consistent across Tasks 1, 2, 3.
- `diversificationScore` return type same in Tasks 1, 4.
- `comparisonResults` shape defined in Task 3, used in Task 3, 4.

**Review Focus coverage:**
1. Template data accuracy → Task 1 oracle tests + Task 2 E2E
2. Diversification thresholds → Task 1 oracle + Task 4 E2E
3. Comparison math → Task 3 oracle (difference = template - current)
4. Template load UX → Task 2, 3 E2E
5. State isolation → Task 5 E2E persistence test

**Proportion:** Plan is ~200 lines for ~40 spec lines — appropriate detail without transcribing code.

---

**Plan complete and saved to `docs/superpowers/plans/2026-10-27-m4-portfolio-library.md`. Please review the plan. Does it capture what you want?**