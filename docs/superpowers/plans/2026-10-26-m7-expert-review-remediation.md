# M7 — Expert review remediation (plan)

Issue: M7 tracking issue (see `docs/plan.md`). Source: the 2026-10-26 expert-lens review of the repo after M6 merged.
Exit: every headline number on the Retirement and Portfolios tabs is either backed by enough history to mean what its label says, or is withheld with an explanation; no RPR-labelled template contradicts its source; the guardrail can never raise spending in a drawdown.

## Findings (verified)

| # | Finding | Evidence | Severity |
|---|---------|----------|----------|
| F1 | `rpr-80` sets spend to 6%/yr of current value with no cap, so a trip **raises** spending for anyone starting below a 4.8% rate | `guardrailSpend(2500, 790000, 1000000, 'rpr-80').nextSpend === 3950` (`src/utils/withdrawal.js:745`). Contradicts plan's "must reduce spend, never raise it". Taught in the M6 guardrail module. | Critical |
| F2 | Rolling SWR/PWR/success use **one** window when history < horizon; success is 0% or 100% | 264 months, 30y horizon → `samples.length === 1`, `effectiveYears 22`. Templates holding GLDM (2018 inception) overlap ~8 years. | Critical |
| F3 | Retirement-tab "Success Probability" is evaluated at the 4% `referenceRate`, not the user's spending | `App.jsx:749` omits the spend; default `referenceRate = 0.04` (`withdrawal.js:209`). Violates spec contract 4. | Critical |
| F4 | Template fidelity: All Seasons long/intermediate Treasuries swapped (15/40 vs published 40/15); Golden Ratio gold 3.2% "adjusted to sum to 1"; `risk-parity-core` labelled "RPR flagship" with unverified provenance | `src/utils/portfolios.js:100–170` | High |
| F5 | Monte Carlo is i.i.d. Gaussian with constant correlation and default drift from 2004–2026 history; cannot represent 2022-style stock/bond co-crashes | `withdrawal.js:356–480` | High |
| F6 | "Risk parity" weights are inverse-volatility (correlation ignored, unlevered) | `finance.js:118` | Medium |
| F7 | Sequencing teaches taxable → traditional → Roth as the goal; literature favours bracket-filling and Roth conversions in many cases | `learning.js` sequencing module; `withdrawalSequence` | Medium |
| F8 | Hygiene: `App.jsx` 2,926 lines; raw hex colours in components despite `DESIGN.md`; six ignored `tests/e2e/debug*.spec.js` files | — | Low |

## Sequence

Ordered by severity and dependency. One issue = one branch = one PR (< 400 lines). Agents never merge.

1. **F1 guardrail cap** (small, Critical). `nextSpend = min(currentSpend, 0.06/12 × value)`; oracles at 3%, 4% and 5% starting rates; recovery path unchanged. Update the M6 guardrail module's worked example and wording ("cut to the lower of…").
2. **F2 + F3 honest historical metrics** (Critical). `rollingWithdrawalRates` takes the user's spend for `successRate`; returns `windowCount`. UI withholds SWR/PWR/success (shows "needs ≥ N years; have M") when `windowCount < MIN_WINDOWS` or `effectiveYears < horizonYears`, and always shows window count beside the metric. Applies to Retirement and Portfolios tabs. Numeric oracles for a multi-window synthetic path.
3. **F4 template audit** (High, independent). Re-source every template against its published page; record URL and date in `source`/`lastReviewed`; remove or rename anything not published by RPR. Validation must fail rather than "adjust to sum to 1".
4. **Long-run history** (High; prerequisite for 5 and the full fix of F2). Research spike first: licence-compatible, static, bundleable annual or monthly series (US stocks, long/intermediate Treasuries, bills, gold, CPI) back to at least 1970, preferably 1926 or 1871. Map each template ETF to a proxy series with a documented splice point. Ship as versioned JSON like `rmd-tables.json`; no runtime network.
5. **F5 Monte Carlo realism** (High; after 4). Add a block-bootstrap mode (e.g. 12-month blocks resampled from long history) as the default; keep Gaussian as an option. Drift default no longer the 2004–2026 CAGR. Oracle: bootstrap of a constant-return series reproduces that return; same seed → same result.
6. **F6 weights** (Medium). Either implement equal-risk-contribution weights from the covariance matrix (already computed) or rename the UI to "inverse-volatility weights". Recommended: ERC, with a test that risk contributions are equal within 1e-6.
7. **F7 tax-aware drawdown** (Medium). Near term: reword the sequencing module so it presents the order as a common heuristic, not the goal. Longer term: a bracket-filling option with an optional Roth-conversion amount, federal only, clearly labelled.
8. **F8 hygiene** (Low, anytime). Delete debug specs; move colours to `DESIGN.md` tokens (LearnTab first); split `App.jsx` by tab like `PortfoliosTab.jsx`.

## Verification

Each PR: unit tests with independently computed oracles (spec §4), `npm run lint`, `npm run format`, `npm run build`, `npm run test:e2e`, Lighthouse CI. Steps 2–5 additionally update `Known Limitations.md` and the in-app disclaimers.

## Not in scope

State taxes, Social Security claiming optimisation, leverage modelling, live data sources.
