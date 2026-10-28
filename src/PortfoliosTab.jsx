import { useEffect, useMemo, useRef, useState } from 'react';
import { computeOverlap, correlationMatrix, fetchMonthlyHistory } from './utils/finance';
import { buildPortfolioPath } from './utils/portfolioPath';
import { rollingWithdrawalRates } from './utils/withdrawal';
import { rollingLongRun } from './utils/longRun';
import {
  PORTFOLIO_TEMPLATES,
  diversificationScore,
  getTemplate,
  MAX_COMPARED_TEMPLATES,
  metricDifference,
  weightRows,
} from './utils/portfolios';

const pct = (v, digits = 2) => `${(v * 100).toFixed(digits)}%`;
// SWR/PWR/success are withheld when history is too short; drawdown is not.
const cell = (r, m) => (r.withheld && m.key !== 'maxDrawdown' ? '—' : pct(r[m.key], m.digits));
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
  const rolling =
    rollingLongRun(weights, totalValue, {
      horizonYears: retirement.horizonYears,
      inflationRate: retirement.inflationRate,
      annualSpend: retirement.monthlySpend * 12,
    }) ??
    rollingWithdrawalRates(path, {
      horizonYears: retirement.horizonYears,
      periodsPerYear: 12,
      inflationRate: retirement.inflationRate,
      monthlySpend: retirement.monthlySpend,
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
  extraTemplateIds,
  setExtraTemplateIds,
  comparisonMode,
  setComparisonMode,
  onLoadTemplate,
}) {
  const [filter, setFilter] = useState('');
  const [result, setResult] = useState({ status: 'idle' });
  const historyCache = useRef(new Map());

  const compared = useMemo(
    () =>
      [selectedTemplateId, ...extraTemplateIds]
        .filter((id, i, ids) => id && ids.indexOf(id) === i)
        .map(getTemplate)
        .filter(Boolean)
        .slice(0, MAX_COMPARED_TEMPLATES),
    [selectedTemplateId, extraTemplateIds]
  );
  const comparedKey = compared.map(t => t.id).join('|');
  const primary = compared[0];
  const visibleTemplates = useMemo(
    () => PORTFOLIO_TEMPLATES.filter(t => t.name.toLowerCase().includes(filter.toLowerCase())),
    [filter]
  );

  const horizonYears = retirement.horizonYears;
  const inflationRate = retirement.inflationRate;
  useEffect(() => {
    if (compared.length === 0 || analysisState !== 'done' || totalValue <= 0) {
      setResult({ status: 'idle' });
      return undefined;
    }
    let cancelled = false;
    setResult({ status: 'loading' });
    const needed = [
      ...new Set([
        ...Object.keys(targetWeights),
        ...compared.flatMap(t => Object.keys(t.allocations)),
      ]),
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
        const templates = {};
        for (const t of compared) {
          templates[t.id] = await portfolioMetrics(t.allocations, histories, opts, totalValue);
        }
        if (!cancelled) setResult({ status: 'done', key: comparedKey, current, templates });
      } catch (e) {
        if (!cancelled) setResult({ status: 'error', message: e.message ?? String(e) });
      }
    })();
    return () => {
      cancelled = true;
    };
    // comparedKey stands in for the compared array identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparedKey, analysisState, targetWeights, totalValue, horizonYears, inflationRate]);

  const toggleExtra = id => {
    setExtraTemplateIds(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id].slice(0, MAX_COMPARED_TEMPLATES - 1)
    );
  };
  const onSelectPrimary = id => {
    setSelectedTemplateId(id || null);
    setExtraTemplateIds(prev => prev.filter(x => x !== id));
  };

  // A finished result is only valid for the template set it was computed for.
  const done = result.status === 'done' && result.key === comparedKey;
  const shortestHistory = done
    ? Math.min(
        result.current.effectiveYears,
        ...compared.map(t => result.templates[t.id].effectiveYears)
      )
    : Infinity;
  const warnStyle = {
    background: '#1c1200', // DESIGN.md colors.warning-surface
    border: '1px solid #92400e', // colors.warning-border
    color: '#fbbf24', // colors.warning
    borderRadius: 8,
    padding: '10px 14px',
    marginBottom: 12,
    fontSize: 13,
  };
  const metricCard = (testId, value, label) => (
    <div className="sd-card" style={S.card} key={testId}>
      <div style={S.metricVal} data-testid={testId}>
        {value}
      </div>
      <div style={S.metricLbl}>{label}</div>
    </div>
  );

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
              onChange={e => onSelectPrimary(e.target.value)}
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
            style={{ ...S.btn, ...(!primary ? S.btnDisabled : {}) }}
            disabled={!primary}
            onClick={() => onLoadTemplate(primary.id)}
          >
            Load Template
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 12,
          marginBottom: 12,
        }}
      >
        {visibleTemplates.map(t => {
          const isPrimary = t.id === selectedTemplateId;
          const isExtra = extraTemplateIds.includes(t.id);
          const full = compared.length >= MAX_COMPARED_TEMPLATES && !isPrimary && !isExtra;
          return (
            <div key={t.id} style={{ ...S.card, margin: 0 }} data-testid={`template-card-${t.id}`}>
              <h3 style={{ ...S.cardTitle, margin: 0 }}>{t.name}</h3>
              <p style={{ color: '#cbd5e1', fontSize: 13 }}>{t.description}</p>
              <ul style={{ color: '#94a3b8', fontSize: 12, paddingLeft: 16 }}>
                {Object.entries(t.allocations).map(([ticker, w]) => (
                  <li key={ticker}>
                    {ticker} {pct(w, 1)}
                  </li>
                ))}
              </ul>
              <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 8 }}>
                {t.source} · Reviewed {t.lastReviewed}
              </div>
              <label style={{ ...S.label, display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={isPrimary || isExtra}
                  disabled={isPrimary || full}
                  onChange={() => toggleExtra(t.id)}
                />
                Add {t.name} to comparison
              </label>
              <button
                type="button"
                style={{ ...S.btn, width: 'auto', padding: '8px 14px', marginTop: 8 }}
                onClick={() => {
                  onSelectPrimary(t.id);
                  onLoadTemplate(t.id);
                }}
              >
                Load {t.name}
              </button>
            </div>
          );
        })}
      </div>

      {!primary && (
        <div style={{ color: '#94a3b8', textAlign: 'center', marginTop: 40 }}>
          Choose a template (up to {MAX_COMPARED_TEMPLATES}) to compare with your current portfolio.
        </div>
      )}

      {compared.map(t => {
        const rows = weightRows(targetWeights, t.allocations);
        return (
          <div style={S.card} key={t.id}>
            <h3 style={{ ...S.cardTitle, margin: 0, marginBottom: 8 }}>{t.name}</h3>
            <div style={S.tableWrap}>
              <table style={S.table} aria-label={`Weight comparison — ${t.name}`}>
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
        );
      })}

      {primary && analysisState !== 'done' && (
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
      {done && shortestHistory < horizonYears && (
        <div style={warnStyle} role="status">
          Available overlapping history ({shortestHistory.toFixed(1)} yr) is shorter than your{' '}
          {horizonYears}-year horizon; metrics use the shorter window.
        </div>
      )}

      {done && (
        <>
          {[
            ['Current', result.current],
            ...compared.map(t => [t.name, result.templates[t.id]]),
          ].map(([name, r]) => (
            <div key={name} style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }} role="status">
              {name}: historical windows {r.windowCount}
              {r.basis === 'long-run' ? ' (1928–2025 index proxies)' : ''}
              {r.withheld ? ` — SWR/PWR/success withheld: ${r.withheldReason}` : ''}
            </div>
          ))}
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
              {metricCard(
                `metric-${m.key}-current`,
                cell(result.current, m),
                `${m.label} — Current`
              )}
              {compared.map(t => [
                metricCard(
                  `metric-${m.key}-${t.id}`,
                  cell(result.templates[t.id], m),
                  `${m.label} — ${t.name}`
                ),
                comparisonMode &&
                  metricCard(
                    `metric-${m.key}-diff-${t.id}`,
                    result.current.withheld || result.templates[t.id].withheld
                      ? '—'
                      : signedPp(
                          metricDifference(result.current, result.templates[t.id])[m.key],
                          m.digits
                        ),
                    `${m.short} Δ (${t.name} − current)`
                  ),
              ])}
            </div>
          ))}

          {compared.map(t => {
            const score = diversificationScore(result.templates[t.id].corr);
            return (
              <div style={S.card} key={t.id}>
                <h3 style={{ ...S.cardTitle, margin: 0, marginBottom: 8 }}>
                  Diversification Score — {t.name}
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
                    data-testid={`diversification-warnings-${t.id}`}
                  >
                    {score.warnings.map(w => (
                      <div key={w}>{w}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
