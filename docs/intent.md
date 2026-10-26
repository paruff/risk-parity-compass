# Intent — Risk Parity Compass

**Status:** Active · **Owner:** Phil Ruff · **Last updated:** 2026-10-26

## Why this exists

A self-directed investor within a decade of retirement needs to answer two questions with real arithmetic, not reassurance:

1. **Accumulation:** given my holdings, what should I trade to reach risk-parity targets tax-efficiently?
2. **Drawdown:** how much can I safely spend each year, for how long, and how likely am I to run out?

Risk Parity Compass answers both in a static, local-only browser app. Grounding comes from Risk Parity Radio (RPR): robust portfolios that can be drawn down in perpetuity, judged by safe withdrawal rate (SWR) and perpetual withdrawal rate (PWR).

> Shannon's Demon is the *strategy* (harvest volatility by rebalancing a diversified, low-correlation mix). Risk Parity Compass is the *product*.

## Who it is for

- US-based, self-directed investor, often older and non-technical; comfortable reading a table of numbers.
- Wants the arithmetic and the assumptions, not advice.

## Outcomes that define success

| # | Outcome | How we know |
|---|---------|-------------|
| 1 | A retiree sees SWR, PWR, success probability, max drawdown and a percentile fan chart from their own inputs | Retirement tab E2E asserts numeric values |
| 2 | Withdrawals are modelled monthly with inflation, historically and by seeded Monte Carlo | Numeric-oracle unit tests |
| 3 | RMDs and withdrawal sequencing are calculated, per account | Oracle tests + RMD table version in UI |
| 4 | An RPR portfolio loads in one click and compares against the user's own (up to 3) | Portfolios E2E |
| 5 | No personal data leaves the browser; no backend, no accounts | Architecture rule; no network except Yahoo quotes |
| 6 | Accessible to an older, non-technical user | axe zero violations; Lighthouse a11y ≥ 0.95 |
| 7 | Every headline number is pinned by an independently computed test | Review rule R1 in `REVIEW.md` |

## Non-goals

- Brokerage integration or trade execution.
- Tax-return preparation or personalised tax/financial advice.
- Guaranteed return forecasts — every output is a planning estimate.
- Server-side accounts, cloud sync, or telemetry containing personal data.

## Constraints

- React 18 + Vite SPA on GitHub Pages; inline styles only; no new runtime dependencies without justification.
- Finance logic is pure (`src/utils/`), tested with numeric oracles at realistic scale.
- Yahoo Finance is the only data source (`fetchQuote`, `fetchMonthlyHistory`); tests never hit it live.
- One milestone per branch/PR, < 400 changed lines; **agents never merge**.
- `DESIGN.md` tokens are normative for all UI.

## Lessons that shape how we work

M1–M3 shipped with ten Critical arithmetic defects behind green CI (labels asserted, mocks lacking timestamps, vacuous `0 ≥ 0` comparisons). See `docs/superpowers/reviews/2026-10-26-code-review-m1-m3.md`. That is why the numeric-oracle rule and `REVIEW.md` exist.

## Where the detail lives

- `docs/spec.md` — what is built and its contracts.
- `docs/plan.md` — milestones, status, and the GitHub issue each maps to.
- `REVIEW.md` — how to review a change here.
- `DESIGN.md` — the design system.
- `docs/superpowers/` — historical specs, plans, reviews, research.

## AI-DLC state

The AI-DLC workspace (`aidlc/`, `.claude/`) is installed but has no active workflow; `aidlc/spaces/default/memory/project.md` is unpopulated. This file and `docs/spec.md` are intended to seed it.
