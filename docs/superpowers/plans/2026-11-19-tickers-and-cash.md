# Plan: GOVZ, AVUV, KBWP tickers and cash tracking (#65)

**Goal:** support three more ETFs (the user holds two of them) and let the user record cash per account.

## Tickers

- GOVZ (25+ yr Treasury STRIPS) → `US Long Bonds`; AVUV (small-cap value) and KBWP (P&C insurers) → `US Equity`.
- Added to `COMMON_ETFS` and `MACRO_CLASS_MAP`, which feed `UNIVERSE` in `scripts/update-prices.mjs`.
- Snapshots written with `node scripts/update-prices.mjs GOVZ AVUV KBWP` (2026-11-19). Monthly history starts 2020-09 (GOVZ), 2019-09 (AVUV), 2011-01 (KBWP); all have the full 500-point daily window. The honest-metrics logic already withholds long-run statistics on short history, so no change was needed.

## Cash model (decision)

Cash is a dollar balance under `currentHoldings[account].CASH`, not a priced fund.

- Rides the existing holdings state, so storage, plan import/export, scenarios and bulk paste (`Account,CASH,dollars`) need no new keys or migration. `rpcompass_*` only.
- Alternative rejected: BIL as the only cash vehicle. It is a fund with price and volatility and cannot represent uninvested dollars. BIL stays as the template proxy.
- `holdingsValue(held, prices)` → `{ invested, cash }`; `cashAfterTrades(holdings, trades)` = cash − buys + sells per account. `generateTrades` skips CASH (no price). `getMacroClass('CASH')` = `Cash`.
- UI: per-account Cash ($) box on Holdings with an "invested + cash vs balance" line (the gap is money not yet entered, which also covers part of #64); cash row in Holdings Value; "Cash after trades" per account on Trades (warns when negative).

## Scope against the issue wording

#65 says cash "counts in total value, weights and trades, and as a macro class". Delivered: cash counts toward the tracked total and the reconcile against the account balance (the account balance already is the total value), is reported in trades as cash after trades, and has a macro class (`Cash`). Not delivered: cash in current-weight rows (see below).

## Not in this PR

- Cash is not a target-weight asset: targets still sum to 100% of the account balance, so the optimiser never chooses to hold cash. A target cash weight is a separate decision.
- Cash is not a row in the Analysis weight table, and no view reads the `Cash` macro class yet.
- `CASH` is excluded from `UNIVERSE` so the price refresh never asks Yahoo for it.

## Tests

- `src/utils/__tests__/cash.test.js`: hand-computed dollar oracles ($50,000 SPY + $10,000 cash; sell $5,000 / buy $15,000 ⇒ cash 0; overspend ⇒ −$10,000).
- `tests/e2e/cash.spec.js`: entry, reconciliation text, persistence, cash after trades.
