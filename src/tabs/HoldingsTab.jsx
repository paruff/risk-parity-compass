import {
  ACCOUNT_TYPES,
  CASH,
  fmt,
  holdingsValue,
  positionDrift,
  validateAccount,
} from '../utils/finance';
import { C } from '../tokens';
import ErrorBoundary from '../components/ErrorBoundary';

// Invested + cash against the account balance; warns when the gap exceeds 5% (typo or stale count).
function AccountReconcile({ invested, cash, gap, warn }) {
  if (invested + cash === 0) return null;
  return (
    <div
      role={warn ? 'alert' : undefined}
      style={{ fontSize: 13, color: warn ? C.warning : C.onSurfaceMuted, marginTop: 3 }}
    >
      {warn && '⚠ Check your share counts: '}
      Invested {fmt.usd(invested)} + cash {fmt.usd(cash)}
      {Math.abs(gap) >= 1 && (
        <>
          {' '}
          ·{' '}
          {gap > 0
            ? `${fmt.usd(gap)} of the balance not entered`
            : `${fmt.usd(-gap)} over the balance`}
        </>
      )}
    </div>
  );
}

export default function HoldingsTab({
  S,
  accounts,
  currentHoldings,
  currentTotalFromPrices,
  currentValueByTicker,
  handlePaste,
  prices,
  targetWeights,
  tickers,
  totalValue,
  updateHolding,
}) {
  const valueByAcct = Object.fromEntries(
    ACCOUNT_TYPES.map(acct => [acct, holdingsValue(currentHoldings[acct], prices)])
  );
  const checkByAcct = Object.fromEntries(
    ACCOUNT_TYPES.map(acct => [
      acct,
      validateAccount(currentHoldings[acct], prices, accounts[acct] ?? 0),
    ])
  );
  const totalCash = ACCOUNT_TYPES.reduce((sum, acct) => sum + valueByAcct[acct].cash, 0);
  // No targets exist until an analysis has run; comparing against {} would flag everything as 0% target.
  const drift = Object.keys(targetWeights ?? {}).length
    ? positionDrift(currentValueByTicker, totalCash, targetWeights)
    : [];
  const driftByTicker = Object.fromEntries(drift.map(d => [d.ticker, d]));
  const tracked = currentTotalFromPrices + totalCash;

  return (
    <ErrorBoundary>
      <div role="tabpanel" id="panel-holdings" aria-labelledby="tab-holdings">
        <div style={S.warning}>
          Enter your <strong>current share counts</strong> per account. These are compared against
          risk parity targets to generate trades. Leave at 0 if you don't hold a position. Enter
          uninvested money in the <strong>Cash</strong> box of each account.
        </div>

        <div style={S.card}>
          <div style={{ ...S.cardTitle, marginBottom: 6 }}>Bulk paste</div>
          <textarea
            placeholder="Paste CSV: Account, Ticker, Shares — e.g. Taxable,SPY,100 (use CASH and dollars for cash)"
            className="sd-input"
            style={{ ...S.input, height: 64, fontFamily: 'monospace', fontSize: 14 }}
            onPaste={handlePaste}
          />
        </div>

        {ACCOUNT_TYPES.map(acct => (
          <div key={acct} style={S.card}>
            <div style={{ ...S.cardTitle, marginBottom: 6 }}>{acct}</div>
            <div style={{ fontSize: 13, color: C.onSurfaceMuted, marginBottom: 12 }}>
              Balance: {fmt.usd(accounts[acct] ?? 0)}
            </div>
            <div className="sd-holdings-grid">
              {tickers.map(ticker => (
                <div key={ticker}>
                  <label style={S.label} htmlFor={`holding-${acct}-${ticker}`}>
                    {ticker} shares
                  </label>
                  <input
                    id={`holding-${acct}-${ticker}`}
                    type="number"
                    min={0}
                    step={0.0001}
                    className="sd-input"
                    style={S.input}
                    value={currentHoldings[acct]?.[ticker] ?? ''}
                    placeholder="0"
                    onChange={e => updateHolding(acct, ticker, e.target.value)}
                  />
                  {prices[ticker] && (currentHoldings[acct]?.[ticker] ?? 0) > 0 && (
                    <div style={{ fontSize: 13, color: C.onSurfaceMuted, marginTop: 3 }}>
                      ≈ {fmt.usd(currentHoldings[acct][ticker] * prices[ticker])}
                      {(accounts[acct] ?? 0) > 0 &&
                        ` · ${fmt.pct(checkByAcct[acct].positions.find(p => p.ticker === ticker)?.weight ?? 0)} of balance`}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, maxWidth: 220 }}>
              <label style={S.label} htmlFor={`cash-${acct}`}>
                Cash ($)
              </label>
              <input
                id={`cash-${acct}`}
                type="number"
                min={0}
                step={0.01}
                className="sd-input"
                style={S.input}
                value={currentHoldings[acct]?.[CASH] ?? ''}
                placeholder="0"
                onChange={e => updateHolding(acct, CASH, e.target.value)}
              />
              <AccountReconcile
                {...valueByAcct[acct]}
                gap={checkByAcct[acct].gap}
                warn={checkByAcct[acct].warn}
              />
            </div>
          </div>
        ))}

        {tracked > 0 && (
          <div style={S.card}>
            <div style={S.cardTitle}>Holdings Value (from last analysis prices)</div>
            <div style={S.grid2}>
              {Object.entries(currentValueByTicker).map(([t, v]) => (
                <div
                  key={t}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '4px 0',
                    borderBottom: `1px solid ${C.border}`,
                  }}
                >
                  <span style={{ color: C.onSurfaceMuted }}>{t}</span>
                  <span>
                    {fmt.usd(v)}
                    {driftByTicker[t] &&
                      ` · ${fmt.pct(driftByTicker[t].weight)} vs ${fmt.pct(driftByTicker[t].target)} target`}
                  </span>
                </div>
              ))}
              {totalCash > 0 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '4px 0',
                    borderBottom: `1px solid ${C.border}`,
                  }}
                >
                  <span style={{ color: C.onSurfaceMuted }}>Cash</span>
                  <span>{fmt.usd(totalCash)}</span>
                </div>
              )}
            </div>
            <div style={{ marginTop: 10, color: C.onSurfaceMuted, fontSize: 13 }}>
              Total tracked (incl. cash):{' '}
              <strong style={{ color: C.onSurface }}>{fmt.usd(tracked)}</strong> vs account total:{' '}
              <strong style={{ color: C.onSurface }}>{fmt.usd(totalValue)}</strong>
            </div>
            {drift
              .filter(d => d.warn)
              .map(d => (
                <div
                  key={d.ticker}
                  role="alert"
                  style={{ color: C.warning, fontSize: 13, marginTop: 4 }}
                >
                  ⚠ {d.ticker} is {fmt.pct(d.weight)} of holdings vs {fmt.pct(d.target)} target
                </div>
              ))}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
