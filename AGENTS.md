# Risk Parity Compass — Repo Context

Risk parity rebalancing and retirement drawdown planning. React 18 + Vite SPA on GitHub Pages: <https://paruff.github.io/risk-parity-compass/>. Formerly "Shannon's Demon"; that name now means only the rebalancing effect, never the product.

## Read first

`docs/intent.md` (why) → `docs/spec.md` (contracts) → `docs/plan.md` (milestones ↔ GitHub issues, current state) → `REVIEW.md` (PR checklist) → `DESIGN.md` (UI tokens, normative before any UI change). Long-form history lives in `docs/superpowers/` (historical; may use the old name).

## Commands

```bash
npm run dev | build | preview   # dev server base /risk-parity-compass/ (5173), dist/, preview (4173)
npm test | test:e2e             # vitest | playwright (builds first)
npm run lint | format           # eslint | prettier --check
```

Every node subprocess needs `env -u NODE_OPTIONS <cmd>` (the shim is broken).

## Layout

`src/App.jsx` (shared state and effects; inline styles) · `src/tabs/` (Holdings, Analysis, Trades, Retirement tab bodies, each taking App's state as props) · `PortfoliosTab.jsx`, `LearnTab.jsx` · `src/utils/` (pure finance: `finance.js`, `withdrawal.js`, `portfolioPath.js`, `portfolios.js`, `longRun.js`, `learning.js`, `storage.js`; static data `rmd-tables.json`, `long-run-returns.json`) · `src/components/` (charts and shared widgets) · `src/tokens.js` (colour tokens mirroring `DESIGN.md`) · `src/mocks/handlers.js` (MSW) · `tests/e2e/` (Playwright, Yahoo mocked).

## Rules

- Finance math is pure (`src/utils/`): no DOM, network or clock. Seeded RNG only.
- Every financial output needs a numeric oracle computed independently of the implementation, at realistic scale. Label-only assertions are forbidden.
- Rates are annual; functions take `periodsPerYear`. Simulations run in dollars. (Full contracts: `docs/spec.md` §3.)
- Inline styles only, values from `DESIGN.md`; add a token there before inventing a colour.
- Yahoo Finance is the only data source; tests never hit it live. It is CORS-blocked from localhost and from the deployed Pages origin, so retirement inputs must never depend on a fetch.
- Storage keys are `rpcompass_*`. `shannonsdemon_*` is read-only legacy for migration; never write it, never use the old name for the product.
- No new dependency without justification in the commit.

## Workflow

- One milestone or issue = one branch = one PR (< 400 changed lines). **Agents never merge.**
- Docs before code: a plan in `docs/superpowers/plans/` first. Update `docs/plan.md` when an issue or PR changes state.
- Conventional Commits (commitlint via Lefthook). Prettier reformats on commit.
- Gates: test, lint, format, build, test:e2e, Lighthouse CI (perf ≥ 0.9, a11y ≥ 0.95, best-practices ≥ 0.9, SEO ≥ 0.9). A11y is 0.95 not 1.0 (gradient button contrast, see `DESIGN.md`).
- Stale `vite preview` on 4173 silently serves an old build; check the port. Lighthouse locally needs `CHROME_PATH`.

## Current state

M1–M7 shipped (M7 expert-review remediation, #37, closed). Open caveats are in `Known Limitations.md`. See `docs/plan.md`.
