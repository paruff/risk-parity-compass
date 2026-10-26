# Risk Parity Compass

A React + Vite static site for **risk parity portfolio rebalancing** and **retirement drawdown planning**. It tells you what to trade to reach your target risk allocation tax-efficiently, and then how much you can spend from that portfolio once you stop earning.

Deploys free to GitHub Pages: <https://paruff.github.io/risk-parity-compass/>

> **Not financial advice.** This is educational planning software. Every projection depends on assumptions you supply, and historical and simulated returns do not predict the future.

## What it does

**Accumulation / rebalancing**

- **Risk parity allocation** — inverse volatility weighting from live market data
- **Tax-efficient placement** — waterfall algorithm (bonds → IRAs, stocks → taxable)
- **Rebalancing guidance** — Shannon's Demon: trade only when drift exceeds your threshold
- **Risk contribution and correlation** views for the chosen mix
- **Scenarios** — save and compare portfolio configurations

**Drawdown / retirement**

- **Withdrawal sequencing** — taxable → traditional (with an RMD floor) → Roth
- **RMD table** — IRS Uniform Lifetime Table, with the SECURE 2.0 73/75 eligibility split
- **Spending guardrails** — RPR-80, Guyton-Klinger and VPW policies
- **Static vs guardrail** — Monte Carlo success probability and terminal values side by side, on identical simulated markets
- **Income floor** — Social Security and pension netting, with bridge-year awareness
- **Historical backtest** — rolling safe and perpetual withdrawal rates
- **Monte Carlo** — fan chart of simulated outcomes with withdrawals

**Portfolio library**

- **Templates** — Golden Butterfly, All Seasons, Golden Ratio, Permanent and more, transcribed from Risk Parity Radio
- **Template cards** — each shows description, allocations and source, with its own Load button
- **Compare** — up to 3 templates at once against your current weights, with SWR, PWR, success probability and max drawdown side by side
- **Diversification score** — average and max pairwise correlation plus macro-class count, with warnings above 0.6 average or below 4 classes
- **Load Template** — replaces your tickers and re-runs analysis; your saved scenarios are untouched until you save

> **Shannon's Demon is the strategy, not the product.** The name refers to the rebalancing result that harvesting volatility from a diversified, uncorrelated mix can add growth without extra return. Risk Parity Compass is the application built on it.

## Quick start

```bash
npm ci          # install
npm run dev     # dev server on http://localhost:5173/risk-parity-compass/
npm run build   # production build to dist/
npm run preview # preview the build on http://localhost:4173/risk-parity-compass/
```

## Using it

1. **Assets** — enter tickers (comma-separated), pick a volatility lookback, set a rebalance threshold
2. **Accounts** — enter Taxable, Traditional IRA/401k and Roth IRA balances, plus current share counts
3. **Run Analysis** — fetches prices, computes targets, and generates trades
4. **Retirement** — enter spend, horizon, inflation, birth year and any Social Security or pension income, then run the projection

State persists in `localStorage` under `shannonsdemon_v2` (schemaVersion 2); older `shannonsdemon_v1` data is migrated on first load.

**Retirement tab** — Safe/Perpetual Withdrawal Rate, Monte Carlo success probability, RMDs, guardrails (None, RPR-80) and a static-vs-guardrail comparison. Every metric block carries a planning-estimate disclaimer. **Download PDF** uses the browser print dialog with a print stylesheet (no sidebar, nav or dark theme).

**Portfolios tab** — curated Risk Parity Radio templates you can load, compare and analyse.

**Data resilience** — price data carries a visible timestamp on every tab. If Yahoo fails, the last good quote is used and flagged as cached, and you can override a price. The Retirement tab reports the effective history horizon and which ticker limits it.

**Backup and accessibility** — Export plan / Import plan (versioned, validated JSON, includes scenarios); a reminder appears when a backup is over 30 days old or storage is nearly full. Text size (100/115/130%) and high contrast persist.

## Data source

Yahoo Finance's unofficial v8 chart endpoint (no API key). It works from browsers today but can break without notice. `fetchQuote()` and `fetchMonthlyHistory()` are isolated so they can be swapped for another provider. Tests never call the live API — unit tests use MSW, E2E uses Playwright route interception.

## Quality gates

| Gate | Command | Budget |
|---|---|---|
| Unit / integration | `npm test` | must pass |
| End-to-end | `npm run test:e2e` | must pass |
| Lint | `npm run lint` | 0 errors |
| Format | `npm run format` | Prettier clean |
| Build | `npm run build` | must succeed |
| Lighthouse | CI | perf ≥ 0.9, a11y ≥ 0.95, best practices ≥ 0.9, SEO ≥ 0.9 |

Pre-commit runs Lefthook + lint-staged on staged files. CI runs every gate plus the build on each push and pull request. A human reviews and merges; agents never merge.

> **Environment note:** this repository's tooling requires `env -u NODE_OPTIONS <command>` for Node subprocesses, because a broken `NODE_OPTIONS` shim in the development environment breaks vitest, Playwright, hooks and Lighthouse.

## Documentation

| Document | Purpose |
|---|---|
| [`DESIGN.md`](DESIGN.md) | Design tokens, component rules and UI do's/don'ts (designmd.app / Google design.md format) |
| [`AGENTS.md`](AGENTS.md) | Repository context and conventions for AI agents |
| [`docs/superpowers/specs/2026-10-25-retirement-production-roadmap-design.md`](docs/superpowers/specs/2026-10-25-retirement-production-roadmap-design.md) | Approved roadmap spec: M1–M6 |
| [`docs/superpowers/plans/`](docs/superpowers/plans) | Implementation plans, one per milestone |
| [`docs/superpowers/reviews/`](docs/superpowers/reviews) | Code review records |
| [`Known Limitations.md`](Known%20Limitations.md) | Known constraints and open risks |

## Roadmap

| Milestone | Scope | State |
|---|---|---|
| M1 | Withdrawal engine core (drawdown, SWR/PWR, Monte Carlo, RMD) | shipped, **defective** |
| M2 | Tax & account mechanics (sequencing, RMD UI, cash buffer) | shipped, **defective** |
| M3 | Dynamic spending guardrails + income floor | shipped, **defective** |
| **M3.5** | **Correctness remediation** — the engine's arithmetic, guardrail period contract, and a numeric test oracle | **next** |
| M4 | Portfolio templates, diversification view, comparison | planned |
| M5 | Storage v2, print/PDF, accessibility preferences | planned |
| M6 | Learning journey: investor-level progression and distance learning | built: rubric, five engine-graded modules, spaced refresher (PR #28) |

The 2026-10-26 review found that M1–M3 shipped arithmetic defects that make the headline retirement numbers optimistic by roughly 2× (withdrawals were never compounded) plus a unit mismatch in the Monte Carlo and guardrail policies applied monthly as if annual. **No new feature milestone starts until M3.5 closes those findings.** See [`docs/superpowers/reviews/2026-10-26-code-review-m1-m3.md`](docs/superpowers/reviews/2026-10-26-code-review-m1-m3.md).

## License

MIT — see [`LICENSE`](LICENSE).
