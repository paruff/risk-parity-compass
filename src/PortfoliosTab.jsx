import { useEffect, useMemo, useRef, useState } from 'react';
import { computeOverlap, correlationMatrix, fetchMonthlyHistory } from './utils/finance';
import { buildPortfolioPath } from './utils/portfolioPath';
import { rollingWithdrawalRates } from './utils/withdrawal';
import {
  PORTFOLIO_TEMPLATES,
  diversificationScore,
  getTemplate,
  metricDifference,
  weightRows,
} from './utils/portfolios';

const pct = (v, digits = 2) => `${(v * 100).toFixed(digits)}%`;
const signedPp = (v, digits = 2) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(digits)} pp`;

const METRICS = [
  { key: 'swr', label: 'Safe Withdrawal Rate (SWR)', short: 'SWR', digits: 2 },
  { key: 'pwr', label: 'Perpetual Withdrawal Rate (PWR)', short: 'PWR', digits: 2 },
  { key: 'successRate', label: 'Success Probability', short: 'Success', digits: 1 },
  { key: 'maxDrawdown', label: 'Max Drawdown', short: 'Drawdown', digits: 1 },
];

async function portfolioMetrics(weights, histories, retirement, totalValue) {
  const tickers = Object.keys(weights);
  const picked = {};
  for (const t of tickers) {
    if (!histories[t]) throw new Error(`No history for ${t}`);
    picked[t] = histories[t];
  }
  const { aligned, effectiveYears } = computeOverlap(picked);
  if (Object.keys(aligned).length === 0) throw new Error('No overlapping price history');
  const path = buildPortfolioPath(aligned, weights, totalValue);
  const rolling = rollingWithdrawalRates(path, {
    horizonYears: retirement.horizonYears,
    periodsPerYear: 12,
    inflationRate: retirement.inflationRate,
  });
  return { ...rolling, effectiveYears, corr: correlationMatrix(aligned) };
}

export default function PortfoliosTab({
  S,
  analysisState,
  targetWeights,
  totalValue,
  retirement,
  selectedTemplateId,
  setSelectedTemplateId,
  comparisonMode,
  setComparisonMode,
  onLoadTemplate,
}) {
  const [filter, setFilter] = useState('');
  const [result, setResult] = useState({ status: 'idle' });
  const historyCache = useRef(new Map());

  const template = getTemplate(selectedTemplateId);
  const visibleTemplates = useMemo(
    () => PORTFOLIO_TEMPLATES.filter(t => t.name.toLowerCase().includes(filter.toLowerCase())),
    [filter]
  );
  const rows = useMemo(
    () => (template ? weightRows(targetWeights, template.allocations) : []),
    [template, targetWeights]
  );

  const horizonYears = retirement.horizonYears;
  const inflationRate = retirement.inflationRate;
  useEffect(() => {
    if (!template || analysisState !== 'done' || totalValue <= 0) {
      setResult({ status: 'idle' });
      return undefined;
    }
    let cancelled = false;
    setResult({ status: 'loading' });
    const needed = [
      ...new Set([...Object.keys(targetWeights), ...Object.keys(template.allocations)]),
    ];
    for (const t of needed) {
      if (!historyCache.current.has(t)) historyCache.current.set(t, fetchMonthlyHistory(t));
    }
    (async () => {
      try {
        const settled = await Promise.allSettled(needed.map(t => historyCache.current.get(t)));
        const histories = {};
        const failed = [];
        settled.forEach((s, i) => {
          if (s.status === 'fulfilled') histories[needed[i]] = s.value;
          else {
            failed.push(needed[i]);
            historyCache.current.delete(needed[i]); // allow retry
          }
        });
        if (failed.length > 0) throw new Error(`Could not load history for ${failed.join(', ')}`);
        const opts = { horizonYears, inflationRate };
        const current = await portfolioMetrics(targetWeights, histories, opts, totalValue);
        const tmpl = await portfolioMetrics(template.allocations, histories, opts, totalValue);
        if (!cancelled) setResult({ status: 'done', current, template: tmpl });
      } catch (e) {
        if (!cancelled) setResult({ status: 'error', message: e.message ?? String(e) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [template, analysisState, targetWeights, totalValue, horizonYears, inflationRate]);

  const done = result.status === 'done';
  const diff = done ? metricDifference(result.current, result.template) : null;
  const score = done ? diversificationScore(result.template.corr) : null;
  const shortHistory =
    done && Math.min(result.current.effectiveYears, result.template.effectiveYears) < horizonYears;
  const warnStyle = {
    background: '#451a03',
    border: '1px solid #b45309',
    color: '#fde68a',
    borderRadius: 8,
    padding: '10px 14px',
    marginBottom: 12,
    fontSize: 13,
  };

  return (
    <div>
      <div style={S.card}>
        <h2 style={{ ...S.cardTitle, margin: 0, marginBottom: 12 }}>Portfolio Templates</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={S.label} htmlFor="template-filter">
              Filter templates
            </label>
            <input
              id="template-filter"
              className="sd-input"
              style={S.input}
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="e.g. butterfly"
            />
          </div>
          <div>
            <label style={S.label} htmlFor="template-select">
              Select template
            </label>
            <select
              id="template-select"
              className="sd-input"
              style={S.input}
              value={selectedTemplateId ?? ''}
              onChange={e => setSelectedTemplateId(e.target.value || null)}
            >
              <option value="">— choose —</option>
              {visibleTemplates.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <label style={{ ...S.label, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={comparisonMode}
              onChange={e => setComparisonMode(e.target.checked)}
            />
            Compare
          </label>
          <button
            type="button"
            style={{ ...S.btn, ...(!template ? S.btnDisabled : {}) }}
            disabled={!template}
            onClick={() => onLoadTemplate(template.id)}
          >
            Load Template
          </button>
        </div>
      </div>

      {!template && (
        <div style={{ color: '#94a3b8', textAlign: 'center', marginTop: 40 }}>
          Choose a template to compare it with your current portfolio.
        </div>
      )}

      {template && (
        <>
          <div style={S.card}>
            <h3 style={{ ...S.cardTitle, margin: 0 }}>{template.name}</h3>
            <p style={{ color: '#cbd5e1', fontSize: 14 }}>{template.description}</p>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>
              Source: {template.source} · Reviewed {template.lastReviewed}
            </div>
          </div>

          <div style={S.card}>
            <div style={S.tableWrap}>
              <table style={S.table} aria-label="Weight comparison">
                <thead>
                  <tr>
                    <th style={S.th}>Ticker</th>
                    <th style={S.th}>Current</th>
                    <th style={S.th}>Template</th>
                    {comparisonMode && <th style={S.th}>Difference (pp)</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.ticker}>
                      <td style={S.td}>{r.ticker}</td>
                      <td style={S.td}>{pct(r.current, 1)}</td>
                      <td style={S.td}>{pct(r.template, 1)}</td>
                      {comparisonMode && (
                        <td style={S.td}>
                          {r.diffPp >= 0 ? '+' : ''}
                          {r.diffPp.toFixed(1)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {analysisState !== 'done' && (
            <div style={{ color: '#94a3b8', textAlign: 'center', marginTop: 20 }}>
              Run Analysis first to compare retirement metrics.
            </div>
          )}
          {result.status === 'loading' && (
            <div style={{ color: '#94a3b8' }}>Loading monthly history…</div>
          )}
          {result.status === 'error' && (
            <div style={S.bannerError} role="alert">
              {result.message}
            </div>
          )}
          {shortHistory && (
            <div style={warnStyle} role="status">
              Available overlapping history (
              {Math.min(result.current.effectiveYears, result.template.effectiveYears).toFixed(1)}{' '}
              yr) is shorter than your {horizonYears}-year horizon; metrics use the shorter window.
            </div>
          )}

          {done && (
            <>
              {METRICS.map(m => (
                <div
                  key={m.key}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <div className="sd-card" style={S.card}>
                    <div style={S.metricVal} data-testid={`metric-${m.key}-current`}>
                      {pct(result.current[m.key], m.digits)}
                    </div>
                    <div style={S.metricLbl}>{m.label} — Current</div>
                  </div>
                  <div className="sd-card" style={S.card}>
                    <div style={S.metricVal} data-testid={`metric-${m.key}-template`}>
                      {pct(result.template[m.key], m.digits)}
                    </div>
                    <div style={S.metricLbl}>{m.label} — Template</div>
                  </div>
                  {comparisonMode && (
                    <div className="sd-card" style={S.card}>
                      <div style={S.metricVal} data-testid={`metric-${m.key}-diff`}>
                        {signedPp(diff[m.key], m.digits)}
                      </div>
                      <div style={S.metricLbl}>{m.short} Δ (template − current)</div>
                    </div>
                  )}
                </div>
              ))}

              <div style={S.card}>
                <h3 style={{ ...S.cardTitle, margin: 0, marginBottom: 8 }}>
                  Diversification Score
                </h3>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  <div>
                    <div style={S.metricVal}>{score.avgPairwiseCorrelation.toFixed(2)}</div>
                    <div style={S.metricLbl}>Avg Pairwise Correlation</div>
                  </div>
                  <div>
                    <div style={S.metricVal}>{score.maxPairwiseCorrelation.toFixed(2)}</div>
                    <div style={S.metricLbl}>Max Pairwise Correlation</div>
                  </div>
                  <div>
                    <div style={S.metricVal}>{score.classCount}</div>
                    <div style={S.metricLbl}>Macro Classes</div>
                  </div>
                </div>
                {score.warnings.length > 0 && (
                  <div
                    style={{ ...warnStyle, marginTop: 12, marginBottom: 0 }}
                    role="alert"
                    data-testid="diversification-warnings"
                  >
                    {score.warnings.map(w => (
                      <div key={w}>{w}</div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
