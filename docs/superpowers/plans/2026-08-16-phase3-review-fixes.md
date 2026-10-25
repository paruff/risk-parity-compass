# Phase 3 Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 6 findings from the Phase 1-3 code review of shannonsdemon (a solo-maintainer, no-backend React/Vite portfolio rebalancer deployed to GitHub Pages) without expanding scope beyond what each finding actually calls for.

**Architecture:** No architectural change except Task 6, which is an optional, behavior-preserving JSX extraction. Everything else is a same-file, same-function fix: two pure-function fixes in `src/utils/finance.js` (with new Vitest unit tests), one JSX fix in `src/App.jsx`, one CI YAML fix, and one dead-code cleanup.

**Tech Stack:** React 18 + Vite, Vitest (unit), Playwright + `@axe-core/playwright` (E2E/a11y), GitHub Actions (CI + Pages deploy).

**Spec:** This plan implements the findings from the Phase 1-3 code review conducted in this session (no separate spec doc — see the review findings summarized in Global Constraints and per-task below).

## Global Constraints

- Ponytail/lazy-dev mode is active for this project: fixes must be proportionate to the finding's severity. Do not use Task 5 (the only architectural item) as an excuse to restructure `App.jsx` beyond extracting the three named sections.
- No new dependencies. No new test frameworks — use the existing Vitest (`npm test`), Playwright (`npm run test:e2e`), ESLint (`npm run lint`), and build (`npm run build`) tooling.
- Every task must leave `npm run lint`, `npm test`, and `npm run build` green.
- Preserve existing visual behavior and copy exactly except where a finding explicitly requires a behavior change (Task 1, Task 2).
- Commit after each task with a `fix:`/`refactor:`/`ci:` conventional-commit message (per this repo's existing commit history style).

---

### Task 1: Clamp risk-contribution bar width (HIGH — App.jsx:1346)

A hedging asset can have a legitimately negative `riskContribution()`. The Risk Contribution bar renders `width: `${rc * 100}%``, which browsers clamp to 0 for negative values — the bar silently disappears while the adjacent `fmt.pct(rc)` label still shows the negative number, so the bar and the label visibly disagree. Line 782 in the same file already guards an analogous case with `Math.max(0, ...)`; this task follows that established pattern via a small, testable helper in `finance.js` rather than an inline `Math.max` in JSX (consistent with `fmt` already living in `finance.js`).

**Files:**
- Modify: `src/utils/finance.js` (add `clampPct` next to `fmt`, export it)
- Modify: `src/App.jsx:1346` (use `clampPct(rc)` for the bar width)
- Modify: `src/App.jsx:14-29` (import `clampPct`)
- Test: `src/utils/__tests__/finance.test.js`

**Interfaces:**
- Produces: `clampPct(v: number): number` — clamps `v` to the `[0, 1]` range. Exported from `src/utils/finance.js` alongside `fmt`.

- [ ] **Step 1: Write the failing test**

Add to `src/utils/__tests__/finance.test.js`. First update the import block at the top of the file to include `clampPct`:

```javascript
import {
  taxLocationWaterfall,
  generateTrades,
  closestTickers,
  dailyReturns,
  correlation,
  correlationMatrix,
  riskContribution,
  simulatePerformance,
  clampPct,
} from '../finance';
```

Then add this new `describe` block at the end of the file:

```javascript
describe('clampPct', () => {
  it('clamps negative values to 0', () => {
    expect(clampPct(-0.05)).toBe(0);
  });
  it('clamps values above 1 to 1', () => {
    expect(clampPct(1.2)).toBe(1);
  });
  it('passes through in-range values unchanged', () => {
    expect(clampPct(0.42)).toBe(0.42);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `clampPct` is not exported from `../finance` (import error or `undefined is not a function`).

- [ ] **Step 3: Add `clampPct` to `src/utils/finance.js`**

In `src/utils/finance.js`, find the `fmt` object (currently starting at line 412):

```javascript
const fmt = {
  pct: v => `${(v * 100).toFixed(1)}%`,
```

Add `clampPct` immediately above it:

```javascript
// Clamp a ratio to [0, 1] for use as a CSS percentage width — negative
// risk contributions (a hedging asset) must not render as a negative width.
const clampPct = v => Math.max(0, Math.min(1, v));

const fmt = {
  pct: v => `${(v * 100).toFixed(1)}%`,
```

Then find the `export` block at the bottom of the file:

```javascript
export {
  taxLocationWaterfall,
  generateTrades,
  closestTickers,
  dailyReturns,
  correlation,
  correlationMatrix,
  riskContribution,
  simulatePerformance,
  fmt,
};
```

Add `clampPct` to it:

```javascript
export {
  taxLocationWaterfall,
  generateTrades,
  closestTickers,
  dailyReturns,
  correlation,
  correlationMatrix,
  riskContribution,
  simulatePerformance,
  clampPct,
  fmt,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all suites, including the new `clampPct` block)

- [ ] **Step 5: Use `clampPct` in the Risk Contribution bar**

In `src/App.jsx`, update the import block (currently lines 15-29):

```javascript
import {
  TAX_INEFFICIENCY,
  ACCOUNT_TYPES,
  LOOKBACK_OPTIONS,
  fetchQuote,
  annualizedVol,
  inverseVolWeights,
  taxLocationWaterfall,
  generateTrades,
  closestTickers,
  correlationMatrix,
  riskContribution,
  simulatePerformance,
  fmt,
} from './utils/finance';
```

to:

```javascript
import {
  TAX_INEFFICIENCY,
  ACCOUNT_TYPES,
  LOOKBACK_OPTIONS,
  fetchQuote,
  annualizedVol,
  inverseVolWeights,
  taxLocationWaterfall,
  generateTrades,
  closestTickers,
  correlationMatrix,
  riskContribution,
  simulatePerformance,
  clampPct,
  fmt,
} from './utils/finance';
```

Then in the Risk Contribution bar (currently around line 1339-1352):

```javascript
                                  {/* Risk contribution bar */}
                                  <div
                                    style={{
                                      position: 'absolute',
                                      left: 0,
                                      top: 2,
                                      height: 12,
                                      width: `${rc * 100}%`,
                                      background: diff > 0.02 ? '#f59e0b88' : '#16a34a88',
                                      borderRadius: 2,
                                      opacity: 0.85,
                                      transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                                    }}
                                  />
```

change `width: \`${rc * 100}%\`,` to:

```javascript
                                      width: `${clampPct(rc) * 100}%`,
```

- [ ] **Step 6: Run full checks**

Run: `npm run lint && npm test && npm run build`
Expected: all three pass.

- [ ] **Step 7: Commit**

```bash
git add src/utils/finance.js src/utils/__tests__/finance.test.js src/App.jsx
git commit -m "fix: clamp risk contribution bar width for hedging assets"
```

---

### Task 2: Normalize risk contribution when total is zero or negative (MEDIUM — finance.js:333)

`riskContribution()` only normalizes to percentages when `totalRC > 0`. A well-hedged portfolio (near-perfectly negatively correlated assets) has near-zero total variance, so `totalRC` can legitimately be `<= 0`. In that branch the function currently returns raw, non-normalized covariance units while the UI still formats them with `fmt.pct`, silently breaking the "sums to 100%" contract from the Phase 3 plan with no error surfaced.

**Files:**
- Modify: `src/utils/finance.js:303-339` (`riskContribution` function)
- Test: `src/utils/__tests__/finance.test.js`

**Interfaces:**
- Consumes: no signature change to `riskContribution(weights, vols, corrMatrix)`.
- Produces: `riskContribution(...)` now always returns an object whose values sum to `1` (previously only guaranteed when `totalRC > 0`).

- [ ] **Step 1: Write the failing test**

Add to the existing `describe('riskContribution')` block in `src/utils/__tests__/finance.test.js` (after the existing two `it` blocks):

```javascript
  it('falls back to an equal split when total risk contribution is zero (fully hedged portfolio)', () => {
    const weights = { A: 0.5, B: 0.5 };
    const vols = { A: 0.1, B: 0.1 };
    const corr = { A: { A: 1, B: -1 }, B: { A: -1, B: 1 } };
    const rc = riskContribution(weights, vols, corr);
    expect(rc.A).toBeCloseTo(0.5, 5);
    expect(rc.B).toBeCloseTo(0.5, 5);
    expect(rc.A + rc.B).toBeCloseTo(1, 5);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — with the current code, `rc.A` and `rc.B` are both `0` (raw, non-normalized), not `0.5`.

- [ ] **Step 3: Implement the fallback**

In `src/utils/finance.js`, find:

```javascript
  // Normalize to percentages
  if (totalRC > 0) {
    for (const t of tickers) {
      rc[t] = rc[t] / totalRC;
    }
  }
  return rc;
```

Replace with:

```javascript
  // Normalize to percentages. A fully (or near-fully) hedged portfolio can
  // have ~zero total variance, i.e. totalRC <= 0; fall back to an equal
  // split so the "sums to 100%" contract always holds instead of silently
  // returning raw, non-normalized covariance units.
  if (totalRC > 0) {
    for (const t of tickers) {
      rc[t] = rc[t] / totalRC;
    }
  } else {
    for (const t of tickers) {
      rc[t] = 1 / n;
    }
  }
  return rc;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all suites)

- [ ] **Step 5: Run full checks**

Run: `npm run lint && npm test && npm run build`
Expected: all three pass.

- [ ] **Step 6: Commit**

```bash
git add src/utils/finance.js src/utils/__tests__/finance.test.js
git commit -m "fix: normalize risk contribution to 100% for hedged portfolios"
```

---

### Task 3: Fix GitHub Pages deploy build_type mismatch (MEDIUM — deploy.yml:34)

The deploy workflow's "Enable GitHub Pages" step force-sets `build_type=legacy` (branch-based deploys) immediately before the `deploy` job runs `actions/deploy-pages@v4`, which requires Pages to be configured for `build_type=workflow` (Actions-based deploys). If the `gh api` call succeeds, it can silently reconfigure Pages back to legacy delivery right before the workflow-based deploy step, and any resulting failure is masked by the `|| echo ::warning` fallback.

**Files:**
- Modify: `.github/workflows/deploy.yml:34-39`

**Interfaces:** None (CI config only).

- [ ] **Step 1: Fix the build_type**

In `.github/workflows/deploy.yml`, find:

```yaml
      - name: Enable GitHub Pages
        run: |
          gh api repos/{owner}/{repo}/pages -f build_type=legacy -f source='{"branch":"main","path":"/"}' 2>/dev/null || \
          echo "::warning::GitHub Pages may not be enabled. Enable it at https://github.com/${{ github.repository }}/settings/pages"
        env:
          GH_TOKEN: ${{ github.token }}
```

Replace with:

```yaml
      - name: Enable GitHub Pages
        run: |
          gh api repos/{owner}/{repo}/pages -f build_type=workflow 2>/dev/null || \
          echo "::warning::GitHub Pages may not be enabled. Enable it at https://github.com/${{ github.repository }}/settings/pages"
        env:
          GH_TOKEN: ${{ github.token }}
```

(`build_type=workflow` matches how the job actually deploys, via `actions/deploy-pages@v4`. The `source` field is a `build_type=legacy` option only and is dropped — it has no effect for `build_type=workflow`.)

- [ ] **Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml, sys; yaml.safe_load(open('.github/workflows/deploy.yml'))" && echo "YAML OK"`

Expected: `YAML OK` (requires Python 3 with PyYAML; if unavailable, visually diff-check the file for correct indentation instead — this is a two-line change).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: fix Pages build_type to match actions/deploy-pages workflow deploys"
```

- [ ] **Step 4: Verify on push**

This step cannot be validated locally (no local GitHub Actions/Pages API). After this commit reaches `main`, watch the "Deploy to GitHub Pages" workflow run in the Actions tab and confirm the `deploy` job succeeds and the site is reachable at the Pages URL.

---

### Task 4: Remove dead code and clarify buy-and-hold accumulation (LOW — finance.js:355, 366)

`simulatePerformance()` computes a `bhValues` object that is never read (superseded by `bhDollars` further down), and pushes `buyAndHold[0] * bhTotal` where `buyAndHold[0]` is always `1` for the life of the loop — it reads as if it depends on the running array, inviting a future "fix" into `buyAndHold[buyAndHold.length - 1] * bhTotal`, which would actually break the compounding math (each `bhTotal` is already the absolute cumulative value, not a per-step multiplier).

This is a pure cleanup with no behavior change — the existing `simulatePerformance` tests are the regression check.

**Files:**
- Modify: `src/utils/finance.js:353-358, 406`

**Interfaces:** None (no signature or behavior change).

- [ ] **Step 1: Confirm current tests pass before touching the code**

Run: `npm test`
Expected: PASS (baseline, in particular the `describe('simulatePerformance')` block)

- [ ] **Step 2: Remove the dead `bhValues` block**

In `src/utils/finance.js`, find:

```javascript
  // Current weights (rebalanced) and buy-and-hold weights
  const currentWeights = { ...weights };
  const bhValues = {};
  for (const t of tickers) {
    bhValues[t] = weights[t] * (allCloses[t][0] ?? 1);
  }

  const rebalanced = [1];
```

Replace with:

```javascript
  // Current weights (rebalanced), drift-tracked across the loop
  const currentWeights = { ...weights };

  const rebalanced = [1];
```

- [ ] **Step 3: Clarify the buy-and-hold push**

In the same function, find:

```javascript
    buyAndHold.push(buyAndHold[0] * bhTotal);
```

Replace with:

```javascript
    // bhTotal is already the absolute cumulative value (starts at 1, since
    // bhDollars is normalized to sum to 1) — push it directly.
    buyAndHold.push(bhTotal);
```

- [ ] **Step 4: Run tests to confirm no behavior change**

Run: `npm test`
Expected: PASS — identical results to Step 1 (all `simulatePerformance` assertions, including `result.buyAndHold[0]` still `1` and equal-length arrays, are unaffected since `bhTotal` at `d=1`'s formula is unchanged).

- [ ] **Step 5: Run full checks**

Run: `npm run lint && npm test && npm run build`
Expected: all three pass.

- [ ] **Step 6: Commit**

```bash
git add src/utils/finance.js
git commit -m "refactor: remove dead code and clarify buy-and-hold accumulation"
```

---

### Task 5 (optional): Extract Phase 3 Analysis sections into components (LOW/architectural — App.jsx is 1753 lines)

`App.jsx` is more than double the project's own 800-line file ceiling, and Phase 3 added ~334 more lines of markup inline rather than as separate components. This task extracts exactly the three Phase 3 sections (Risk Contribution, Correlation Matrix, Performance Chart) into their own files under `src/components/`, following the existing pattern set by `src/components/Tooltip.jsx` and `src/components/ErrorBoundary.jsx`. This is a pure extraction — no JSX, styling, or behavior changes — so the existing Playwright/axe E2E suite is the regression check.

This task is lower priority than Tasks 1-4 and is scoped narrowly on purpose (per ponytail/lazy-dev guidance for this project): it does not attempt a full `App.jsx` restructure, only lifts out the three self-contained blocks this review specifically flagged.

**Files:**
- Create: `src/components/RiskContribution.jsx`
- Create: `src/components/CorrelationMatrix.jsx`
- Create: `src/components/PerformanceChart.jsx`
- Modify: `src/App.jsx` (replace the three inline blocks with component calls; add imports; drop now-unused local imports from `./utils/finance`)

**Interfaces:**
- Produces: `RiskContribution({ S, tickers, targetWeights, riskContrib })` — presentational, no internal state.
- Produces: `CorrelationMatrix({ S, tickers, corrMatrix })` — presentational, no internal state.
- Produces: `PerformanceChart({ S, perfData })` — presentational, no internal state.
- Consumes (all three): `fmt`, `clampPct` from `../utils/finance`; `Tooltip` from `./Tooltip`. `S` (the card/table style object built in `App.jsx` from `isMobile`) is passed in as a prop rather than imported, since it is computed locally in `App()` — same reasoning that already keeps `Tooltip.jsx` free of any `S` import.

- [ ] **Step 1: Confirm current E2E/a11y tests pass before touching the code**

Run: `npm run build && npm run test:e2e`
Expected: PASS (baseline). This requires Playwright browsers to be installed (`npx playwright install` if not already present in the environment).

- [ ] **Step 2: Create `src/components/RiskContribution.jsx`**

Move the JSX currently at `src/App.jsx` lines ~1292-1409 (`{/* Risk Contribution */} ... )}`) into a new component, replacing the outer `tickers.map` closure's use of `targetWeights`/`riskContrib`/`fmt`/`clampPct` with props:

```javascript
import Tooltip from './Tooltip';
import { fmt, clampPct } from '../utils/finance';

export default function RiskContribution({ S, tickers, targetWeights, riskContrib }) {
  if (Object.keys(riskContrib).length === 0) return null;
  return (
    <div style={S.card}>
      <div style={S.cardTitle}>
        <Tooltip tip="How much risk each asset contributes to total portfolio risk. Risk parity aims for equal contribution.">
          Risk Contribution
        </Tooltip>
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>
        Weight % vs risk contribution %. Equal risk contribution = true risk parity.
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {tickers.map(t => {
          const w = targetWeights[t] ?? 0;
          const rc = riskContrib[t] ?? 0;
          const diff = rc - w;
          return (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
              <span style={{ width: 44, fontFamily: 'monospace', color: '#94a3b8' }}>{t}</span>
              <div style={{ flex: 1, position: 'relative', height: 16 }}>
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 2,
                    height: 12,
                    width: `${w * 100}%`,
                    background: '#3b82f633',
                    borderRadius: 2,
                    border: '1px dashed #3b82f6',
                    transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 2,
                    height: 12,
                    width: `${clampPct(rc) * 100}%`,
                    background: diff > 0.02 ? '#f59e0b88' : '#16a34a88',
                    borderRadius: 2,
                    opacity: 0.85,
                    transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
              </div>
              <span style={{ width: 50, textAlign: 'right', color: '#94a3b8' }}>{fmt.pct(w)}</span>
              <span
                style={{
                  width: 50,
                  textAlign: 'right',
                  color: Math.abs(diff) > 0.02 ? '#f59e0b' : '#16a34a',
                }}
              >
                {fmt.pct(rc)}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 10, color: '#94a3b8' }}>
        <span>
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              background: '#3b82f633',
              border: '1px dashed #3b82f6',
              borderRadius: 2,
              marginRight: 4,
            }}
          />
          Weight
        </span>
        <span>
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              background: '#16a34a88',
              borderRadius: 2,
              marginRight: 4,
            }}
          />
          Risk contribution
        </span>
      </div>
    </div>
  );
}
```

Note this already includes the Task 1 `clampPct` fix — Task 1 must land before this task, or `clampPct` must be added to `finance.js` manually first if done out of order.

- [ ] **Step 3: Create `src/components/CorrelationMatrix.jsx`**

Move the JSX currently at `src/App.jsx` lines ~1410-1473 (`{/* Correlation Matrix */} ... )}`):

```javascript
import Tooltip from './Tooltip';

export default function CorrelationMatrix({ S, tickers, corrMatrix }) {
  if (Object.keys(corrMatrix).length === 0) return null;
  return (
    <div style={S.card}>
      <div style={S.cardTitle}>
        <Tooltip tip="Pairwise correlation of daily returns. Values near 1.0 mean assets move together (less diversification).">
          Correlation Matrix
        </Tooltip>
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>
        Lower correlation = better diversification. Ideal: uncorrelated assets.
      </div>
      <div style={S.tableWrap}>
        <table className="sd-table" style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, fontSize: 10 }}>Ticker</th>
              {tickers.map(t => (
                <th key={t} style={{ ...S.th, fontFamily: 'monospace' }}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tickers.map(a => (
              <tr key={a}>
                <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 600 }}>{a}</td>
                {tickers.map(b => {
                  const v = corrMatrix[a]?.[b] ?? 0;
                  const abs = Math.abs(v);
                  const bg =
                    a === b
                      ? '#1e293b'
                      : v > 0.5
                        ? `rgba(239,68,68,${abs * 0.4})`
                        : v > 0
                          ? `rgba(251,191,36,${abs * 0.3})`
                          : `rgba(34,197,94,${abs * 0.4})`;
                  return (
                    <td
                      key={b}
                      style={{
                        ...S.td,
                        textAlign: 'center',
                        fontFamily: 'monospace',
                        fontSize: 11,
                        background: bg,
                        color: a === b ? '#94a3b8' : '#e2e8f0',
                      }}
                    >
                      {a === b ? '—' : v.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/PerformanceChart.jsx`**

Move the JSX currently at `src/App.jsx` lines ~1474-1608 (`{/* Performance Chart */} ... )}`):

```javascript
import Tooltip from './Tooltip';
import { fmt } from '../utils/finance';

export default function PerformanceChart({ S, perfData }) {
  if (perfData.dates.length <= 10) return null;
  return (
    <div style={S.card}>
      <div style={S.cardTitle}>
        <Tooltip tip="Simulated cumulative return: rebalanced at your threshold vs buy-and-hold (no rebalancing).">
          Performance Simulation
        </Tooltip>
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>
        Rebalanced (blue) vs buy-and-hold (gray) over {perfData.dates.length} trading days.
      </div>
      <div
        style={{
          position: 'relative',
          height: 200,
          background: '#0a0f1e',
          borderRadius: 6,
          padding: '12px 8px 24px 40px',
        }}
      >
        <svg
          viewBox={`0 0 ${Math.max(perfData.dates.length - 1, 1)} 1`}
          preserveAspectRatio="none"
          style={{ width: '100%', height: '100%' }}
        >
          {[0, 0.25, 0.5, 0.75, 1].map(y => (
            <line
              key={y}
              x1={0}
              y1={y}
              x2={perfData.dates.length - 1}
              y2={y}
              stroke="#1e293b"
              strokeWidth={0.005}
            />
          ))}
          <polyline
            points={perfData.buyAndHold
              .map(
                (v, i) =>
                  `${i},${1 - (v - Math.min(...perfData.buyAndHold, ...perfData.rebalanced)) / (Math.max(...perfData.buyAndHold, ...perfData.rebalanced) - Math.min(...perfData.buyAndHold, ...perfData.rebalanced) || 1)}`
              )
              .join(' ')}
            fill="none"
            stroke="#64748b"
            strokeWidth={0.008}
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={perfData.rebalanced
              .map(
                (v, i) =>
                  `${i},${1 - (v - Math.min(...perfData.buyAndHold, ...perfData.rebalanced)) / (Math.max(...perfData.buyAndHold, ...perfData.rebalanced) - Math.min(...perfData.buyAndHold, ...perfData.rebalanced) || 1)}`
              )
              .join(' ')}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={0.008}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            left: 4,
            top: 12,
            bottom: 24,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            fontSize: 9,
            color: '#94a3b8',
          }}
        >
          <span>{fmt.pct(Math.max(...perfData.rebalanced, ...perfData.buyAndHold) - 1)}</span>
          <span>+0%</span>
          <span>{fmt.pct(Math.min(...perfData.rebalanced, ...perfData.buyAndHold) - 1)}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 10, color: '#94a3b8' }}>
        <span>
          <span
            style={{
              display: 'inline-block',
              width: 12,
              height: 2,
              background: '#3b82f6',
              marginRight: 4,
              verticalAlign: 'middle',
            }}
          />
          Rebalanced
        </span>
        <span>
          <span
            style={{
              display: 'inline-block',
              width: 12,
              height: 2,
              background: '#94a3b8',
              marginRight: 4,
              verticalAlign: 'middle',
            }}
          />
          Buy &amp; hold
        </span>
        <span style={{ marginLeft: 'auto' }}>
          Return: rebalanced {fmt.pct(perfData.rebalanced[perfData.rebalanced.length - 1] - 1)} vs
          B&H {fmt.pct(perfData.buyAndHold[perfData.buyAndHold.length - 1] - 1)}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Wire the three components into `App.jsx`**

Add imports near the top of `src/App.jsx` (with the existing `ErrorBoundary`/`Tooltip` imports):

```javascript
import ErrorBoundary from './components/ErrorBoundary';
import Tooltip from './components/Tooltip';
import RiskContribution from './components/RiskContribution';
import CorrelationMatrix from './components/CorrelationMatrix';
import PerformanceChart from './components/PerformanceChart';
```

Replace the three inline blocks (Risk Contribution ~1292-1409, Correlation Matrix ~1410-1473, Performance Chart ~1474-1608) with:

```javascript
                    <RiskContribution
                      S={S}
                      tickers={tickers}
                      targetWeights={targetWeights}
                      riskContrib={riskContrib}
                    />

                    <CorrelationMatrix S={S} tickers={tickers} corrMatrix={corrMatrix} />

                    <PerformanceChart S={S} perfData={perfData} />
```

- [ ] **Step 6: Check for now-unused imports**

Run: `grep -n "fmt\.\|clampPct(" src/App.jsx`

If `fmt` or `clampPct` no longer appear outside the import line itself, remove them from the `from './utils/finance'` import block in `App.jsx`. (Expect `fmt` to still be used elsewhere in `App.jsx` — e.g. the holdings/trades tables — so it likely stays; `clampPct` likely becomes removable from `App.jsx`'s imports since its only use moved into `RiskContribution.jsx`.)

- [ ] **Step 7: Run full checks**

Run: `npm run lint && npm test && npm run build && npm run test:e2e`
Expected: all pass, with `test:e2e` (including the a11y spec) producing identical results to the Step 1 baseline — this is a pure extraction, not a behavior change.

- [ ] **Step 8: Manual smoke check**

Run: `npm run dev`, open the app, enter tickers, click "Run Analysis", switch to the Analysis tab, and confirm the Risk Contribution, Correlation Matrix, and Performance Simulation sections render identically to before (same layout, same numbers, same colors).

- [ ] **Step 9: Commit**

```bash
git add src/App.jsx src/components/RiskContribution.jsx src/components/CorrelationMatrix.jsx src/components/PerformanceChart.jsx
git commit -m "refactor: extract Phase 3 analysis sections into components"
```

---

## Self-Review Notes

- **Coverage:** All 6 findings map 1:1 to a task (Finding 1 → Task 1, Finding 2 → Task 2, Finding 3 → Task 3, Findings 4 & 5 → Task 4 (same function, same file, natural to land together), Finding 6 → Task 5).
- **Task 5 is explicitly optional** and ordered last — it's the only finding rated architectural/LOW rather than a correctness bug, and per this project's ponytail/lazy-dev guidance it should not block shipping Tasks 1-4. A maintainer can stop after Task 4 and still have closed every correctness and CI finding.
- **Type/name consistency:** `clampPct` is defined once in Task 1 (`finance.js`) and reused as-is by Task 5's `RiskContribution.jsx` — same name, same signature, no drift.
