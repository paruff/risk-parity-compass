# M5 — Production hardening & accessibility (plan)

Issue: #11. Exit: production checklist passes; Lighthouse budgets hold; PDF export works.

## Tasks
1. `src/utils/storage.js`: v2 key + schemaVersion, v1 migration, export/import validation, scenarios, backup reminder, price cache. Unit tests first (`storage.test.js`).
2. `computeOverlap` returns `limitedBy`; Retirement tab shows effective horizon and limiting ticker.
3. Stale-price fallback in `runAnalysis` (cached quote + timestamp banner + manual price override); timestamp line above all tabs.
4. `PlanTools` component: export/import, backup reminder, text size (100/115/130%), high-contrast toggle; prefs persisted in state.
5. Print stylesheet and "Download PDF" (`window.print()`), disclaimer under retirement metrics.
6. E2E: export/import, invalid import, v1 migration, font scale, contrast, print media, axe on Portfolios.
7. Docs: README, Known Limitations, plan status.

## Already present
Error boundaries on all tabs; stale-results banner.

## Verification
Unit + e2e suites; Lighthouse (`lighthouserc.json` budgets); keyboard-only e2e check; manual screen-reader pass remains a human step.
