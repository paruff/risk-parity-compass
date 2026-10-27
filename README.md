# Risk Parity Compass

A React + Vite static site for **risk parity portfolio rebalancing** and **retirement drawdown planning**. It tells you what to trade to reach your target risk allocation tax-efficiently, and then how much you can spend from that portfolio once you stop earning.

Deploys free to GitHub Pages: <https://paruff.github.io/risk-parity-compass/>

> **Not financial advice.** This is educational planning software. Every projection depends on assumptions you supply, and historical and simulated returns do not predict the future.

## What it does

**Accumulation / rebalancing**

- **Risk parity allocation** — inverse volatility weighting from live market data
- **Tax-efficient placement** — waterfall algorithm (bonds → IRAs, stocks → taxable)
- **Rebalancing guidance** — trade only when drift exceeds your threshold, harvesting volatility (the "Shannon's Demon" effect) without paying for noise
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

State persists in `localStorage` under `rpcompass_*` keys (schemaVersion 2). Data saved under the old `shannonsdemon_*` keys (the project's former name) is migrated on first load and left in place as a backup; plan files exported under the old name still import.

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
| [`docs/intent.md`](docs/intent.md) · [`docs/spec.md`](docs/spec.md) · [`docs/plan.md`](docs/plan.md) | Why, contracts, and milestones mapped to GitHub issues |
| [`REVIEW.md`](REVIEW.md) | How to review a change here |
| [`AGENTS.md`](AGENTS.md) | Repository context and conventions for AI agents |
| [`docs/superpowers/specs/2026-10-25-retirement-production-roadmap-design.md`](docs/superpowers/specs/2026-10-25-retirement-production-roadmap-design.md) | Long-form roadmap spec (history) |
| [`docs/superpowers/plans/`](docs/superpowers/plans) | Implementation plans, one per milestone |
| [`docs/superpowers/reviews/`](docs/superpowers/reviews) | Code review records |
| [`Known Limitations.md`](Known%20Limitations.md) | Known constraints and open risks |

## Roadmap

Source of truth: [`docs/plan.md`](docs/plan.md), which maps each milestone to its GitHub issue and PR.

| Milestone | Scope | State |
|---|---|---|
| M1–M3.5 | Withdrawal engine, tax and account mechanics, guardrails, correctness remediation | shipped |
| M4 | Portfolio templates, diversification view, comparison | shipped |
| M5 | Storage v2, print/PDF, accessibility preferences | shipped |
| M6 | Learning journey: competency rubric, engine-graded modules, spaced refresher | shipped |
| **M7** (#37) | **Expert review remediation:** honest historical metrics (#30), template fidelity (#31), long-run history (#32), bootstrap Monte Carlo (#33), equal-risk-contribution weights (#34), tax-aware drawdown (#35), code hygiene (#36) | **active** (#29 guardrail fix shipped) |

Until M7's Critical items close, treat headline historical metrics as provisional; see [`Known Limitations.md`](Known%20Limitations.md).

## History

Began in 2025 as a Streamlit tool called *Shannon's Demon*, was rewritten as a React + Vite SPA in 2026, and renamed **Risk Parity Compass** when it grew a retirement drawdown engine. "Shannon's Demon" now names only the rebalancing effect the app uses. See [`docs/intent.md`](docs/intent.md) for provenance.

## License

MIT — see [`LICENSE`](LICENSE).
