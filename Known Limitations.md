# Known Limitations to Disclose

## Data Source
- **Yahoo Finance unofficial API** — works from browsers today but could break without notice. The `fetchQuote()` function is isolated so you can swap it for Alpha Vantage (free tier, 25 req/day) or Polygon.io easily.
- **Short ETF history limits 30-year SWR** — the default ticker set (SPY, TLT, GLD, VNQ, EEM) only has ~22 years of overlapping monthly history. The app reports `effectiveYears` and computes rolling metrics over available history rather than returning zeros.
- **Stale-price fallback** — if a live quote fails, the last good quote for that ticker and lookback is used, flagged with its timestamp, and prices can be overridden by hand. Cached data is never refreshed silently.
- **Yahoo CORS from localhost** — the chart endpoint blocks requests from `localhost` due to CORS. This works on GitHub Pages but fails locally; the app surfaces an error banner rather than silently failing.

## Calculations
- **Monte Carlo method** — when every holding has a proxy (stocks, small cap, Treasuries, bills, gold), the simulation resamples whole calendar years from 1928–2025 annual index data, which keeps real stock/bond co-crashes. The data is annual, uses a 10-year Treasury for long bonds and has no commodity or managed-futures series; holdings without a proxy fall back to Gaussian shocks with constant correlation. Proxy history is not your ETFs' own history.
- **Historical mean drift** — in Gaussian mode only, Monte Carlo defaults to each ticker's historical mean return. You can switch to `zero` or `custom` drift modes in the retirement inputs.
- **Volatility lookback sensitivity** — inverse-vol weights can shift meaningfully between 3mo and 2y, especially for assets like GLD or TLT. Worth being aware of which lookback you're anchoring to.
- **Heuristic tax logic** — withdrawal sequencing uses a bracket heuristic (`~$44k/yr` for single filers) that is a simplification, not a full tax calculation. Verify with a qualified advisor.
- **Constant inflation** — the retirement engine assumes a single, constant inflation rate over the entire horizon. Real inflation varies.
- **Guardrail selector** — the Retirement tab offers None and RPR-80. Guyton-Klinger and VPW exist in `guardrailSpend` but are not selectable, and Guyton-Klinger's state is not carried between years inside the Monte Carlo.
- **Guardrails are models, not guarantees** — RPR-80, Guyton-Klinger, and VPW are spending *rules*, not promises. They reduce sequence risk but don't eliminate it.

## Tax & Legal
- **Not financial, tax, or legal advice** — every retirement metric is a planning estimate. Historical and simulated results do not guarantee future outcomes. Verify RMDs and tax figures with a qualified advisor.
- **RMD rules may change** — the IRS Uniform Lifetime Table is versioned (`RMD_TABLE_VERSION` exposed in UI), but future legislation could change eligibility ages or factors.
- **State taxes ignored** — the engine only models federal tax brackets. State income taxes vary widely and can materially affect net withdrawals.

## Features Not Yet Implemented
- **RMDs are implemented** (IRS Uniform Lifetime Table, versioned); they cover Traditional IRA/401k only and assume the account owner's own age.
- **Tax-loss harvesting** — sell decisions don't optimize for capital loss harvesting.
- **Roth conversion optimization** — no guidance on partial Roth conversions in low-income years.
- **Social Security optimization** — claiming strategy (when to claim) is not modeled.
- **PDF export** — "Download PDF" opens the browser print dialog (print stylesheet, light background); choose "Save as PDF". No PDF library is bundled.
- **Template data fidelity** — template allocations are transcribed by hand from Risk Parity Radio pages (see each template's `lastReviewed`); they are not fetched live and can drift from the source.
- **Template ETFs** — templates use specific ETFs (for example VTI, VGLT, GLDM); load a template to analyse exactly those tickers, or edit the ticker list afterwards.

## Browser & Environment
- **localStorage only** — all state persists under `rpcompass_*` keys (data saved under the old `shannonsdemon_*` keys is migrated automatically and left in place as a backup). Use Export plan / Import plan to back up. No cloud sync, no accounts.
- **Single-tab assumption** — concurrent edits in multiple tabs may overwrite each other.
- **No mobile app** — responsive web only; touch targets meet 44px minimum but complex tables scroll horizontally on small screens.
- **CORS on localhost** — Yahoo Finance blocks monthly history requests from `localhost` due to CORS. The app shows an error banner; on GitHub Pages it works.