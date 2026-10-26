# Plan — Risk Parity Compass

**Intent:** `docs/intent.md` · **Spec:** `docs/spec.md` · **Last synced with GitHub:** 2026-10-26

One milestone = one branch = one PR (< 400 changed lines). **Agents never merge; a human reviews and merges.**

## Milestones ↔ GitHub issues

| Milestone | Scope | Issue | Issue state | Delivery | Open work |
|-----------|-------|-------|-------------|----------|-----------|
| M1 | Withdrawal engine core | #7 | Closed | PR #12 merged | — |
| M2 | Tax & account mechanics | #8 | Closed | PR #14 merged | — |
| M3 | Dynamic spending & income floor | #9 | **Open** | Tasks 1–5 merged via #12/#14/#17 | **Task 6: static-vs-guardrail comparison view** |
| M3.5 | Correctness remediation | *(none — to create)* | — | PR #17 merged | Record in tracker as closed |
| M4 | Portfolio library & comparison | #10 | Open | PR #18 merged at Task 1 only (`portfolios.js`); **PR #19 open** with the Portfolios tab | Human review + merge of #19; `Closes #10` is in its body |
| M5 | Production hardening & accessibility | #11 | Open | Not started | Storage v2, resilience, a11y, print/PDF |
| M6 | Learning journey | *(none — to create)* | — | Research only | Needs scoping before work |

## Housekeeping items (not milestones)

| Item | Issue | Resolution |
|------|-------|------------|
| Pages site broken: repo is `shannonsdemon` but Vite `base` and all docs use `/risk-parity-compass/` | *(to create)* | **Decided: rename repo to `risk-parity-compass`.** Pages then serves at `/risk-parity-compass/`. |
| Uncommitted `.gitignore` additions and the AI-DLC `.claude/` shell | — | **Decided: commit both** as a `chore:` change. |
| `DESIGN.md` conformance of new views | — | `PortfoliosTab.jsx` warning banner switched to `warning-surface`/`warning-border`/`warning` tokens. |

## Sequence

1. **Docs baseline** — `docs/intent.md`, `docs/spec.md`, `docs/plan.md`, `REVIEW.md` (this change).
2. **Sync tracker** — create issues for M3.5, M6, the Pages rename, and M3 Task 6; check off delivered items on #9; comment on #10 with PR #19.
3. **Rename repo** → `risk-parity-compass` (verify the Pages deploy, update remotes and badges).
4. **M3 Task 6** on its own branch from `main` → own PR → closes #9 on merge.
5. **Chore commit** — `.gitignore` + `.claude/`.
6. Human merges PR #19 (M4), then the Task 6 PR.
7. **M5** — plan in `docs/superpowers/plans/` before code (docs before code).
8. **M6** — scope first; see `docs/superpowers/research/2026-10-26-investor-levels-and-learning-science.md`.

## M3 Task 6 — acceptance

- Retirement tab shows static spending vs the selected guardrail side by side: success probability, median terminal value, and lowest spend reached.
- Both Monte Carlo runs use the **same seed** (fair comparison).
- Numeric oracle: at $1M / $4,000 per month, a guardrail trip must reduce spend, never raise it; static vs guardrail terminal values are independently computed.
- E2E asserts values (`/^\d+(\.\d+)?%$/`), not labels.

## M5 backlog (from spec)

`storage.js` v2 + migration from `shannonsdemon_v1`; export/import with validation; backup reminder; stale-price cache and manual override; overlap reporting; font scale and high contrast; print CSS and "Download PDF" via `window.print()`; visible data timestamps; error boundaries on new tabs; E2E and a11y expansion.

## Working agreements

- Branch per milestone; Conventional Commits (commitlint enforced).
- Tests first for finance logic; numeric oracles at realistic scale.
- `REVIEW.md` is the checklist for every PR; a Critical finding blocks merge.
- Update this file when an issue or PR changes state.
