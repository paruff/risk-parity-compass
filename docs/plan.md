# Plan — Risk Parity Compass

**Intent:** `docs/intent.md` · **Spec:** `docs/spec.md` · **Last synced with GitHub:** 2026-10-28

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
| M7 | Expert review remediation | #37 | Closed | Plan: `docs/superpowers/plans/2026-10-26-m7-expert-review-remediation.md`; see table below | — |

### M7 work items

Order = severity then dependency. One issue = one branch = one PR.

| Order | Issue | Finding | Severity | State | PR |
|-------|-------|---------|----------|-------|----|
| 1 | #29 | F1 `rpr-80` can raise spending | Critical | Closed | #39 merged |
| 2 | #30 | F2+F3 honest historical metrics | Critical | Closed | #43 merged |
| 3 | #31 | F4 template fidelity audit (independent) | High | Closed | #44 merged |
| 4 | #32 | Long-run history (before #33) | High | Closed | #48 (data), #53 (rolling metrics) merged |
| 5 | #33 | F5 block-bootstrap Monte Carlo (after #32) | High | Closed | #50 merged (#49 merged into a stale stacked branch and was re-opened as #50) |
| 6 | #34 | F6 ERC weights | Medium | Closed | #45 merged |
| 7 | #35 | F7 tax-aware drawdown | Medium | Closed | #47 (wording), #51 (bracket-fill) merged |
| 8 | #36 | F8 hygiene | Low | Closed | #46, #52, #54 merged |

**Next action:** none scheduled. Candidates: expose Guyton-Klinger/VPW (see Deferred), group the tab props into context, a long-bond and commodity proxy series.

## Housekeeping items (not milestones)

| Item | Issue | Resolution |
|------|-------|------------|
| Pages site broken: repo was `shannonsdemon` but Vite `base` and all docs use `/risk-parity-compass/` | #24 | **Done 2026-10-26:** repo renamed to `risk-parity-compass`; https://paruff.github.io/risk-parity-compass/ returns 200. Close #24 once verified in a browser. |
| Uncommitted `.gitignore` additions and the AI-DLC `.claude/` shell | — | **Done:** committed in PR #20. |
| `DESIGN.md` conformance of new views | — | `PortfoliosTab.jsx` warning banner switched to `warning-surface`/`warning-border`/`warning` tokens. |

## Deferred

- Guyton-Klinger and VPW are not selectable in the Retirement tab; Guyton-Klinger state is not carried across years inside the Monte Carlo. Fix before exposing them.
- "Lowest spend reached" metric for the guardrail comparison.

## Verification Strategy

Each PR: unit tests with independently computed oracles (`docs/spec.md` §4), `npm run lint`, `format`, `build`, `test:e2e`, Lighthouse CI. Metric-changing PRs also update `Known Limitations.md` and in-app disclaimers.

## Rename: Shannon's Demon → Risk Parity Compass

| Surface | State |
|---------|-------|
| GitHub repo, Pages URL, `package.json`, Vite base | Done (2026-10-26) |
| Storage keys `rpcompass_*`, plan-file `app` id, export filename, import error text | Done in this change; legacy `shannonsdemon_*` keys and plan files still migrate/import |
| README, AGENTS, intent, spec, `.serena` project name | Done in this change |
| Local checkout directory `shannonsdemon/` | Manual: `mv` it and re-open the editor |
| `docs/superpowers/` history, `.agents/skills/portfolio-scenario-analysis` | Left as written; "Shannon's Demon" there names the strategy |
| Drop legacy-key migration | After one release cycle; track as a #36 follow-up |

## Working agreements

- Branch per milestone; Conventional Commits (commitlint enforced).
- Tests first for finance logic; numeric oracles at realistic scale.
- `REVIEW.md` is the checklist for every PR; a Critical finding blocks merge.
- Update this file when an issue or PR changes state.
