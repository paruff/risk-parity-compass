import { ACCOUNT_TYPES, fmt } from '../utils/finance';
import { C } from '../tokens';
import DrawdownBacktestChart from '../components/DrawdownBacktestChart';
import ErrorBoundary from '../components/ErrorBoundary';
import FanChart from '../components/FanChart';
import {
  RMD_TABLE_VERSION,
  requiredMinimumDistribution,
  withdrawalSequence,
} from '../utils/withdrawal';

export default function RetirementTab({
  S,
  accounts,
  analysisState,
  calculateRetirement,
  retirement,
  retirementCalculating,
  retirementResults,
  seqExtra,
  setRetirement,
}) {
  return (
    <ErrorBoundary>
      <div role="tabpanel" id="panel-retirement" aria-labelledby="tab-retirement">
        {analysisState !== 'done' ? (
          <div style={{ color: C.onSurfaceMuted, textAlign: 'center', marginTop: 60 }}>
            Run Analysis first to generate retirement projections.
          </div>
        ) : retirementResults?.error ? (
          <div style={S.bannerError} role="alert">
            {retirementResults.error}
          </div>
        ) : (
          <div>
            {/* Inputs Panel */}
            <div style={S.card}>
              <div style={S.cardTitle}>Retirement Parameters</div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 12,
                }}
              >
                <div>
                  <label style={S.label} htmlFor="ret-monthly-spend">
                    Monthly Spend
                  </label>
                  <input
                    id="ret-monthly-spend"
                    type="number"
                    className="sd-input"
                    style={S.input}
                    value={retirement.monthlySpend}
                    onChange={e =>
                      setRetirement(r => ({
                        ...r,
                        monthlySpend: parseFloat(e.target.value) || 0,
                      }))
                    }
                    min={0}
                    step={100}
                    placeholder="e.g. 4000"
                  />
                </div>
                <div>
                  <label style={S.label} htmlFor="ret-inflation-rate">
                    Inflation Rate
                  </label>
                  <input
                    id="ret-inflation-rate"
                    type="number"
                    className="sd-input"
                    style={S.input}
                    value={retirement.inflationRate}
                    onChange={e =>
                      setRetirement(r => ({
                        ...r,
                        inflationRate: parseFloat(e.target.value) || 0,
                      }))
                    }
                    min={0}
                    max={0.2}
                    step={0.005}
                  />
                </div>
                <div>
                  <label style={S.label} htmlFor="ret-horizon-years">
                    Horizon (Years)
                  </label>
                  <input
                    id="ret-horizon-years"
                    type="number"
                    className="sd-input"
                    style={S.input}
                    value={retirement.horizonYears}
                    onChange={e =>
                      setRetirement(r => ({
                        ...r,
                        horizonYears: parseInt(e.target.value) || 0,
                      }))
                    }
                    min={1}
                    max={50}
                    step={1}
                  />
                </div>
                <div>
                  <label style={S.label} htmlFor="ret-legacy-target">
                    Legacy Target
                  </label>
                  <input
                    id="ret-legacy-target"
                    type="number"
                    className="sd-input"
                    style={S.input}
                    value={retirement.legacyTarget}
                    onChange={e =>
                      setRetirement(r => ({
                        ...r,
                        legacyTarget: parseFloat(e.target.value) || 0,
                      }))
                    }
                    min={0}
                    step={1000}
                  />
                </div>
                <div>
                  <label style={S.label} htmlFor="ret-birth-year">
                    Birth Year
                  </label>
                  <input
                    id="ret-birth-year"
                    type="number"
                    className="sd-input"
                    style={S.input}
                    value={retirement.birthYear}
                    onChange={e =>
                      setRetirement(r => ({
                        ...r,
                        birthYear: parseInt(e.target.value) || 1960,
                      }))
                    }
                    min={1920}
                    max={2020}
                    step={1}
                    placeholder="e.g. 1955"
                  />
                </div>
                <div>
                  <label style={S.label} htmlFor="ret-ss-start-age">
                    Social Security Start Age
                  </label>
                  <input
                    id="ret-ss-start-age"
                    type="number"
                    className="sd-input"
                    style={S.input}
                    value={retirement.socialSecurityStartAge}
                    onChange={e =>
                      setRetirement(r => ({
                        ...r,
                        socialSecurityStartAge: parseInt(e.target.value) || 67,
                      }))
                    }
                    min={62}
                    max={70}
                    step={1}
                  />
                </div>
                <div>
                  <label style={S.label} htmlFor="ret-pension-start-age">
                    Pension Start Age
                  </label>
                  <input
                    id="ret-pension-start-age"
                    type="number"
                    className="sd-input"
                    style={S.input}
                    value={retirement.pensionStartAge}
                    onChange={e =>
                      setRetirement(r => ({
                        ...r,
                        pensionStartAge: parseInt(e.target.value) || 65,
                      }))
                    }
                    min={55}
                    max={70}
                    step={1}
                  />
                </div>
                <div>
                  <label style={S.label} htmlFor="ret-ss-monthly">
                    Social Security / Mo
                  </label>
                  <input
                    id="ret-ss-monthly"
                    type="number"
                    className="sd-input"
                    style={S.input}
                    value={retirement.socialSecurityMonthly}
                    onChange={e =>
                      setRetirement(r => ({
                        ...r,
                        socialSecurityMonthly: parseFloat(e.target.value) || 0,
                      }))
                    }
                    min={0}
                    step={100}
                  />
                </div>
                <div>
                  <label style={S.label} htmlFor="ret-pension-monthly">
                    Pension / Mo
                  </label>
                  <input
                    id="ret-pension-monthly"
                    type="number"
                    className="sd-input"
                    style={S.input}
                    value={retirement.pensionMonthly}
                    onChange={e =>
                      setRetirement(r => ({
                        ...r,
                        pensionMonthly: parseFloat(e.target.value) || 0,
                      }))
                    }
                    min={0}
                    step={100}
                  />
                </div>
                <div>
                  <label style={S.label} htmlFor="ret-cash-buffer">
                    Cash Buffer (Months)
                  </label>
                  <input
                    id="ret-cash-buffer"
                    type="number"
                    className="sd-input"
                    style={S.input}
                    value={retirement.cashBufferMonths}
                    onChange={e =>
                      setRetirement(r => ({
                        ...r,
                        cashBufferMonths: parseInt(e.target.value) || 0,
                      }))
                    }
                    min={0}
                    max={60}
                    step={1}
                  />
                </div>
                <div>
                  <label style={S.label} htmlFor="ret-guardrail">
                    Spending Guardrail
                  </label>
                  <select
                    id="ret-guardrail"
                    className="sd-input"
                    style={S.input}
                    value={retirement.guardrail}
                    onChange={e => setRetirement(r => ({ ...r, guardrail: e.target.value }))}
                  >
                    <option value="none">None (Fixed)</option>
                    <option value="rpr-80">RPR-80 (Cut to 6% if &lt;80%)</option>
                  </select>
                </div>
                <div>
                  <label style={S.label} htmlFor="ret-drift-mode">
                    MC Drift Mode
                  </label>
                  <select
                    id="ret-drift-mode"
                    className="sd-input"
                    style={S.input}
                    value={retirement.driftMode}
                    onChange={e => setRetirement(r => ({ ...r, driftMode: e.target.value }))}
                  >
                    <option value="historical">Historical Mean</option>
                    <option value="zero">Zero (Conservative)</option>
                  </select>
                </div>
                <div>
                  <label style={S.label} htmlFor="ret-seq-strategy">
                    Draw Order
                  </label>
                  <select
                    id="ret-seq-strategy"
                    className="sd-input"
                    style={S.input}
                    value={retirement.sequenceStrategy}
                    onChange={e => setRetirement(r => ({ ...r, sequenceStrategy: e.target.value }))}
                  >
                    <option value="taxable-first">Taxable, then traditional, then Roth</option>
                    <option value="bracket-fill">
                      Fill the bracket room (~$44k/yr heuristic) with traditional first
                    </option>
                  </select>
                </div>
                {retirement.sequenceStrategy === 'bracket-fill' && (
                  <div>
                    <label style={S.label} htmlFor="ret-roth-conv">
                      Roth conversion per year ($, within bracket room only)
                    </label>
                    <input
                      id="ret-roth-conv"
                      className="sd-input"
                      style={S.input}
                      type="number"
                      min="0"
                      value={retirement.rothConversionAnnual ?? 0}
                      onChange={e =>
                        setRetirement(r => ({
                          ...r,
                          rothConversionAnnual: Math.max(0, Number(e.target.value) || 0),
                        }))
                      }
                    />
                  </div>
                )}
              </div>
              <button
                type="button"
                style={{
                  ...S.btn,
                  width: 'auto',
                  padding: '12px 16px',
                  marginTop: 12,
                  ...(retirementCalculating ? S.btnDisabled : {}),
                }}
                onClick={calculateRetirement}
                disabled={retirementCalculating}
              >
                {retirementCalculating ? '⏳ Calculating…' : '▶ Calculate'}
              </button>
            </div>

            {/* Results */}
            {retirementResults && (
              <div>
                <div
                  role="status"
                  data-testid="history-windows"
                  style={{ fontSize: 12, marginBottom: 8, opacity: 0.8 }}
                >
                  {retirementResults.withheld
                    ? `SWR / PWR / success withheld: ${retirementResults.withheldReason}. `
                    : ''}
                  Historical windows: {retirementResults.windowCount}
                  {retirementResults.basis === 'long-run'
                    ? ' (1928–2025 annual index proxies, not your ETFs’ own history)'
                    : ''}
                </div>
                {/* Metric Cards */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 12,
                    marginBottom: 18,
                  }}
                >
                  <div className="sd-card" style={S.card}>
                    <div className="sd-metricVal" style={S.metricVal} data-testid="metric-swr">
                      {retirementResults.withheld
                        ? '—'
                        : `${(retirementResults.swr * 100).toFixed(2)}%`}
                    </div>
                    <div style={S.metricLbl}>Safe Withdrawal Rate (SWR)</div>
                  </div>
                  <div className="sd-card" style={S.card}>
                    <div className="sd-metricVal" style={S.metricVal} data-testid="metric-pwr">
                      {retirementResults.withheld
                        ? '—'
                        : `${(retirementResults.pwr * 100).toFixed(2)}%`}
                    </div>
                    <div style={S.metricLbl}>Perpetual Withdrawal Rate (PWR)</div>
                  </div>
                  <div className="sd-card" style={S.card}>
                    <div className="sd-metricVal" style={S.metricVal} data-testid="metric-success">
                      {retirementResults.withheld
                        ? '—'
                        : `${(retirementResults.successRate * 100).toFixed(1)}%`}
                    </div>
                    <div style={S.metricLbl}>Success Probability</div>
                  </div>
                  <div className="sd-card" style={S.card}>
                    <div className="sd-metricVal" style={S.metricVal} data-testid="metric-maxdd">
                      {(retirementResults.maxDrawdown * 100).toFixed(1)}%
                    </div>
                    <div style={S.metricLbl}>Max Drawdown</div>
                  </div>
                  <div className="sd-card" style={S.card}>
                    <div className="sd-metricVal" style={S.metricVal} data-testid="metric-horizon">
                      {retirementResults.effectiveYears?.toFixed(1) ?? '—'} yr
                    </div>
                    <div style={S.metricLbl}>
                      Effective Horizon
                      {retirementResults.limitedBy
                        ? ` (limited by ${retirementResults.limitedBy})`
                        : ''}
                    </div>
                  </div>
                  {retirementResults.bridgeYears != null && retirementResults.bridgeYears > 0 && (
                    <div style={S.card}>
                      <div style={S.metricVal}>{retirementResults.bridgeYears}</div>
                      <div style={S.metricLbl}>Bridge Years to Income</div>
                    </div>
                  )}
                  {retirementResults.bufferStatus && (
                    <div style={S.card}>
                      <div style={S.metricVal}>
                        {retirementResults.bufferStatus.remainingMonths?.toFixed(1) ??
                          retirementResults.bufferStatus.months ??
                          '—'}
                      </div>
                      <div style={S.metricLbl}>Cash Buffer Remaining (Mo)</div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="sd-noprint"
                  style={{
                    ...S.btn,
                    width: 'auto',
                    padding: '12px 16px',
                    marginBottom: 12,
                  }}
                  onClick={() => window.print()}
                >
                  Download PDF
                </button>
                {/* Disclaimer: directly beneath the metric cards */}
                <div
                  data-testid="metrics-disclaimer"
                  style={{
                    fontSize: 12,
                    color: C.onSurfaceMuted,
                    marginBottom: 14,
                    padding: '8px 12px',
                    background: C.surfaceInput,
                    borderRadius: 6,
                  }}
                >
                  Planning estimates only — not financial, tax, or legal advice. Historical and
                  simulated results do not guarantee future outcomes. Verify RMDs and tax figures
                  with a qualified advisor.
                </div>

                {/* Drawdown Backtest Chart */}
                <div style={S.card}>
                  <div style={S.cardTitle}>Historical SWR/PWR by Start Year</div>
                  <DrawdownBacktestChart
                    samples={retirementResults.samples}
                    horizonYears={retirement.horizonYears}
                  />
                </div>

                {retirementResults.guardrailComparison && (
                  <div style={S.card} data-testid="guardrail-comparison">
                    <div style={S.cardTitle}>
                      Static vs Guardrail ({retirementResults.guardrailComparison.policy})
                    </div>
                    <div style={S.tableWrap}>
                      <table style={S.table} aria-label="Static vs guardrail outcomes">
                        <thead>
                          <tr>
                            <th style={S.th}>Outcome (Monte Carlo)</th>
                            <th style={S.th}>Static</th>
                            <th style={S.th}>Guardrail</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ['success', 'Success Probability', r => fmt.pct(r.successRate)],
                            ['median', 'Median terminal value', r => fmt.usd(r.median)],
                            ['p10', '10th percentile terminal value', r => fmt.usd(r.p10)],
                          ].map(([key, label, format]) => (
                            <tr key={key}>
                              <td style={S.td}>{label}</td>
                              <td style={S.td} data-testid={`cmp-${key}-static`}>
                                {format(retirementResults.guardrailComparison.static)}
                              </td>
                              <td style={S.td} data-testid={`cmp-${key}-guardrail`}>
                                {format(retirementResults.guardrailComparison.guardrail)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ color: C.onSurfaceMuted, fontSize: 12, marginTop: 8 }}>
                      Both runs use the same simulated markets (seed 42); only the spending rule
                      differs. Guardrails are models, not guarantees.
                    </div>
                  </div>
                )}

                {/* Monte Carlo Fan Chart */}
                <div style={S.card}>
                  <div style={S.cardTitle}>Monte Carlo Fan Chart (P10–P90)</div>
                  <p data-testid="mc-method" style={{ color: C.onSurfaceMuted, fontSize: 12 }}>
                    {retirementResults.mcMethod === 'bootstrap'
                      ? 'Method: resampled calendar years 1928–2025 from index proxies (annual data, not your ETFs’ own history).'
                      : 'Method: Gaussian shocks with constant correlation; a holding has no long-run proxy.'}
                  </p>
                  <FanChart
                    bands={retirementResults.bands}
                    steps={retirementResults.bands?.p50?.length ?? 360}
                    monthlySpend={retirement.monthlySpend}
                  />
                </div>

                {/* RMD Table */}
                <div style={S.card}>
                  <div style={S.cardTitle}>
                    Required Minimum Distributions (RMD){' '}
                    <span style={{ fontSize: 11, color: C.onSurfaceMuted, marginLeft: 8 }}>
                      Table: {RMD_TABLE_VERSION}
                    </span>
                  </div>
                  <div style={S.tableWrap}>
                    <table className="sd-table" style={S.table}>
                      <thead>
                        <tr>
                          <th style={S.th}>Age</th>
                          <th style={S.th}>Distribution Period</th>
                          {ACCOUNT_TYPES.filter(a => a.includes('IRA') || a.includes('401k')).map(
                            a => (
                              <th key={a} style={S.th}>
                                {a} RMD
                              </th>
                            )
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90,
                        ].map(age => (
                          <tr key={age}>
                            <td style={S.th}>{age}</td>
                            <td style={S.td}>
                              {requiredMinimumDistribution(age, 1000000, {
                                birthYear: retirement.birthYear,
                              }).distributionPeriod ?? '—'}
                            </td>
                            {ACCOUNT_TYPES.filter(a => a.includes('IRA') || a.includes('401k')).map(
                              a => (
                                <td key={a} style={S.td}>
                                  {accounts[a]
                                    ? fmt.usd(
                                        requiredMinimumDistribution(age, accounts[a], {
                                          birthYear: retirement.birthYear,
                                        }).rmd
                                      )
                                    : '—'}
                                </td>
                              )
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Withdrawal Sequencing Table */}
                <div style={S.card}>
                  <div style={S.cardTitle}>Withdrawal Sequencing</div>
                  <div style={S.tableWrap}>
                    <table className="sd-table" style={S.table}>
                      <thead>
                        <tr>
                          <th style={S.th}>Account</th>
                          <th style={S.th}>Taxable Withdrawal</th>
                          <th style={S.th}>Traditional Withdrawal (incl. RMD)</th>
                          <th style={S.th}>Roth Withdrawal</th>
                          <th style={S.th}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const seq = withdrawalSequence(accounts, retirement.monthlySpend, {
                            ...seqExtra(),
                            rmdByAccount: Object.fromEntries(
                              ACCOUNT_TYPES.filter(
                                a => a.includes('IRA') || a.includes('401k')
                              ).map(a => [
                                a,
                                requiredMinimumDistribution(73, accounts[a] ?? 0, {
                                  birthYear: retirement.birthYear,
                                }).rmd,
                              ])
                            ),
                          });
                          return [
                            { name: 'Taxable', ...seq.byAccount.Taxable },
                            {
                              name: 'Traditional IRA / 401k',
                              ...seq.byAccount['Traditional IRA / 401k'],
                            },
                            { name: 'Roth IRA', ...seq.byAccount['Roth IRA'] },
                          ];
                        })().map(row => (
                          <tr key={row.name}>
                            <td style={S.th}>{row.name}</td>
                            <td style={S.td}>
                              {row.taxable > 0 ? fmt.usd(row.taxable * 12) : '—'}
                            </td>
                            <td style={S.td}>
                              {row.traditional > 0 ? fmt.usd(row.traditional * 12) : '—'}
                            </td>
                            <td style={S.td}>{row.roth > 0 ? fmt.usd(row.roth * 12) : '—'}</td>
                            <td style={S.td}>
                              {fmt.usd((row.taxable + row.traditional + row.roth) * 12)}
                            </td>
                          </tr>
                        ))}
                        <tr>
                          <td style={S.th}>Yearly Total</td>
                          <td style={S.td}>
                            {(() => {
                              const seq = withdrawalSequence(accounts, retirement.monthlySpend, {
                                ...seqExtra(),
                                rmdByAccount: Object.fromEntries(
                                  ACCOUNT_TYPES.filter(
                                    a => a.includes('IRA') || a.includes('401k')
                                  ).map(a => [
                                    a,
                                    requiredMinimumDistribution(73, accounts[a] ?? 0, {
                                      birthYear: retirement.birthYear,
                                    }).rmd,
                                  ])
                                ),
                              });
                              return fmt.usd(seq.byAccount.Taxable * 12);
                            })()}
                          </td>
                          <td style={S.td}>
                            {(() => {
                              const seq = withdrawalSequence(accounts, retirement.monthlySpend, {
                                ...seqExtra(),
                                rmdByAccount: Object.fromEntries(
                                  ACCOUNT_TYPES.filter(
                                    a => a.includes('IRA') || a.includes('401k')
                                  ).map(a => [
                                    a,
                                    requiredMinimumDistribution(73, accounts[a] ?? 0, {
                                      birthYear: retirement.birthYear,
                                    }).rmd,
                                  ])
                                ),
                              });
                              return fmt.usd(seq.byAccount['Traditional IRA / 401k'] * 12);
                            })()}
                          </td>
                          <td style={S.td}>
                            {(() => {
                              const seq = withdrawalSequence(accounts, retirement.monthlySpend, {
                                ...seqExtra(),
                                rmdByAccount: Object.fromEntries(
                                  ACCOUNT_TYPES.filter(
                                    a => a.includes('IRA') || a.includes('401k')
                                  ).map(a => [
                                    a,
                                    requiredMinimumDistribution(73, accounts[a] ?? 0, {
                                      birthYear: retirement.birthYear,
                                    }).rmd,
                                  ])
                                ),
                              });
                              return fmt.usd(seq.byAccount['Roth IRA'] * 12);
                            })()}
                          </td>
                          <td style={S.td}>
                            {(() => {
                              const seq = withdrawalSequence(accounts, retirement.monthlySpend, {
                                ...seqExtra(),
                                rmdByAccount: Object.fromEntries(
                                  ACCOUNT_TYPES.filter(
                                    a => a.includes('IRA') || a.includes('401k')
                                  ).map(a => [
                                    a,
                                    requiredMinimumDistribution(73, accounts[a] ?? 0, {
                                      birthYear: retirement.birthYear,
                                    }).rmd,
                                  ])
                                ),
                              });
                              return fmt.usd(seq.totalSpend * 12);
                            })()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
