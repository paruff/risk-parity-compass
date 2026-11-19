# Portfolio math review: findings and fix plan (2026-11-13)

Review of `src/utils/` (finance, withdrawal, portfolioPath, longRun, portfolios) for correctness.
Each finding is pinned by a property-based test in
`src/utils/__tests__/properties.test.js`, registered with `it.fails`: the suite stays green
while the bug exists and goes red when it is fixed. To see the shrunk counterexamples:

```bash
SHOW_BUGS=1 env -u NODE_OPTIONS npx vitest run src/utils/__tests__/properties.test.js
```

`fast-check` (dev dependency) supplies generators and shrinking; the seed is fixed.

## Status

Fixed: 1, 2, 4, 5, 6, 7, 8 (their properties now run as ordinary passing tests).
Open: 3, 9, 11, 12 (still `it.fails`).

Decisions taken while fixing:

- **Trades (6, 7):** nothing trades until a ticker's portfolio-level drift passes the threshold;
  then every account is traded to its target, one row per account and ticker. This is the only
  list that is executable account by account, but it also relocates tickers between accounts.
- **Success rate (5):** the user's spend is scaled to each window's starting value, which is the
  same as replaying the user's portfolio through that window. `rollingWithdrawalRates` takes
  `startingValue` (default: first path value).
- **Drift (2):** the historical CAGR is converted with `ln(1 + R)`; the −σ²/2 term is kept, so
  the simulated median grows more slowly than the history (conservative, disclosed).
- **ERC (4):** cyclical coordinate descent on the log-barrier form; weights stay positive.
- Golden Butterfly set to 20/20/20/20/20 at the owner's request.

## Findings

Severity reflects whether the shipped UI can reach the code path today.

| # | Where | What is wrong | Evidence | Reach |
|---|-------|---------------|----------|-------|
| 1 | `monteCarloSimulation`, `monteCarloWithWithdrawals` (Gaussian mode) | Volatility is scaled twice. `L` comes from the per-step covariance (σ²·dt) and the shock is then multiplied by `sqrt(dt)` again, so simulated annual vol is σ/√252 (daily) or σ/√12 (monthly). The −σ²/2 drift term still uses the full σ, so paths also decay. | σ = 20%, 1 year: log-return dispersion 0.0128 (daily) and 0.0588 (monthly) against 0.20. | High. Gaussian mode runs whenever a holding has no long-run proxy (REITs, EM, commodities, managed futures). The fan chart and success rate are far too narrow. `monteCarloSimulation` has no UI caller. |
| 5 | `rollingWithdrawalRates`, `rollingLongRun` | `successRate`, `worstDepletionYear` and `maxDrawdown` test the user's dollar spend against each window's own starting value. The path starts at the user's portfolio and compounds, so later windows start far richer. Violates spec §3.2 and §3.4. | 60/40 VTI/IEF, $1M, $60k/yr, 3% inflation, 30 years on the 1928+ data: reported 90.0%, independent replay from $1M at each start year gives 67.1%. At $40k: 98.6% vs 95.7%. | High. This is the headline success rate. SWR and PWR are rate-based and are not affected. |
| 4 | `ercWeights` | The update `w_i *= sqrt(target / rc_i)` produces NaN for every weight once any risk contribution goes negative, which happens with moderately negative correlations. | One stock at −0.3 to four bond funds correlated 0.9 with each other returns all NaN. | High. Stock plus several Treasury funds is a typical risk-parity ticker list; NaN weights flow into allocation and trades. |
| 6 | `generateTrades` | Trades are sized on the cross-account total but assigned to "the account where the target puts the ticker" (or the first account), not where the shares are. | SELL of a ticker absent from the target is sent to the first target account even if it holds none; sells can exceed the named account's holding. | High. Trades tab. |
| 7 | `generateTrades` | Only tickers past the drift threshold trade, so buys and sells do not net to zero. | 100% QQQ against an 85/5/5/5 target: sell 15%, buy nothing. | Medium. Trades tab; the list is not executable as written. |
| 2 | `monteCarloWithWithdrawals` historical drift | `years = closes.length / 12` (n closes span n − 1 months), and the resulting CAGR is then used as a continuously compounded rate. | History growing exactly 7%/yr, zero vol, 10 years, $1M: $2,001,744 against $1,967,151 (+1.8%). | Medium. Gaussian mode with the default drift. |
| 8 | `simulatePerformance` | Series are aligned from index 0; `correlationMatrix` aligns from the end. A ticker with less history than the lookback is compared on the wrong dates and the newest data of the others is dropped. | Prepending older history to one ticker changes the backtest of the shared window. | Medium. Needs a ticker shorter than the chosen lookback. |
| 3 | `monteCarloWithWithdrawals` `stats.cagr`, `stats.sharpe` | Computed from the dollar mean, not mean / startingValue. | $100k, no growth, 1 year: `cagr` = 99,999. | Low. Stored as `mcStats` but not rendered. |
| 9 | `guardrailSpend('guyton-klinger')` | The floor/ceiling clamp (0.8–1.2 × a hard-coded 5% of the starting value) is applied in the `normal` state too. | $350/month, rate inside the guardrails: spend becomes $666.67 with `policyState: 'normal'`. | Low. Not selectable in the UI. |
| 11 | `drawdownPath` cash buffer | The buffer is funded with months × spend even when that exceeds the portfolio. | $100k portfolio, $12.5k/month, 32 months: buffer plus portfolio exceeds $100k. | Low. Needs an unrealistic buffer. |
| 12 | `drawdownPath` + `vpw` | No `age` option exists although `App.jsx` passes one, so VPW always throws inside the loop (spec §3.6 asks for a call-site failure). | Any age. | Low. Not selectable in the UI. |

(Number 10 was dropped during review: `requiredMinimumDistribution` returns the age-120 divisor
for a fractional age, but age is defined as a whole number and every caller passes one.)

## Checked and found correct

Pinned by passing properties with independent oracles: `inverseVolWeights`; `ercWeights` under
uniform correlation; `riskContribution`; `correlation`; `taxLocationWaterfall` conservation;
`simulatePerformance` and `buildPortfolioPath` against Σ w × p(t)/p(0); the `drawdownPath`
recursion against the closed-form annuity balance, and its monotonicity in spend;
`withdrawalSequence` conservation and no-overdraw for both strategies.

## Not bugs, but worth a decision

- `annualizedVol` divides by n (population variance); n − 1 is the usual sample convention. The
  difference is under 1% at 63+ observations.
- `percentile` uses `floor(n × p)`, so the "median" of an even-sized sample is the upper middle value.
- SWR and PWR searches cap at 20%; very short effective horizons saturate there.
- `netSpend` is evaluated once at today's age, so Social Security that starts later never
  reduces spending inside the simulations.

## Fix plan

One PR per row group, each flipping its `bug(...)` to `it(...)`:

1. Monte Carlo scaling, drift and stats (1, 2, 3).
2. Success rate on rescaled windows (5), with `Known Limitations.md` and in-app copy updated,
   because the displayed success rate will fall.
3. `ercWeights` solver that stays positive (4).
4. `generateTrades` account assignment and cash neutrality (6, 7): needs a product decision on
   whether sub-threshold tickers absorb the residual.
5. `simulatePerformance` alignment (8).
6. Guardrail and buffer edge cases (9, 11, 12) before GK or VPW are exposed.
