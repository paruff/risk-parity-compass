# Intent — Risk Parity Compass

**Status:** Active · **Owner:** Phil Ruff · **Last updated:** 2026-10-26

## Why this exists

A self-directed investor within a decade of retirement needs to answer two questions with real arithmetic, not reassurance:

1. **Accumulation:** given my holdings, what should I trade to reach risk-parity targets tax-efficiently?
2. **Drawdown:** how much can I safely spend each year, for how long, and how likely am I to run out?

Risk Parity Compass answers both in a static, local-only browser app. Grounding comes from Risk Parity Radio (RPR): robust portfolios that can be drawn down in perpetuity, judged by safe withdrawal rate (SWR) and perpetual withdrawal rate (PWR).

> The product was formerly called *Shannon's Demon*. That name now describes only the rebalancing effect (harvesting volatility from a diversified, low-correlation mix); the product, repo, site and storage keys are all **Risk Parity Compass** / `risk-parity-compass` / `rpcompass_*`.

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

## Provenance

The product's plan came from the Superpowers brainstorming → spec → plan workflow, recorded under `docs/superpowers/`: the two specs below and one plan per milestone (M1, M2, M3, M3.5, M4, M5, M7, plus the migration and phase-3 plans). Those files are the authoritative history; this intent, `spec.md` and `plan.md` are the flat working summary distilled from them. No AI-DLC workflow was ever run.

| Date | Source | What it set |
|------|--------|-------------|
| 2025-11-21 | Initial commits | Streamlit app "Shannon's Demon": inverse-volatility weights, tax-location, rebalancing trades |
| 2026-08-15 | `docs/superpowers/specs/…react-migration-design.md` | Rewrite as React + Vite SPA on GitHub Pages |
| 2026-10-25 | `docs/superpowers/specs/…retirement-production-roadmap-design.md` | Pivot to retirement drawdown, grounded in Risk Parity Radio; milestones M1–M6; renamed to Risk Parity Compass |
| 2026-10-25 → 26 | `docs/superpowers/plans/` (one per milestone M1–M5, M7) | Task-level plans that were executed to build the product |
| 2026-10-26 | `…code-review-m1-m3.md`, expert-lens review | M3.5 correctness work, numeric-oracle rule, then M7 remediation |

## Where the detail lives

- `docs/spec.md` — what is built and its contracts.
- `docs/plan.md` — milestones, status, and the GitHub issue each maps to.
- `REVIEW.md` — how to review a change here.
- `DESIGN.md` — the design system.
- `docs/superpowers/` — historical specs, plans, reviews, research.

## Tooling

`AGENTS.md` points here. The opencode `@planner` agent expects `intent.md` → `spec.md` → `plan.md` (default location `docs/ai-sdlc/<feature>/`); this repo keeps them flat in `docs/`. The AI-DLC shell (`aidlc/`, `.claude/`) is installed but has no active workflow.
