# Plan — Risk Parity Compass

**Intent:** `docs/intent.md` · **Spec:** `docs/spec.md` · **Last synced with GitHub:** 2026-10-26

One milestone = one branch = one PR (< 400 changed lines). **Agents never merge; a human reviews and merges.**

## Milestones ↔ GitHub issues

| Milestone | Scope | Issue | Issue state | Delivery | Open work |
|-----------|-------|-------|-------------|----------|-----------|
| M1 | Withdrawal engine core | #7 | Closed | PR #12 merged | — |
| M2 | Tax & account mechanics | #8 | Closed | PR #14 merged | — |
| M3 | Dynamic spending & income floor | #9 | Closed | Tasks 1–5 via #12/#14/#17; Task 6 via PR #25 | — |
| M3.5 | Correctness remediation | #22 | Closed | PR #17 merged | — |
| M4 | Portfolio library & comparison | #10 | Closed | PR #18 (templates module) and PR #19 (Portfolios tab) merged | — |
| M5 | Production hardening & accessibility | #11 | Closed | PR #27 merged | — |
| M6 | Learning journey | #23 | Closed | PR #28 merged | Contextual field links deferred; guardrail and sequencing modules corrected under M7 (#29, #35) |
| M7 | Expert review remediation | #37 | Open | Plan: `docs/superpowers/plans/2026-10-26-m7-expert-review-remediation.md` | #29–#36, in order; #29 and #30 are Critical |

## Housekeeping items (not milestones)

| Item | Issue | Resolution |
|------|-------|------------|
| Pages site broken: repo was `shannonsdemon` but Vite `base` and all docs use `/risk-parity-compass/` | #24 | **Done 2026-10-26:** repo renamed to `risk-parity-compass`; https://paruff.github.io/risk-parity-compass/ returns 200. Close #24 once verified in a browser. |
| Uncommitted `.gitignore` additions and the AI-DLC `.claude/` shell | — | **Done:** committed in PR #20. |
| `DESIGN.md` conformance of new views | — | `PortfoliosTab.jsx` warning banner switched to `warning-surface`/`warning-border`/`warning` tokens. |

## Sequence

1. **Docs baseline** — `docs/intent.md`, `docs/spec.md`, `docs/plan.md`, `REVIEW.md` (this change).
2. **Sync tracker** — done: #21 (Task 6), #22 (M3.5, closed), #23 (M6), #24 (Pages); #9 checklist ticked; #10 commented.
3. **Rename repo** → `risk-parity-compass` — done.
4. **M3 Task 6** on its own branch from `main` → PR #25 → closes #9 and #21 on merge.
5. **Chore commit** — `.gitignore` + `.claude/` — done (PR #20).
6. PRs #19 (M4) and #25 (Task 6) merged; PR #20 (these docs) pending.
7. **M5** — plan in `docs/superpowers/plans/` before code (docs before code).
8. **M6** — scope first; see `docs/superpowers/research/2026-10-26-investor-levels-and-learning-science.md`. Done (PR #28).
9. **M7** — fix the expert-review findings before further features: #29 guardrail cap and #30 honest historical metrics first.

## M3 Task 6 — acceptance

- Retirement tab shows static spending vs the selected guardrail side by side: success probability, median and P10 terminal value (delivered in PR #25; "lowest spend reached" deferred).
- Both Monte Carlo runs use the **same seed** (fair comparison).
- Numeric oracle: at $1M / $4,000 per month, a guardrail trip must reduce spend, never raise it; static vs guardrail terminal values are independently computed.
- E2E asserts values (`/^\d+(\.\d+)?%$/`), not labels.

## Deferred

- Guyton-Klinger and VPW are not selectable in the Retirement tab; Guyton-Klinger state is not carried across years inside the Monte Carlo. Fix before exposing them.
- "Lowest spend reached" metric for the guardrail comparison.

## M5 backlog (from spec)

`storage.js` v2 + migration from `shannonsdemon_v1`; export/import with validation; backup reminder; stale-price cache and manual override; overlap reporting; font scale and high contrast; print CSS and "Download PDF" via `window.print()`; visible data timestamps; error boundaries on new tabs; E2E and a11y expansion.

## Working agreements

- Branch per milestone; Conventional Commits (commitlint enforced).
- Tests first for finance logic; numeric oracles at realistic scale.
- `REVIEW.md` is the checklist for every PR; a Critical finding blocks merge.
- Update this file when an issue or PR changes state.
