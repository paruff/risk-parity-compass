import { ACCOUNT_TYPES, CASH, fmt, holdingsValue } from '../utils/finance';
import { C } from '../tokens';
import ErrorBoundary from '../components/ErrorBoundary';

// Invested + cash against the account balance; the gap is money not yet entered above.
function AccountReconcile({ balance, invested, cash }) {
  const gap = balance - invested - cash;
  if (invested + cash === 0) return null;
  return (
    <div style={{ fontSize: 13, color: C.onSurfaceMuted, marginTop: 3 }}>
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
  tickers,
  totalValue,
  updateHolding,
}) {
  const totalCash = ACCOUNT_TYPES.reduce(
    (sum, acct) => sum + holdingsValue(currentHoldings[acct], prices).cash,
    0
  );
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
                balance={accounts[acct] ?? 0}
                {...holdingsValue(currentHoldings[acct], prices)}
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
                    borderBottom: '1px solid #0f172a',
                  }}
                >
                  <span style={{ color: C.onSurfaceMuted }}>{t}</span>
                  <span>{fmt.usd(v)}</span>
                </div>
              ))}
              {totalCash > 0 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '4px 0',
                    borderBottom: '1px solid #0f172a',
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
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
