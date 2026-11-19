# Validate share entries against the intended balance (#64)

**Decision: validate, not assume.** Shares stay the input; the Holdings tab shows each position's
value (shares × snapshot price) and weight, and warns on a mismatch. Deriving shares from a target
amount ("assume") is a non-destructive follow-up, deliberately not built here.

## Behaviour

- Per account: invested + cash vs the stated account balance. Warn when the gap exceeds **5%** of the
  balance (catches 100 vs 1000 typos and stale counts). Quiet for an empty account or no balance.
- Per position: value and % of the account balance next to the share box.
- Portfolio: each position's weight (cash in the denominator) vs `targetWeights`; warn when more than
  **10 points** away.

Known limits: the target comparison needs an analysis to have run (targets do not exist before), so
before then only the balance check shows. Cash is in the weight denominator while targets exclude it,
matching the Analysis tab's "cash is 0% target", so large cash can trip the drift warning. "Moves
beyond a threshold" means drift from target, not change since the last entry.

## Code

- `validateAccount`, `positionDrift` in `src/utils/finance.js` (pure).
- `HoldingsTab` renders them; `App` passes `targetWeights`.

## Tests

`src/utils/__tests__/shareValidation.test.js`: hand-computed at $250,000 scale (10x typo, 20% stale
count, in-tolerance, empty, drift both directions).
