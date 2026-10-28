import { ACCOUNT_TYPES, fmt } from '../utils/finance';
import { C } from '../tokens';
import ErrorBoundary from '../components/ErrorBoundary';

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
  return (
    <ErrorBoundary>
      <div role="tabpanel" id="panel-holdings" aria-labelledby="tab-holdings">
        <div style={S.warning}>
          Enter your <strong>current share counts</strong> per account. These are compared against
          risk parity targets to generate trades. Leave at 0 if you don't hold a position.
        </div>

        <div style={S.card}>
          <div style={{ ...S.cardTitle, marginBottom: 6 }}>Bulk paste</div>
          <textarea
            placeholder="Paste CSV: Account, Ticker, Shares — e.g. Taxable,SPY,100"
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
          </div>
        ))}

        {currentTotalFromPrices > 0 && (
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
            </div>
            <div style={{ marginTop: 10, color: C.onSurfaceMuted, fontSize: 13 }}>
              Total tracked:{' '}
              <strong style={{ color: C.onSurface }}>{fmt.usd(currentTotalFromPrices)}</strong> vs
              account total: <strong style={{ color: C.onSurface }}>{fmt.usd(totalValue)}</strong>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
