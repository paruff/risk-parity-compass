# Code review — last four PRs (M1 → M3)

**Date:** 2026-10-26
**Reviewer:** four independent review passes (one per change set) plus independent numeric verification by the coordinator
**Method:** `requesting-code-review` skill — each change set was reviewed by a separate read-only reviewer with its own context, then every Critical claim was re-verified against the code by running the shipped functions.

## Scope

| # | Change set | Range | Outcome |
|---|---|---|---|
| 1 | PR #12 — M1 withdrawal engine core | `a8ce913..e5f50e1` | Not ready |
| 2 | PR #14 — M2 tax & account mechanics | `e5f50e1..4bb1d5c` | Not ready |
| 3 | PR #13 + #15 — dependency group bump, Lighthouse readiness | `4bb1d5c..260cc5e` | Ready with fixes |
| 4 | M3 tasks 1–5 (local, unpushed) | `4bb1d5c..3da625c` | Not ready |

M3 task 6 (static-vs-guardrail comparison view) was excluded: it was reverted before this review.

## Verification evidence

Every Critical below was reproduced by executing the shipped code, not inferred from reading it.

```
flat 6%/yr real growth, $1M, $6,000/mo real spend, 30 years
  correct recursion        → depletes at year 28.25, terminal $0
  drawdownPath() shipped   → never depletes, terminal $3,555,670

rollingWithdrawalRates() on that same 6%/yr path
  shipped "SWR"            → 15.76%   (true ≈ 6.25%)
  shipped successRate      → 1.0 always (by construction)

monteCarloWithWithdrawals(), $4,000/mo, portfolio normalised to 1
  successRate → 0, median terminal → $0
  with spend 0 → successRate 1, median terminal $2.12

guardrailSpend(4000, 790_000, 1_000_000, 'rpr-80')
  → nextSpend 47_400 per month   (a "cut")

guardrailSpend(4000, 1_000_000, 1_000_000, 'guyton-klinger')
  → state 'prosperity', nextSpend 40_000 per month

rollingWithdrawalRates() on a 21.9-year series with a 30-year horizon
  → swr 0, successRate 0
```

Default tickers (`SPY, TLT, GLD, VNQ, EEM`) overlap from late 2004 — about 21.9 years against the default 30-year horizon. The default experience is `0.00%` on every metric.

## Critical findings

### C1 — `drawdownPath` never compounds withdrawals (`src/utils/withdrawal.js:113`)

The function computes `balances[i] = realPortfolioValue[i] - Σ spend`, subtracting spend from a path that already assumes the money stayed invested. The correct recursion is `B(i+1) = (B(i) - spend) × (p(i+1)/p(i))`.

Effect: every headline number is optimistically wrong. On a 6% growth path with 7.2% spending the portfolio should be exhausted at 28.25 years; the shipped code reports a $3.56M terminal balance, and the derived SWR is 15.76% instead of roughly 6.25%. The error direction is the dangerous one: it tells a retiree they can spend two to three times more than they can.

### C2 — Monte Carlo mixes dollars with a normalised portfolio (`withdrawal.js:368, 419`)

`portfolioValue` starts at `1`, but `monthlySpend` is passed in dollars. The first withdrawal wipes the portfolio to zero, so every path depletes in month 1 and the fan chart is a flat line at $0. The unit tests pass `monthlySpend: 400` against the same normalised start and only assert lengths and ranges, so they stay green.

### C3 — "Success Probability" is mathematically always 100% (`withdrawal.js:216, 232`)

`swr` is the highest rate found not to deplete; `depleted` is then evaluated at exactly that rate, so it is false by construction. `successRate` is therefore `1.0` whenever there is enough history at all — an unfalsifiable number presented as the headline risk metric.

### C4 — Guardrails are financially inverted at real scales (`withdrawal.js:634, 646`)

Both policies were written as annual rules and then called once per month:

- **rpr-80:** on a trip it sets monthly spend to `0.06 × portfolio`. At $790k that is $47,400 per month instead of a cut to roughly $4,500.
- **Guyton-Klinger:** `currentRate = spend / portfolio` is a monthly rate (~0.004), always below the 4% annual lower guardrail, so the "prosperity" rule fires every month, compounding +10% until the cap. At $1M the first call returns $40,000 per month.
- **VPW:** unreachable through either caller — neither passes `age`, so it throws.

The `0 ≥ 0` Monte Carlo guardrail test passes vacuously because C2 makes both sides zero.

### C5 — Withdrawal sequencing renders no data (`src/App.jsx:2486-2491`)

`{ name: 'Taxable', ...seq.byAccount.Taxable }` spreads a **number**. Spreading a primitive yields no properties, so `row.taxable` is `undefined`, every cell renders `—`, and the total renders `$NaN`.

### C6 — RMD is annual, consumed as monthly (`src/App.jsx:2475`)

`requiredMinimumDistribution().rmd` is an annual figure and `withdrawalSequence` documents `rmdByAccount` as monthly. A $500k IRA at 73 therefore produces about $226k per year of "traditional withdrawal" against $60k of spend — off by 12×.

### C7 — Cash buffer affects no projection (`src/App.jsx:2463-2575`)

`rollingWithdrawalRates` and `monteCarloWithWithdrawals` never receive `cashBufferMonths`. The only consumer is the status card, whose value is `portfolioBalance / monthlySpend` — the whole portfolio expressed in months, not the buffer, labelled "Cash Buffer Remaining (Mo)". A 12-month buffer on a $500k portfolio reads 61.4 months.

### C8 — Roth IRA is included in the RMD table (`src/App.jsx:729, 2401`)

The filter `a.includes('IRA') || a.includes('401k')` matches `Roth IRA`, which has no lifetime RMDs under SECURE 2.0. The table shows a dollar figure for something that does not exist.

### C9 — Historical portfolio path is weighted by share price (`src/App.jsx:677-688`)

The backtest builds `Σ(weight × price)`, so a ticker's influence scales with its share price rather than its target weight. With the default mix, a $650 SPY share dominates an $85 TLT share about 8× at equal weight; a 40% bond allocation contributes roughly 15% of the path. The resulting SWR describes a portfolio the user does not hold.

### C10 — The test suite cannot detect any of the above

The E2E tests assert the *words* "Safe Withdrawal Rate (SWR)", "PWR" and "Success Probability" exist. The error path renders exactly those labels with `NaN%`, so CI is green on a broken feature. The Playwright Yahoo mock omits `timestamp`, so `fetchMonthlyHistory` returns no dates and the calculation throws before any math runs. There is no numeric oracle anywhere for SWR, terminal balance, depletion time or success rate.

## Important findings

### Engine
1. `fetchMonthlyHistory` tests hit live Yahoo Finance — `src/utils/__tests__/finance.test.js` has no MSW server, unlike `fetchQuote.test.js`. Violates the repo rule that tests never touch live Yahoo.
2. Cash buffer is never funded and never refilled: `bufferBalance` starts at `spend × months` without deducting it from the portfolio, so enabling the buffer can only improve every metric. Spec §9.2 requires refill above 90% of peak; not implemented.
3. `rollingWithdrawalRates` returns zeros when `n < horizonMonths` instead of computing over available history (plan Review Focus #3 explicitly required the latter).
4. `withdrawalSequence` cannot foot when RMD exceeds spend — the surplus has no destination.
5. Bracket heuristic can truncate an RMD below its legal floor (`Math.min(max(needed, rmd), cap)`).
6. `initialRate` for Guyton-Klinger is never supplied by callers, so defaults apply regardless of the user's actual spend rate.
7. Failed tickers are dropped silently and weights are not renormalised; Monte Carlo substitutes price `1` for a ticker with no history.
8. `activeMemory` / `useMemo` absent: `withdrawalSequence` is recomputed five times per render.

### UI / product
9. Retirement inputs are the only inputs not persisted — a reload wipes spend, inflation and horizon.
10. Clearing the horizon field yields "SWR 20.00%" via `parseInt('') || 0` saturating the binary search.
11. `retirementResults.error` is never rendered. Any calculation failure is silent.
12. Income floor is netted for the entire horizon regardless of start ages, so benefits that begin in 5 years are credited from month 0 — inflating success during the fragile bridge period the UI simultaneously describes.
13. Dead controls: guardrail selector, cash buffer months and SS/pension fields persist state that no calculation consumes.
14. `analysisSignature` does not include guardrail parameters (plan Review Focus #1).

### CI
15. CI runs Node 20 while `vitest@5` declares `^22.12.0 || ^24 || >=26`. Latent break; Node 20 is EOL.
16. `lighthouserc.json` asserts performance ≥ 0.85 while AGENTS.md promises 0.9.
17. `numberOfRuns: 1` — the same bytes scored 0.76 and 0.99 in two runs. The gate measures runner noise; PR #15 fixed the readiness warning but not the actual failure mode.
18. `vitest 4 → 5`, a major, shipped inside a grouped "8 updates" dependabot PR without being named. No `.github/dependabot.yml` exists, so the grouping policy is not reviewable.
19. No `permissions:` block on `ci.yml` / `lighthouse.yml`; actions pinned by mutable major tags; no `concurrency`; no `timeout-minutes`.
20. `lighthouse-budget.json` is referenced in the docs but enforced nowhere.

## Process findings

- PR #12 landed 5,330 insertions against a stated < 400-line batch limit, bundling a hook migration, dependency refresh, a Pages change, an unrelated refactor and two risk-contribution fixes.
- Commit `1d75516` ("feat: add guyton-klinger guardrail spending policy") swept in 384 files and ~260k lines of AI-DLC workspace, screenshots and scratch scripts, plus `debug.mjs` and `test_gk.mjs`. The scratch script is removed in `chore: remove scratch debug script test_gk.mjs`; the workspace files need a `.gitignore` decision.
- PR #15 was based on the dependabot branch, so both landed as one merge commit and neither was independently green on `main`.

## Disposition

| Finding | Action |
|---|---|
| C1–C9 | Fix in **M3.5 Correctness Remediation** — the next milestone, before any new feature work |
| C10 | Replace label assertions with numeric assertions; add timestamped Yahoo mock |
| Important 1–8 | Fold into M3.5 (engine) |
| Important 9–14 | Fold into M3.5 (UI wiring) or the M4 plan |
| CI 15–20 | Separate `ci:` PR |
| Process | Enforced by the revised roadmap: one milestone per PR, engine/UI split |

Nothing in this review was set aside silently. Items considered and deliberately excluded: the husky→lefthook tooling choice, the Pages `build_type` change, phase-3 component extraction and risk-contribution fixes (pre-existing features outside the reviewed plans), storage v2 / export-import (M5 scope), print CSS and PDF export (M5 scope), and portfolio templates (M4 scope). Each is either already scheduled or a maintainer decision, not a defect.
