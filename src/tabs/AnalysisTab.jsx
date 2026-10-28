import { ACCOUNT_TYPES, TAX_INEFFICIENCY, closestTickers, fmt } from '../utils/finance';
import { C } from '../tokens';
import CorrelationMatrix from '../components/CorrelationMatrix';
import ErrorBoundary from '../components/ErrorBoundary';
import PerformanceChart from '../components/PerformanceChart';
import RiskContribution from '../components/RiskContribution';
import Tooltip from '../components/Tooltip';
import WeightBar from '../components/WeightBar';

export default function AnalysisTab({
  S,
  analysisState,
  corrMatrix,
  currentValueByTicker,
  errorMsg,
  failedTicker,
  perfData,
  prices,
  retryCountdown,
  riskContrib,
  runAnalysis,
  setRetryCountdown,
  setTickerInput,
  setTickers,
  targetAllocation,
  targetWeights,
  threshold,
  tickers,
  totalValue,
  trades,
  vols,
}) {
  return (
    <ErrorBoundary>
      <div role="tabpanel" id="panel-analysis" aria-labelledby="tab-analysis">
        {analysisState === 'idle' && (
          <div style={{ color: C.onSurfaceMuted, textAlign: 'center', marginTop: 60 }}>
            Enter your holdings and click{' '}
            <strong style={{ color: C.onSurfaceMuted }}>Run Analysis</strong> to see risk parity
            targets.
          </div>
        )}

        {analysisState === 'error' && (
          <div style={S.error}>
            <strong>Error fetching market data:</strong> {errorMsg}
            {failedTicker && (
              <div style={{ marginTop: 8, color: C.onSurfaceMuted }}>
                Did you mean:{' '}
                {closestTickers(failedTicker).map(s => (
                  <button
                    key={s}
                    onClick={() => {
                      setTickers(prev => prev.map(t => (t === failedTicker ? s : t)));
                      setTickerInput(prev =>
                        prev
                          .split(/[,\s]+/)
                          .map(t => (t.trim().toUpperCase() === failedTicker ? s : t))
                          .join(', ')
                      );
                    }}
                    style={{
                      margin: '0 4px',
                      padding: '8px 12px',
                      minHeight: 44,
                      minWidth: 44,
                      background: C.surfaceInput,
                      border: '1px solid #1e293b',
                      color: C.focus,
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontFamily: 'monospace',
                      fontSize: 14,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div style={{ marginTop: 6, color: C.negativeText }}>
              Yahoo Finance unofficial API may be rate-limiting or blocking requests.{' '}
              {retryCountdown > 0
                ? `Retry in ${retryCountdown}s…`
                : 'Try again in a minute, or check your ticker symbols.'}
            </div>
            <button
              style={{ ...S.btn, marginTop: 8 }}
              onClick={() => {
                setRetryCountdown(30);
                runAnalysis();
              }}
            >
              Retry Now
            </button>
          </div>
        )}

        {analysisState === 'done' && (
          <>
            {/* Summary metrics */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 12,
                marginBottom: 18,
              }}
            >
              {[
                { label: 'Assets', val: tickers.length },
                { label: 'Trade Trigger', val: fmt.pct(threshold) },
                { label: 'Trades Needed', val: trades.length },
              ].map(m => (
                <div key={m.label} style={S.card}>
                  <div style={S.metricVal}>{m.val}</div>
                  <div style={S.metricLbl}>
                    {m.label === 'Trade Trigger' ? (
                      <Tooltip tip="Only trade when drift exceeds this trigger — captures the volatility premium above costs">
                        {m.label}
                      </Tooltip>
                    ) : (
                      m.label
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Weight comparison chart */}
            <div style={S.card}>
              <div style={S.cardTitle}>Current vs Target Weights</div>
              <div style={{ fontSize: 13, color: C.onSurfaceMuted, marginBottom: 12 }}>
                <span
                  style={{
                    background: C.positive,
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    marginRight: 4,
                  }}
                />
                under target
                <span
                  style={{
                    background: C.negative,
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    margin: '0 4px 0 12px',
                  }}
                />
                over target
                <span
                  style={{
                    border: '1px dashed #3b82f6',
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    margin: '0 4px 0 12px',
                  }}
                />
                target
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tickers.map(t => {
                  const curW = totalValue > 0 ? (currentValueByTicker[t] ?? 0) / totalValue : 0;
                  const tgtW = targetWeights[t] ?? 0;
                  return <WeightBar key={t} ticker={t} current={curW} target={tgtW} />;
                })}
              </div>
            </div>

            {/* Risk parity table */}
            <div style={S.card}>
              <div style={S.cardTitle}>
                <Tooltip tip="Equal risk contribution: weights are solved from volatilities and correlations so each asset contributes the same share of portfolio risk (unlevered, long-only)">
                  Risk Parity Weights (Equal Risk Contribution)
                </Tooltip>
              </div>
              <div style={S.tableWrap}>
                <table className="sd-table" style={S.table}>
                  <thead>
                    <tr>
                      {[
                        'Ticker',
                        'Volatility',
                        'Target Allocation',
                        'Target Value',
                        'Current Value',
                        'Off Target',
                      ].map(h => (
                        <th key={h} style={S.th}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tickers.map(t => {
                      const tgtW = targetWeights[t] ?? 0;
                      const curW = totalValue > 0 ? (currentValueByTicker[t] ?? 0) / totalValue : 0;
                      const drift = curW - tgtW;
                      return (
                        <tr key={t}>
                          <td
                            style={{
                              ...S.td,
                              fontWeight: 600,
                              color: C.onSurface,
                              fontFamily: 'monospace',
                            }}
                          >
                            {t}
                          </td>
                          <td style={S.td}>{fmt.vol(vols[t] ?? 0)}</td>
                          <td style={S.td}>{fmt.pct(tgtW)}</td>
                          <td style={S.td}>{fmt.usd(tgtW * totalValue)}</td>
                          <td style={S.td}>{fmt.usd(currentValueByTicker[t] ?? 0)}</td>
                          <td
                            style={{
                              ...S.td,
                              color:
                                Math.abs(drift) > threshold ? C.negativeText : C.onSurfaceMuted,
                            }}
                          >
                            {drift >= 0 ? '+' : ''}
                            {fmt.pct(drift)}
                            {Math.abs(drift) > threshold && ' ⚠'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tax location */}
            <div style={S.card}>
              <div style={S.cardTitle}>
                <Tooltip tip="Bonds/REITs/commodities go in IRAs first to shelter ordinary income">
                  Tax-Efficient Location (Target)
                </Tooltip>
              </div>
              <div style={{ fontSize: 13, color: C.onSurfaceMuted, marginBottom: 12 }}>
                Tax-inefficient assets (bonds, commodities, REITs) are placed in tax-advantaged
                accounts first. Tax score: 8–10 means hold in an IRA, 5–7 is neutral, 1–4 is
                tax-efficient. Scores are heuristics — verify with a tax advisor.
              </div>
              <div style={S.tableWrap}>
                <table className="sd-table" style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Ticker</th>
                      <th style={S.th}>Tax Score</th>
                      {ACCOUNT_TYPES.map(a => (
                        <th key={a} style={S.th}>
                          {a}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tickers.map(t => (
                      <tr key={t}>
                        <td
                          style={{
                            ...S.td,
                            fontFamily: 'monospace',
                            fontWeight: 600,
                            color: C.onSurface,
                          }}
                        >
                          {t}
                        </td>
                        <td style={S.td}>
                          <span
                            style={S.pill(
                              (TAX_INEFFICIENCY[t] ?? 5) >= 8
                                ? 'sell'
                                : (TAX_INEFFICIENCY[t] ?? 5) >= 5
                                  ? null
                                  : 'buy'
                            )}
                          >
                            {TAX_INEFFICIENCY[t] ?? '5 (est.)'}
                          </span>
                        </td>
                        {ACCOUNT_TYPES.map(a => (
                          <td key={a} style={S.td}>
                            {targetAllocation[a]?.[t] > 0 ? (
                              fmt.usd(targetAllocation[a][t])
                            ) : (
                              <span style={{ color: C.onSurfaceMuted }}>—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Prices */}
            <div style={S.card}>
              <div style={S.cardTitle}>Last Prices (Yahoo Finance)</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {tickers.map(t => (
                  <div key={t} style={{ minWidth: 80 }}>
                    <div
                      style={{
                        fontFamily: 'monospace',
                        fontSize: 13,
                        color: C.onSurfaceMuted,
                      }}
                    >
                      {t}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: C.onSurface }}>
                      {prices[t] ? `$${prices[t].toFixed(2)}` : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <RiskContribution
              S={S}
              tickers={tickers}
              targetWeights={targetWeights}
              riskContrib={riskContrib}
            />

            <CorrelationMatrix S={S} tickers={tickers} corrMatrix={corrMatrix} />

            <PerformanceChart S={S} perfData={perfData} />
          </>
        )}
      </div>
    </ErrorBoundary>
  );
}
