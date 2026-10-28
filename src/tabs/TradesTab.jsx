import { ACCOUNT_TYPES, fmt } from '../utils/finance';
import { C } from '../tokens';
import Confetti from '../components/Confetti';
import ErrorBoundary from '../components/ErrorBoundary';

export default function TradesTab({
  S,
  analysisState,
  exportState,
  exportTradesCSV,
  threshold,
  trades,
}) {
  return (
    <ErrorBoundary>
      <div role="tabpanel" id="panel-trades" aria-labelledby="tab-trades">
        {analysisState !== 'done' && (
          <div style={{ color: C.onSurfaceMuted, textAlign: 'center', marginTop: 60 }}>
            Run Analysis first to generate trades.
          </div>
        )}

        {analysisState === 'done' && trades.length === 0 && (
          <div style={{ ...S.card, textAlign: 'center', padding: '32px 20px' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>✓</div>
            <div style={{ color: C.onSurfaceMuted, fontSize: 15 }}>
              All positions are within the{' '}
              <strong style={{ color: C.onSurfaceMuted }}>{fmt.pct(threshold)}</strong> rebalance
              band. No trades needed.
            </div>
            <div style={{ color: C.onSurfaceMuted, fontSize: 13, marginTop: 8 }}>
              Shannon's Demon: Only rebalance when drift captures a meaningful volatility premium
              above transaction costs.
            </div>
            <Confetti />
          </div>
        )}

        {analysisState === 'done' && trades.length > 0 && (
          <>
            <div style={S.warning}>
              These trades move your portfolio toward risk parity targets within tax-efficient
              accounts. <strong>Verify share counts and prices before executing.</strong> Consider
              tax impact of sells in taxable accounts.
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                style={{ ...S.btn, width: 'auto', padding: '12px 16px' }}
                onClick={exportTradesCSV}
              >
                📋 Copy trades as CSV
              </button>
            </div>
            <details style={{ marginBottom: 12 }}>
              <summary
                style={{
                  cursor: 'pointer',
                  fontSize: 14,
                  color: C.onSurfaceMuted,
                  minHeight: 44,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                Advanced
              </summary>
              <button
                type="button"
                style={{
                  ...S.btn,
                  width: 'auto',
                  padding: '12px 16px',
                  marginTop: 8,
                }}
                onClick={exportState}
              >
                📦 Copy full state JSON
              </button>
            </details>

            <div style={S.card}>
              <div style={S.cardTitle}>Rebalancing Trades</div>
              <div style={S.tableWrap}>
                <table className="sd-table" style={S.table}>
                  <thead>
                    <tr>
                      {[
                        'Action',
                        'Ticker',
                        'Account',
                        'Shares',
                        'Amount',
                        'Current Allocation',
                        'Target Allocation',
                        'Off Target',
                      ].map(h => (
                        <th key={h} style={S.th}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((tr, i) => (
                      <tr key={i}>
                        <td style={S.td}>
                          <span style={S.pill(tr.action.toLowerCase())}>{tr.action}</span>
                        </td>
                        <td
                          style={{
                            ...S.td,
                            fontFamily: 'monospace',
                            fontWeight: 600,
                            color: C.onSurface,
                          }}
                        >
                          {tr.ticker}
                        </td>
                        <td style={{ ...S.td, color: C.onSurfaceMuted }}>{tr.account}</td>
                        <td style={S.td}>{fmt.shares(tr.shares)}</td>
                        <td style={S.td}>{fmt.usd(tr.dollarAmount)}</td>
                        <td style={S.td}>{fmt.pct(tr.currentWeight)}</td>
                        <td style={{ ...S.td, color: C.focus }}>{fmt.pct(tr.targetWeight)}</td>
                        <td style={{ ...S.td, color: C.negativeText }}>{fmt.pct(tr.drift)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Per-account summary */}
            <div style={S.grid2}>
              {ACCOUNT_TYPES.map(acct => {
                const acctTrades = trades.filter(t => t.account === acct);
                if (acctTrades.length === 0) return null;
                return (
                  <div key={acct} style={S.card}>
                    <div style={S.cardTitle}>{acct}</div>
                    {acctTrades.map((tr, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '5px 0',
                          borderBottom: '1px solid #0f172a',
                          fontSize: 14,
                        }}
                      >
                        <span>
                          <span style={S.pill(tr.action.toLowerCase())}>{tr.action}</span>{' '}
                          <span style={{ fontFamily: 'monospace' }}>{tr.ticker}</span>
                        </span>
                        <span style={{ color: C.onSurfaceMuted }}>
                          {fmt.shares(tr.shares)} sh · {fmt.usd(tr.dollarAmount)}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </ErrorBoundary>
  );
}
