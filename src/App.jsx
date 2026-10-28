import ErrorBoundary from './components/ErrorBoundary';
import { proxyReturns } from './utils/longRun';
import Tooltip from './components/Tooltip';
import RiskContribution from './components/RiskContribution';
import CorrelationMatrix from './components/CorrelationMatrix';
import PerformanceChart from './components/PerformanceChart';

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = e => setMatches(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  TAX_INEFFICIENCY,
  ACCOUNT_TYPES,
  LOOKBACK_OPTIONS,
  fetchQuote,
  fetchMonthlyHistory,
  computeOverlap,
  annualizedVol,
  ercWeights,
  taxLocationWaterfall,
  generateTrades,
  closestTickers,
  correlationMatrix,
  riskContribution,
  simulatePerformance,
  fmt,
  mulberry32,
  normalSampler,
} from './utils/finance';
import {
  drawdownPath,
  rollingWithdrawalRates,
  monteCarloWithWithdrawals,
  requiredMinimumDistribution,
  RMD_TABLE_VERSION,
  withdrawalSequence,
} from './utils/withdrawal';
import { buildPortfolioPath } from './utils/portfolioPath';
import { getTemplate } from './utils/portfolios';
import PortfoliosTab from './PortfoliosTab';
import LearnTab from './LearnTab';
import { dueModules } from './utils/learning';
import PlanTools from './components/PlanTools';
import {
  loadState,
  saveState,
  loadScenarios,
  saveScenarios,
  exportPlan,
  importPlan,
  backupDue,
  getCachedQuote,
  cacheQuote,
} from './utils/storage';

const DEFAULT_TICKERS = ['SPY', 'TLT', 'GLD', 'VNQ', 'EEM'];

const DEFAULT_ACCOUNTS = {
  Taxable: 50000,
  'Traditional IRA / 401k': 30000,
  'Roth IRA': 20000,
};

// ─── FORMATTING HELPERS ───────────────────────────────────────────────────────

// ─── MINI BAR CHART ───────────────────────────────────────────────────────────

function WeightBar({ current, target, ticker }) {
  const maxW = Math.max(current, target, 0.001);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
      <span style={{ width: 48, fontFamily: 'monospace', color: '#94a3b8' }}>{ticker}</span>
      <div style={{ flex: 1, position: 'relative', height: 20 }}>
        {/* Target bar (background) */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 4,
            height: 12,
            width: `${(target / maxW) * 100}%`,
            background: '#1e40af22',
            borderRadius: 2,
            border: '1px dashed #3b82f6',
            transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
        {/* Current bar */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 4,
            height: 12,
            width: `${(current / maxW) * 100}%`,
            background: current > target ? '#dc2626' : '#16a34a',
            borderRadius: 2,
            opacity: 0.85,
            transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </div>
      <span style={{ width: 52, color: '#cbd5e1', textAlign: 'right' }}>{fmt.pct(current)}</span>
      <span style={{ width: 52, color: '#60a5fa', textAlign: 'right' }}>{fmt.pct(target)}</span>
    </div>
  );
}

// ─── CONFETTI (dependency-free) ───────────────────────────────────────────────
function Confetti() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 1800);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;
  const pieces = Array.from({ length: 20 }, (_, i) => ({
    left: `${(i * 137) % 100}%`,
    delay: `${(i % 8) * 0.08}s`,
    color: ['#3b82f6', '#0891b2', '#16a34a', '#f59e0b', '#f87171'][i % 5],
  }));
  return (
    <div
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 50 }}
    >
      {pieces.map((p, i) => (
        <span
          key={i}
          className="sd-confetti"
          style={{
            position: 'absolute',
            top: '-12px',
            left: p.left,
            width: 8,
            height: 12,
            background: p.color,
            borderRadius: 2,
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  );
}

// ─── DRAWDOWN BACKTEST CHART ──────────────────────────────────────────────────
function DrawdownBacktestChart({ samples, horizonYears }) {
  if (!samples || samples.length === 0)
    return (
      <div style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>
        No historical data for backtest
      </div>
    );

  const width = 600;
  const height = 200;
  const margin = { top: 20, right: 20, bottom: 40, left: 50 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const rates = samples.flatMap(s => [s.swr, s.pwr]);
  const maxRate = Math.max(...rates) * 1.1 || 0.1;

  const xScale = i => margin.left + (i / (samples.length - 1 || 1)) * innerWidth;
  const yScale = rate => margin.top + innerHeight - (rate / maxRate) * innerHeight;

  return (
    <div style={{ width: '100%', maxWidth: width, margin: '0 auto' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
        {[0, 0.25, 0.5, 0.75, 1].map(y => (
          <line
            key={y}
            x1={margin.left}
            y1={yScale(maxRate * y)}
            x2={margin.left + innerWidth}
            y2={yScale(maxRate * y)}
            stroke="#1e293b"
            strokeWidth={0.5}
          />
        ))}
        <line
          x1={margin.left}
          y1={margin.top}
          x2={margin.left}
          y2={margin.top + innerHeight}
          stroke="#334155"
          strokeWidth={1}
        />
        <line
          x1={margin.left}
          y1={margin.top + innerHeight}
          x2={margin.left + innerWidth}
          y2={margin.top + innerHeight}
          stroke="#334155"
          strokeWidth={1}
        />
        {[0, 0.25, 0.5, 0.75, 1].map(y => (
          <text
            key={y}
            x={margin.left - 8}
            y={yScale(maxRate * y) + 4}
            textAnchor="end"
            fontSize={10}
            fill="#94a3b8"
          >
            {(maxRate * y * 100).toFixed(1)}%
          </text>
        ))}
        {samples
          .filter((_, i) => i % Math.max(1, Math.floor(samples.length / 10)) === 0)
          .map((s, idx) => (
            <text
              key={s.startIndex}
              x={xScale(s.startIndex)}
              y={margin.top + innerHeight + 16}
              textAnchor="middle"
              fontSize={10}
              fill="#94a3b8"
              transform={`rotate(-45, ${xScale(s.startIndex)}, ${margin.top + innerHeight + 16})`}
            >
              Start {s.startIndex}
            </text>
          ))}
        <polyline
          fill="none"
          stroke="#16a34a"
          strokeWidth={1.5}
          points={samples.map((s, i) => `${xScale(i)},${yScale(s.swr)}`).join(' ')}
        />
        <polyline
          fill="none"
          stroke="#60a5fa"
          strokeWidth={1.5}
          strokeDasharray="4,2"
          points={samples.map((s, i) => `${xScale(i)},${yScale(s.pwr)}`).join(' ')}
        />
        {samples
          .filter(s => s.depleted)
          .map(s => (
            <circle
              key={s.startIndex}
              cx={xScale(samples.indexOf(s))}
              cy={yScale(s.swr)}
              r={3}
              fill="#f87171"
            />
          ))}
      </svg>
      <div
        style={{
          display: 'flex',
          gap: 16,
          marginTop: 8,
          fontSize: 12,
          color: '#94a3b8',
          justifyContent: 'center',
        }}
      >
        <span>
          <span
            style={{
              display: 'inline-block',
              width: 12,
              height: 2,
              background: '#16a34a',
              marginRight: 4,
              verticalAlign: 'middle',
            }}
          />{' '}
          SWR
        </span>
        <span>
          <span
            style={{
              display: 'inline-block',
              width: 12,
              height: 2,
              background: '#60a5fa',
              marginRight: 4,
              verticalAlign: 'middle',
            }}
          />{' '}
          PWR
        </span>
        <span>
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              background: '#f87171',
              borderRadius: '50%',
              marginRight: 4,
              verticalAlign: 'middle',
            }}
          />{' '}
          Depleted
        </span>
      </div>
    </div>
  );
}

// ─── FAN CHART ─────────────────────────────────────────────────────────────────
function FanChart({ bands, steps, monthlySpend }) {
  if (!bands || !bands.p50 || bands.p50.length === 0)
    return (
      <div style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>No Monte Carlo data</div>
    );

  const width = 600;
  const height = 200;
  const margin = { top: 20, right: 20, bottom: 40, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const allVals = [...bands.p90, ...bands.p75, ...bands.p50, ...bands.p25, ...bands.p10];
  const maxVal = Math.max(...allVals) * 1.05 || 1;

  const xScale = i => margin.left + (i / (steps - 1)) * innerWidth;
  const yScale = val => margin.top + innerHeight - (val / maxVal) * innerHeight;

  return (
    <div style={{ width: '100%', maxWidth: width, margin: '0 auto' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
        {[0, 0.25, 0.5, 0.75, 1].map(y => (
          <line
            key={y}
            x1={margin.left}
            y1={yScale(maxVal * y)}
            x2={margin.left + innerWidth}
            y2={yScale(maxVal * y)}
            stroke="#1e293b"
            strokeWidth={0.5}
          />
        ))}
        <path
          d={`M${bands.p10.map((v, i) => `${xScale(i)},${yScale(v)}`).join(' L')} L${bands.p90.map((v, i) => `${xScale(steps - 1 - i)},${yScale(v)}`).join(' L')} Z`}
          fill="#3b82f622"
        />
        <path
          d={`M${bands.p25.map((v, i) => `${xScale(i)},${yScale(v)}`).join(' L')} L${bands.p75.map((v, i) => `${xScale(steps - 1 - i)},${yScale(v)}`).join(' L')} Z`}
          fill="#3b82f644"
        />
        <polyline
          fill="none"
          stroke="#3b82f6"
          strokeWidth={1.5}
          points={bands.p50.map((v, i) => `${xScale(i)},${yScale(v)}`).join(' ')}
        />
        <line
          x1={margin.left}
          y1={margin.top}
          x2={margin.left}
          y2={margin.top + innerHeight}
          stroke="#334155"
          strokeWidth={1}
        />
        <line
          x1={margin.left}
          y1={margin.top + innerHeight}
          x2={margin.left + innerWidth}
          y2={margin.top + innerHeight}
          stroke="#334155"
          strokeWidth={1}
        />
        {[0, 0.25, 0.5, 0.75, 1].map(y => (
          <text
            key={y}
            x={margin.left - 8}
            y={yScale(maxVal * y) + 4}
            textAnchor="end"
            fontSize={10}
            fill="#94a3b8"
          >
            {fmt.usd(maxVal * y)}
          </text>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => (
          <text
            key={i}
            x={margin.left + (i * innerWidth) / 4}
            y={margin.top + innerHeight + 18}
            textAnchor="middle"
            fontSize={10}
            fill="#94a3b8"
          >
            Y{Math.round((frac * steps) / 12)}
          </text>
        ))}
      </svg>
      <div
        style={{
          display: 'flex',
          gap: 16,
          marginTop: 8,
          fontSize: 12,
          color: '#94a3b8',
          justifyContent: 'center',
        }}
      >
        <span>
          <span
            style={{
              display: 'inline-block',
              width: 12,
              height: 8,
              background: '#3b82f622',
              border: '1px solid #3b82f6',
              marginRight: 4,
              verticalAlign: 'middle',
            }}
          />{' '}
          P10–P90
        </span>
        <span>
          <span
            style={{
              display: 'inline-block',
              width: 12,
              height: 8,
              background: '#3b82f644',
              marginRight: 4,
              verticalAlign: 'middle',
            }}
          />{' '}
          P25–P75
        </span>
        <span>
          <span
            style={{
              display: 'inline-block',
              width: 12,
              height: 2,
              background: '#3b82f6',
              marginRight: 4,
              verticalAlign: 'middle',
            }}
          />{' '}
          Median
        </span>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  // ── Config state
  const [tickers, setTickers] = useState(DEFAULT_TICKERS);
  const [tickerInput, setTickerInput] = useState(DEFAULT_TICKERS.join(', '));
  const [lookback, setLookback] = useState('1y');
  const [threshold, setThreshold] = useState(0.05);

  // ── Account balances
  const [accounts, setAccounts] = useState(DEFAULT_ACCOUNTS);

  // ── Current holdings: { "Taxable": { SPY: shares } }
  const [currentHoldings, setCurrentHoldings] = useState(() => {
    const h = {};
    for (const acct of ACCOUNT_TYPES) h[acct] = {};
    return h;
  });

  // ── Analysis results
  const [analysisState, setAnalysisState] = useState('idle'); // idle | loading | done | error
  const [errorMsg, setErrorMsg] = useState('');
  const [failedTicker, setFailedTicker] = useState('');
  const [retryCountdown, setRetryCountdown] = useState(0);
  const [lastFetch, setLastFetch] = useState(null);
  const [prices, setPrices] = useState({});
  const [vols, setVols] = useState({});
  const [targetWeights, setTargetWeights] = useState({});
  const [targetAllocation, setTargetAllocation] = useState({});
  const [trades, setTrades] = useState([]);
  const [corrMatrix, setCorrMatrix] = useState({});
  const [riskContrib, setRiskContrib] = useState({});
  const [perfData, setPerfData] = useState({ dates: [], rebalanced: [], buyAndHold: [] });
  const [lastRunSignature, setLastRunSignature] = useState('');

  // ── UI tabs
  const [tab, setTab] = useState('holdings'); // holdings | analysis | trades | retirement | portfolios | learn
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [extraTemplateIds, setExtraTemplateIds] = useState([]);
  const [comparisonMode, setComparisonMode] = useState(true);
  const [autoRun, setAutoRun] = useState(false);
  const postRunTab = useRef(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const lookbackRef = useRef(null);
  const [tickerStatus, setTickerStatus] = useState({}); // { SPY: 'ok'|'error'|'pending' }
  const [scenarioName, setScenarioName] = useState('');
  const [scenarios, setScenarios] = useState(loadScenarios);

  // ── Display prefs, backup tracking, stale-price handling
  const [prefs, setPrefs] = useState({ fontScale: 1, highContrast: false });
  const [learning, setLearning] = useState({ rubricChoice: null, modules: {} });
  const [lastBackupAt, setLastBackupAt] = useState(null);
  const [staleQuotes, setStaleQuotes] = useState({}); // { SPY: cachedAtMs }
  const [priceOverrides, setPriceOverrides] = useState({}); // { SPY: number }

  // ── Retirement state
  const [retirement, setRetirement] = useState({
    monthlySpend: 4000,
    inflationRate: 0.03,
    horizonYears: 30,
    legacyTarget: 0,
    socialSecurityMonthly: 0,
    pensionMonthly: 0,
    cashBufferMonths: 12,
    guardrail: 'none',
    driftMode: 'historical',
    expectedReturn: null,
    birthYear: 1960,
    socialSecurityStartAge: 67,
    pensionStartAge: 65,
  });
  const [retirementResults, setRetirementResults] = useState(null);
  const [retirementCalculating, setRetirementCalculating] = useState(false);

  // ── Load persisted state
  useEffect(() => {
    const saved = loadState();
    if (!saved) return;
    if (saved.tickers) {
      setTickers(saved.tickers);
      setTickerInput(saved.tickers.join(', '));
    }
    if (saved.lookback) setLookback(saved.lookback);
    if (saved.threshold) setThreshold(saved.threshold);
    if (saved.accounts) setAccounts(saved.accounts);
    if (saved.currentHoldings) setCurrentHoldings(saved.currentHoldings);
    if (saved.retirement) setRetirement(saved.retirement);
    if (saved.prefs) setPrefs(p => ({ ...p, ...saved.prefs }));
    if (saved.lastBackupAt) setLastBackupAt(saved.lastBackupAt);
    if (saved.learning) setLearning(saved.learning);
    if (saved.selectedTemplateId) setSelectedTemplateId(saved.selectedTemplateId);
    if (Array.isArray(saved.extraTemplateIds)) setExtraTemplateIds(saved.extraTemplateIds);
    if (typeof saved.comparisonMode === 'boolean') setComparisonMode(saved.comparisonMode);
  }, []);

  // ── Persist on change
  useEffect(() => {
    saveState({
      tickers,
      lookback,
      threshold,
      accounts,
      currentHoldings,
      retirement,
      selectedTemplateId,
      extraTemplateIds,
      comparisonMode,
      prefs,
      lastBackupAt,
      learning,
    });
  }, [
    tickers,
    lookback,
    threshold,
    accounts,
    currentHoldings,
    retirement,
    selectedTemplateId,
    extraTemplateIds,
    comparisonMode,
    prefs,
    lastBackupAt,
    learning,
  ]);

  const totalValue = Object.values(accounts).reduce((a, b) => a + (b || 0), 0);
  const canRun = tickers.length > 0 && totalValue > 0;
  // Only inputs that feed Run Analysis; retirement inputs are applied by Calculate.
  const analysisSignature = useMemo(
    () => JSON.stringify({ tickers, lookback, threshold, accounts, currentHoldings }),
    [tickers, lookback, threshold, accounts, currentHoldings]
  );
  const isStale = analysisState === 'done' && lastRunSignature !== analysisSignature;

  // ── Debounced ticker validation
  useEffect(() => {
    const timer = setTimeout(async () => {
      const checks = tickers.map(async t => {
        setTickerStatus(s => ({ ...s, [t]: 'pending' }));
        try {
          await fetchQuote(t, lookback);
          setTickerStatus(s => ({ ...s, [t]: 'ok' }));
        } catch {
          setTickerStatus(s => ({ ...s, [t]: 'error' }));
        }
      });
      await Promise.all(checks);
    }, 500);
    return () => clearTimeout(timer);
  }, [tickers, lookback]);

  // ── Retry countdown
  useEffect(() => {
    if (retryCountdown <= 0) return;
    const t = setInterval(() => setRetryCountdown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [retryCountdown]);

  // ── Trade preview without re-running analysis
  const estimatedTrades = useMemo(
    () => generateTrades(currentHoldings, targetAllocation, prices, totalValue, threshold),
    [currentHoldings, targetAllocation, prices, totalValue, threshold]
  );

  // ── Compute current weights from holdings
  const currentValueByTicker = {};
  for (const holdings of Object.values(currentHoldings)) {
    for (const [ticker, shares] of Object.entries(holdings)) {
      if (shares > 0 && prices[ticker]) {
        currentValueByTicker[ticker] =
          (currentValueByTicker[ticker] ?? 0) + shares * prices[ticker];
      }
    }
  }
  const currentTotalFromPrices = Object.values(currentValueByTicker).reduce((a, b) => a + b, 0);

  // ── Run analysis
  const runAnalysis = useCallback(async () => {
    setAnalysisState('loading');
    setErrorMsg('');
    try {
      const settled = await Promise.allSettled(tickers.map(t => fetchQuote(t, lookback)));
      const stale = {};
      settled.forEach((r, i) => {
        const t = tickers[i];
        if (r.status === 'fulfilled') return cacheQuote(r.value, lookback);
        const cached = getCachedQuote(t, lookback);
        if (cached) {
          settled[i] = { status: 'fulfilled', value: cached };
          stale[t] = cached.at;
        }
      });
      setStaleQuotes(stale);
      const bad = tickers.filter((_, i) => settled[i].status === 'rejected');
      if (bad.length > 0) {
        setFailedTicker(bad[0]);
        throw new Error(`Could not fetch data for ${bad.join(', ')}`);
      }
      const results = settled.map(s => s.value);

      const newPrices = {};
      const newVols = {};
      const newCloses = {};
      for (const r of results) {
        newPrices[r.ticker] =
          priceOverrides[r.ticker] > 0 ? priceOverrides[r.ticker] : r.latestPrice;
        newVols[r.ticker] = annualizedVol(r.closes);
        newCloses[r.ticker] = r.closes;
      }

      const corr = correlationMatrix(newCloses);
      const weights = ercWeights(newVols, corr);
      const allocation = taxLocationWaterfall(weights, newPrices, accounts, totalValue);
      const newTrades = generateTrades(
        currentHoldings,
        allocation,
        newPrices,
        totalValue,
        threshold
      );

      // Phase 3: correlation, risk contribution, performance simulation
      const rc = riskContribution(weights, newVols, corr);
      const perf = simulatePerformance(newCloses, weights, threshold);

      setPrices(newPrices);
      setVols(newVols);
      setTargetWeights(weights);
      setTargetAllocation(allocation);
      setTrades(newTrades);
      setCorrMatrix(corr);
      setRiskContrib(rc);
      setPerfData(perf);
      setAnalysisState('done');
      setLastFetch(new Date().toISOString());
      setLastRunSignature(analysisSignature);
      setTab(postRunTab.current ?? 'analysis');
      postRunTab.current = null;
    } catch (e) {
      postRunTab.current = null;
      setErrorMsg(e.message ?? String(e));
      setAnalysisState('error');
    }
  }, [
    tickers,
    lookback,
    accounts,
    currentHoldings,
    totalValue,
    threshold,
    analysisSignature,
    priceOverrides,
  ]);

  // ── Calculate Retirement
  const calculateRetirement = useCallback(async () => {
    if (analysisState !== 'done') return;
    setRetirementCalculating(true);
    setRetirementResults(null);

    try {
      // Fetch monthly history for all tickers
      const monthlyData = await Promise.allSettled(tickers.map(t => fetchMonthlyHistory(t)));
      const histories = {};
      for (let i = 0; i < tickers.length; i++) {
        if (monthlyData[i].status === 'fulfilled') {
          histories[tickers[i]] = monthlyData[i].value;
        }
      }

      // Compute overlap
      const { aligned, effectiveYears, limitedBy } = computeOverlap(histories);
      if (Object.keys(aligned).length === 0) {
        throw new Error('No overlapping price history across tickers');
      }

      // Build monthly portfolio values using target weights and aligned prices
      const tickersWithData = Object.keys(aligned);
      const portfolioValues = buildPortfolioPath(aligned, targetWeights, totalValue);

      // Apply income floor (SS/pension)
      const { netSpend } = await import('./utils/withdrawal');
      const { netMonthlySpend, bridgeYears } = netSpend(
        retirement.monthlySpend,
        retirement.socialSecurityMonthly,
        retirement.pensionMonthly,
        retirement.socialSecurityStartAge ?? 67,
        retirement.pensionStartAge ?? 65,
        new Date().getFullYear() - (retirement.birthYear ?? 1960)
      );

      // Rolling SWR/PWR
      const rolling = rollingWithdrawalRates(portfolioValues, {
        horizonYears: retirement.horizonYears,
        periodsPerYear: 12,
        inflationRate: retirement.inflationRate,
        monthlySpend: netMonthlySpend,
      });

      // Current age for guardrails
      const currentAge = new Date().getFullYear() - (retirement.birthYear ?? 1960);

      // RMD for each traditional account (exclude Roth IRA)
      const RMD_ACCOUNT_TYPES = ['Traditional IRA / 401k'];
      const rmdTable = {};
      for (const acct of RMD_ACCOUNT_TYPES) {
        if (accounts[acct] != null) {
          rmdTable[acct] = {};
          for (let age = 73; age <= 90; age++) {
            rmdTable[acct][age] = requiredMinimumDistribution(age, accounts[acct] ?? 0, {
              birthYear: retirement.birthYear,
            });
          }
        }
      }

      // Monte Carlo with withdrawals (dollars, with guardrails)
      const allCloses = {};
      for (const t of tickersWithData) {
        allCloses[t] = aligned[t];
      }
      // Resample whole historical years (1928+) when every holding has a proxy series;
      // otherwise fall back to Gaussian shocks.
      const proxies = Object.fromEntries(Object.keys(targetWeights).map(t => [t, proxyReturns(t)]));
      const useBootstrap = Object.values(proxies).every(Boolean);
      const bootstrap = useBootstrap
        ? Object.fromEntries(Object.entries(proxies).map(([t, rows]) => [t, rows.map(x => x.r)]))
        : null;
      // Same seed for every run, so static vs guardrail differ only by the spending rule.
      const runMc = guardrail =>
        monteCarloWithWithdrawals(allCloses, targetWeights, vols, corrMatrix, {
          simulations: 200,
          steps: retirement.horizonYears * 12,
          monthlySpend: netMonthlySpend,
          inflationRate: retirement.inflationRate,
          driftMode: retirement.driftMode,
          bootstrap,
          seed: 42,
          startingValue: totalValue,
          guardrail,
          age: currentAge,
        });
      const summarize = r => ({
        successRate: r.successRate,
        median: r.stats.median,
        p10: r.stats.p10,
      });
      const mc = runMc(retirement.guardrail);
      const guardrailComparison =
        retirement.guardrail === 'none'
          ? null
          : {
              policy: retirement.guardrail,
              static: summarize(runMc('none')),
              guardrail: summarize(mc),
            };

      // Drawdown path with cash buffer and guardrails
      const bufferDrawdown = drawdownPath(portfolioValues, netMonthlySpend, {
        inflationRate: retirement.inflationRate,
        cashBufferMonths: retirement.cashBufferMonths,
        guardrail: retirement.guardrail,
        startingValue: totalValue,
        age: currentAge,
      });

      setRetirementResults({
        ...rolling,
        effectiveYears,
        limitedBy,
        bridgeYears,
        netMonthlySpend,
        bands: mc.bands,
        rmdTable,
        mcStats: mc.stats,
        guardrailComparison,
        mcMethod: useBootstrap ? 'bootstrap' : 'gaussian',
        bufferStatus: {
          months: retirement.cashBufferMonths,
          remainingMonths:
            bufferDrawdown.bufferBalance != null && netMonthlySpend > 0
              ? Math.max(0, bufferDrawdown.bufferBalance / netMonthlySpend)
              : 0,
        },
      });
    } catch (e) {
      console.error('Retirement calculation failed:', e);
      setRetirementResults({ error: e.message });
    } finally {
      setRetirementCalculating(false);
    }
  }, [analysisState, tickers, targetWeights, vols, corrMatrix, accounts, totalValue, retirement]);

  // ── Load a portfolio template: replace tickers, then re-run analysis once they apply
  const loadTemplate = id => {
    const template = getTemplate(id);
    if (!template) return;
    const next = Object.keys(template.allocations);
    setTickers(next);
    setTickerInput(next.join(', '));
    postRunTab.current = 'portfolios';
    setAutoRun(true);
  };
  useEffect(() => {
    if (!autoRun || !canRun) return;
    setAutoRun(false);
    runAnalysis();
  }, [autoRun, canRun, runAnalysis]);

  // ── UI helpers
  const updateAccount = (name, val) => {
    setAccounts(prev => ({ ...prev, [name]: parseFloat(val) || 0 }));
  };

  const updateHolding = (acct, ticker, val) => {
    setCurrentHoldings(prev => ({
      ...prev,
      [acct]: { ...prev[acct], [ticker]: parseFloat(val) || 0 },
    }));
  };

  const applyTickerInput = () => {
    const parsed = tickerInput
      .split(/[,\s]+/)
      .map(t => t.trim().toUpperCase())
      .filter(Boolean);
    setTickers(parsed);
  };

  const handlePaste = e => {
    const rows = e.clipboardData
      .getData('text')
      .trim()
      .split('\n')
      .map(r => r.split(/[,\t]/));
    rows.forEach(([acct, ticker, shares]) => {
      if (
        acct &&
        ticker &&
        ACCOUNT_TYPES.includes(acct.trim()) &&
        tickers.includes(ticker.trim().toUpperCase())
      ) {
        updateHolding(acct.trim(), ticker.trim().toUpperCase(), parseFloat(shares) || 0);
      }
    });
  };

  const exportTradesCSV = () => {
    const headers = ['Action', 'Ticker', 'Account', 'Shares', 'Amount', 'Drift'];
    const rows = trades.map(t => [
      t.action,
      t.ticker,
      t.account,
      t.shares,
      t.dollarAmount,
      t.drift,
    ]);
    navigator.clipboard.writeText([headers, ...rows].map(r => r.join(',')).join('\n'));
  };

  const exportState = () => {
    const state = {
      tickers,
      lookback,
      threshold,
      accounts,
      currentHoldings,
      prices,
      vols,
      targetWeights,
      targetAllocation,
      trades,
    };
    navigator.clipboard.writeText(JSON.stringify(state, null, 2));
  };

  const currentState = () => ({
    tickers,
    lookback,
    threshold,
    accounts,
    currentHoldings,
    retirement,
    selectedTemplateId,
    extraTemplateIds,
    comparisonMode,
    prefs,
  });

  const downloadPlan = () => {
    const url = URL.createObjectURL(
      new Blob([exportPlan(currentState(), scenarios)], { type: 'application/json' })
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `risk-parity-compass-plan-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setLastBackupAt(Date.now());
  };

  const importPlanText = text => {
    const { state, scenarios: imported } = importPlan(text); // throws on invalid input
    if (state.tickers) {
      setTickers(state.tickers);
      setTickerInput(state.tickers.join(', '));
    }
    if (state.lookback) setLookback(state.lookback);
    if (state.threshold) setThreshold(state.threshold);
    if (state.accounts) setAccounts(state.accounts);
    if (state.currentHoldings) setCurrentHoldings(state.currentHoldings);
    if (state.retirement) setRetirement(state.retirement);
    if (state.prefs) setPrefs(p => ({ ...p, ...state.prefs }));
    if (state.learning) setLearning(state.learning);
    if (imported.length) persistScenarios(imported);
  };

  const persistScenarios = ns => {
    setScenarios(ns);
    saveScenarios(ns);
  };

  const saveScenario = name => {
    persistScenarios([
      ...scenarios,
      {
        name,
        timestamp: Date.now(),
        tickers,
        lookback,
        threshold,
        accounts,
        currentHoldings,
      },
    ]);
    setScenarioName('');
  };

  const loadScenario = s => {
    setTickers(s.tickers);
    setTickerInput(s.tickers.join(', '));
    if (s.lookback) setLookback(s.lookback);
    if (s.threshold) setThreshold(s.threshold);
    if (s.accounts) setAccounts(s.accounts);
    if (s.currentHoldings) setCurrentHoldings(s.currentHoldings);
  };

  const deleteScenario = ts => {
    persistScenarios(scenarios.filter(s => s.timestamp !== ts));
  };

  // ─── STYLES ───────────────────────────────────────────────────────────────

  const S = {
    app: {
      minHeight: '100vh',
      background: '#0a0f1e',
      color: '#e2e8f0',
      fontFamily: "'Inter', 'system-ui', sans-serif",
      fontSize: 16,
    },
    header: {
      borderBottom: '1px solid #1e293b',
      padding: '18px 28px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      background: '#0d1424',
    },
    logo: {
      width: 32,
      height: 32,
      borderRadius: 8,
      background: 'linear-gradient(135deg, #1d4ed8, #0891b2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 16,
      flexShrink: 0,
    },
    title: { fontSize: 18, fontWeight: 600, color: '#f1f5f9', letterSpacing: '-0.01em' },
    subtitle: { fontSize: 13, color: '#94a3b8', marginTop: 1 },
    body: { display: 'flex', height: 'calc(100vh - 62px)' },
    sidebar: {
      width: 260,
      background: '#0d1424',
      borderRight: '1px solid #1e293b',
      padding: '20px 16px',
      overflowY: 'auto',
      flexShrink: 0,
    },
    main: { flex: 1, overflowY: 'auto', padding: '20px 24px' },
    label: {
      fontSize: 12,
      fontWeight: 600,
      color: '#94a3b8',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      marginBottom: 6,
      display: 'block',
    },
    input: {
      width: '100%',
      minHeight: 44,
      background: '#131d2e',
      border: '1px solid #1e293b',
      borderRadius: 6,
      color: '#e2e8f0',
      padding: '11px 12px',
      fontSize: 15,
      outline: 'none',
      boxSizing: 'border-box',
    },
    section: { marginBottom: 22 },
    sectionTitle: {
      fontSize: 13,
      fontWeight: 700,
      color: '#94a3b8',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      marginBottom: 12,
      paddingBottom: 6,
      borderBottom: '1px solid #1e293b',
    },
    btn: {
      width: '100%',
      minHeight: 44,
      padding: '12px 0',
      background: 'linear-gradient(135deg, #1d4ed8, #0891b2)',
      color: '#fff',
      border: 'none',
      borderRadius: 8,
      fontSize: 15,
      fontWeight: 600,
      cursor: 'pointer',
      letterSpacing: '0.02em',
    },
    btnDisabled: { opacity: 0.45, cursor: 'not-allowed', filter: 'grayscale(0.4)' },
    tabs: {
      display: 'flex',
      gap: 4,
      marginBottom: 20,
      borderBottom: '1px solid #1e293b',
      paddingBottom: 0,
    },
    tabBtn: active => ({
      minHeight: 44,
      padding: '12px 16px',
      background: 'none',
      border: 'none',
      borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
      color: active ? '#e2e8f0' : '#94a3b8',
      cursor: 'pointer',
      fontSize: 15,
      fontWeight: active ? 600 : 400,
      marginBottom: -1,
    }),
    card: {
      background: '#0d1424',
      border: '1px solid #1e293b',
      borderRadius: 10,
      padding: '16px 18px',
      marginBottom: 14,
    },
    cardTitle: {
      fontSize: 13,
      fontWeight: 700,
      color: '#94a3b8',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      marginBottom: 12,
    },
    pill: color => ({
      display: 'inline-block',
      padding: '4px 9px',
      borderRadius: 100,
      fontSize: 12,
      fontWeight: 600,
      background: color === 'buy' ? '#14532d' : color === 'sell' ? '#4c0519' : '#1e293b',
      color: color === 'buy' ? '#86efac' : color === 'sell' ? '#fca5a5' : '#94a3b8',
    }),
    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
    metricVal: { fontSize: 24, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.02em' },
    metricLbl: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
    warning: {
      background: '#1c1200',
      border: '1px solid #92400e',
      borderRadius: 8,
      padding: '10px 14px',
      color: '#fbbf24',
      fontSize: 13,
      marginBottom: 14,
    },
    error: {
      background: '#1a0808',
      border: '1px solid #7f1d1d',
      borderRadius: 8,
      padding: '12px 16px',
      color: '#fca5a5',
      fontSize: 14,
      marginBottom: 14,
    },
    tableWrap: { overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
    th: {
      padding: '10px 12px',
      textAlign: 'left',
      fontSize: 12,
      color: '#94a3b8',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      borderBottom: '1px solid #1e293b',
    },
    td: { padding: '12px 12px', borderBottom: '1px solid #0f172a', color: '#cbd5e1' },
    staleBanner: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      flexWrap: 'wrap',
      background: '#1c1200',
      border: '1px solid #92400e',
      borderRadius: 8,
      padding: '10px 14px',
      color: '#fbbf24',
      fontSize: 14,
      marginBottom: 14,
    },
    mobileAction: {
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 30,
      padding: '10px 16px',
      background: '#0d1424',
      borderTop: '1px solid #1e293b',
    },
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div
      style={{ ...S.app, zoom: prefs.fontScale }}
      className={prefs.highContrast ? 'sd-hc' : undefined}
    >
      <style>{`
        .sd-table th:first-child, .sd-table td:first-child { position: sticky; left: 0; background: #0d1424; z-index: 1; }
        button:focus-visible, a:focus-visible, [role="tab"]:focus-visible, select:focus-visible, textarea:focus-visible { outline: 2px solid #93c5fd; outline-offset: 2px; }
        .sd-tooltip-trigger:focus-visible { outline: 2px solid #93c5fd; outline-offset: 2px; }
        .sd-input:focus-visible { outline: 2px solid #93c5fd; outline-offset: 2px; }
        .sd-holdings-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(140px, 45%), 1fr)); gap: 10px; }
        @keyframes sd-fall { to { transform: translateY(110vh) rotate(720deg); opacity: 0; } }
        .sd-confetti { animation: sd-fall 1.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @media (max-width: 1023px) {
          .sd-sidebar { position: fixed; top: 68px; bottom: 0; left: 0; z-index: 40; width: 290px; transform: translateX(-100%); transition: transform .2s ease; box-shadow: 0 0 20px rgba(0,0,0,.4); }
          .sd-sidebar.open { transform: translateX(0); }
          .sd-backdrop { position: fixed; inset: 68px 0 0 0; background: rgba(0,0,0,.5); z-index: 39; }
        }
        @media (min-width: 1024px) { .sd-backdrop { display: none; } }
        /* ponytail: filter-based contrast; per-token palette if it falls short */
        .sd-hc { filter: contrast(1.3) brightness(1.1); }
        @media print {
          .sd-sidebar, .sd-backdrop, .sd-noprint, header, [role="tablist"], button, details { display: none !important; }
          .sd-hc { filter: none; }
          body, div, main, section { background: #fff !important; color: #000 !important; box-shadow: none !important; }
          main { padding: 0 !important; width: 100% !important; }
          div, main { height: auto !important; overflow: visible !important; }
          .sd-card, .sd-card * { border-color: #999 !important; }
          svg text { fill: #000 !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sd-confetti { animation: none; display: none; }
          .sd-sidebar { transition: none; }
        }
      `}</style>
      {/* HEADER */}
      <header style={S.header}>
        {isMobile && (
          <button
            aria-label="Toggle sidebar"
            onClick={() => setMobileOpen(v => !v)}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: 20,
              cursor: 'pointer',
              padding: '2px 6px',
              minHeight: 44,
              minWidth: 44,
            }}
          >
            ☰
          </button>
        )}
        <div style={S.logo}>⚖</div>
        <div>
          <h1 style={S.title}>
            <Tooltip tip="Shannon's Demon (the strategy): rebalance to harvest volatility, not to chase returns">
              Risk Parity Compass
            </Tooltip>
          </h1>
          <div style={{ ...S.subtitle, display: isMobile ? 'none' : 'block' }}>
            Risk parity rebalancing · retirement drawdown · tax-aware
          </div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 14, color: '#94a3b8', whiteSpace: 'nowrap' }}>
          Total: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{fmt.usd(totalValue)}</span>
        </div>
      </header>

      <div style={S.body}>
        {isMobile && mobileOpen && (
          <div className="sd-backdrop" onClick={() => setMobileOpen(false)} />
        )}
        {/* SIDEBAR */}
        <aside className={`sd-sidebar${mobileOpen ? ' open' : ''}`} style={S.sidebar}>
          {/* Tickers */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Assets</div>
            <label style={S.label} htmlFor="tickers-input">
              Tickers (comma-separated)
            </label>
            <textarea
              id="tickers-input"
              className="sd-input"
              style={{ ...S.input, height: 68, resize: 'vertical', fontFamily: 'monospace' }}
              value={tickerInput}
              onChange={e => setTickerInput(e.target.value)}
              onBlur={applyTickerInput}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  applyTickerInput();
                  lookbackRef.current?.focus();
                }
              }}
            />
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>
              {tickers.map(t => {
                const st = tickerStatus[t];
                const badge =
                  st === 'ok'
                    ? { c: '#16a34a', s: '✓' }
                    : st === 'error'
                      ? { c: '#f87171', s: '✗' }
                      : st === 'pending'
                        ? { c: '#94a3b8', s: '⏳' }
                        : null;
                return (
                  <span key={t} style={{ marginRight: 10 }}>
                    <span style={{ color: badge?.c ?? '#94a3b8' }}>{badge?.s ?? '·'}</span> {t}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Advanced (collapsible) */}
          <div style={S.section}>
            <button
              type="button"
              onClick={() => setShowAdvanced(v => !v)}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: 14,
                padding: '10px 0',
                minHeight: 44,
                fontWeight: 600,
              }}
              aria-expanded={showAdvanced}
            >
              {showAdvanced ? '▼' : '▶'} Advanced
            </button>
            {showAdvanced && (
              <div style={{ marginTop: 12 }}>
                <div style={S.sectionTitle}>Parameters</div>
                <label style={S.label} htmlFor="lookback-select">
                  Volatility lookback
                </label>
                <select
                  ref={lookbackRef}
                  id="lookback-select"
                  className="sd-input"
                  style={{ ...S.input, marginBottom: 10 }}
                  value={lookback}
                  onChange={e => setLookback(e.target.value)}
                >
                  {LOOKBACK_OPTIONS.map(o => (
                    <option key={o}>{o}</option>
                  ))}
                </select>

                <label style={S.label} htmlFor="threshold-range">
                  <Tooltip tip="Only trade when drift exceeds this % — captures volatility premium above costs">
                    Rebalance threshold
                  </Tooltip>
                  : {fmt.pct(threshold)}
                </label>
                <input
                  id="threshold-range"
                  type="range"
                  min={0.01}
                  max={0.2}
                  step={0.01}
                  value={threshold}
                  onChange={e => setThreshold(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#3b82f6', minHeight: 44 }}
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 13,
                    color: '#94a3b8',
                  }}
                >
                  <span>1% (active)</span>
                  <span>20% (lazy)</span>
                </div>
                {Object.keys(prices).length > 0 && (
                  <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 8 }}>
                    {estimatedTrades.length > 0
                      ? `~${estimatedTrades.length} trades if run now`
                      : 'No trades needed at current drift'}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Account Balances */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Account Balances</div>
            {ACCOUNT_TYPES.map(acct => (
              <div key={acct} style={{ marginBottom: 10 }}>
                <label style={S.label} htmlFor={`acct-${acct}`}>
                  {acct}
                </label>
                <input
                  id={`acct-${acct}`}
                  type="number"
                  min={0}
                  className="sd-input"
                  style={S.input}
                  value={accounts[acct] ?? ''}
                  onChange={e => updateAccount(acct, e.target.value)}
                />
              </div>
            ))}
          </div>

          {/* Run button */}
          <button
            style={{
              ...S.btn,
              ...(analysisState === 'loading' || !canRun ? S.btnDisabled : {}),
            }}
            onClick={runAnalysis}
            disabled={analysisState === 'loading' || !canRun}
          >
            {analysisState === 'loading' ? '⏳ Fetching data…' : '▶ Run Analysis'}
          </button>

          {analysisState === 'done' && (
            <div
              role="status"
              aria-live="polite"
              style={{ fontSize: 13, color: '#4ade80', textAlign: 'center', marginTop: 8 }}
            >
              ✓ Analysis complete
              {lastFetch && (
                <div style={{ color: '#94a3b8', marginTop: 2 }}>
                  Last prices: {new Date(lastFetch).toLocaleTimeString()} (
                  {Math.max(0, Math.round((Date.now() - new Date(lastFetch).getTime()) / 60000))}{' '}
                  min ago)
                </div>
              )}
            </div>
          )}

          {/* Scenarios */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Scenarios</div>
            <label style={S.label} htmlFor="scenario-name">
              Scenario name
            </label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                id="scenario-name"
                className="sd-input"
                style={{ ...S.input, flex: 1 }}
                placeholder="e.g. Retirement base case"
                value={scenarioName}
                onChange={e => setScenarioName(e.target.value)}
              />
              <button
                type="button"
                style={{
                  ...S.btn,
                  width: 'auto',
                  padding: '10px 14px',
                  ...(scenarioName.trim() ? {} : S.btnDisabled),
                }}
                onClick={() => saveScenario(scenarioName)}
                disabled={!scenarioName.trim()}
              >
                Save
              </button>
            </div>
            {scenarios.length === 0 && (
              <div style={{ fontSize: 13, color: '#94a3b8' }}>
                Save a snapshot of inputs to compare later.
              </div>
            )}
            {scenarios.map(s => (
              <div
                key={s.timestamp}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  padding: '8px 0',
                  borderBottom: '1px solid #0f172a',
                }}
              >
                <span style={{ color: '#cbd5e1' }}>
                  {s.name}
                  <span style={{ color: '#94a3b8', fontSize: 12, display: 'block' }}>
                    {new Date(s.timestamp).toLocaleDateString()}
                  </span>
                </span>
                <span style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#60a5fa',
                      cursor: 'pointer',
                      fontSize: 13,
                      minHeight: 44,
                      minWidth: 44,
                      padding: '6px 8px',
                      borderRadius: 6,
                    }}
                    onClick={() => loadScenario(s)}
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete scenario ${s.name}`}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#f87171',
                      cursor: 'pointer',
                      fontSize: 13,
                      minHeight: 44,
                      minWidth: 44,
                      padding: '6px 8px',
                      borderRadius: 6,
                    }}
                    onClick={() => deleteScenario(s.timestamp)}
                  >
                    ✕
                  </button>
                </span>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 20,
              padding: '10px 12px',
              background: '#0a0f1e',
              borderRadius: 8,
              fontSize: 13,
              color: '#94a3b8',
              lineHeight: 1.6,
            }}
          >
            ⚠ Uses Yahoo Finance unofficial API. Data is for planning only — not financial advice.
            Verify trades before executing.
            <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>
              v{__VERSION__} ·{' '}
              <a
                href={`https://github.com/paruff/risk-parity-compass/commit/${__COMMIT__}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#94a3b8' }}
              >
                {__COMMIT_SHORT__}
              </a>
            </div>
          </div>
          <PlanTools
            onExport={downloadPlan}
            onImport={importPlanText}
            backupDue={backupDue(lastBackupAt)}
            prefs={prefs}
            setPrefs={setPrefs}
          />
        </aside>

        {/* MAIN CONTENT */}
        <main style={isMobile ? { ...S.main, paddingBottom: 96 } : S.main}>
          {isStale && (
            <div style={S.staleBanner} role="status">
              <span>Inputs changed since the last analysis.</span>
              <button
                type="button"
                style={{ ...S.btn, width: 'auto', padding: '10px 16px' }}
                onClick={runAnalysis}
              >
                Recalculate
              </button>
            </div>
          )}
          {Object.keys(staleQuotes).length > 0 && (
            <div style={S.staleBanner} role="status" className="sd-noprint">
              <span>
                Live prices unavailable for {Object.keys(staleQuotes).join(', ')}; using cached data
                from {new Date(Math.min(...Object.values(staleQuotes))).toLocaleString()}. Override
                a price:
              </span>
              {Object.keys(staleQuotes).map(t => (
                <label key={t} style={{ fontSize: 13 }}>
                  {t}{' '}
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    aria-label={`Override price for ${t}`}
                    className="sd-input"
                    style={{ ...S.input, width: 90, display: 'inline-block' }}
                    value={priceOverrides[t] ?? ''}
                    onChange={e =>
                      setPriceOverrides(o => ({ ...o, [t]: parseFloat(e.target.value) || 0 }))
                    }
                  />
                </label>
              ))}
            </div>
          )}
          {lastFetch && (
            <div
              style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}
              data-testid="data-timestamp"
            >
              Price data as of {new Date(lastFetch).toLocaleString()}
            </div>
          )}
          <div style={S.tabs} role="tablist" aria-label="Portfolio views">
            {[
              { id: 'holdings', label: 'Current Holdings' },
              { id: 'analysis', label: 'Risk Parity Targets' },
              { id: 'trades', label: `Trades${trades.length > 0 ? ` (${trades.length})` : ''}` },
              { id: 'retirement', label: 'Retirement' },
              { id: 'portfolios', label: 'Portfolios' },
              {
                id: 'learn',
                label: `Learn${dueModules(learning).length > 0 ? ' (refresher due)' : ''}`,
              },
            ].map(t => (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                role="tab"
                type="button"
                aria-selected={tab === t.id}
                aria-controls={`panel-${t.id}`}
                tabIndex={tab === t.id ? 0 : -1}
                style={S.tabBtn(tab === t.id)}
                onClick={() => setTab(t.id)}
                onKeyDown={e => {
                  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                  const ids = ['holdings', 'analysis', 'trades', 'retirement', 'portfolios'];
                  const index = ids.indexOf(t.id);
                  const nextId =
                    ids[(index + (e.key === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length];
                  setTab(nextId);
                  document.getElementById(`tab-${nextId}`)?.focus();
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── HOLDINGS TAB ── */}
          {tab === 'holdings' && (
            <ErrorBoundary>
              <div role="tabpanel" id="panel-holdings" aria-labelledby="tab-holdings">
                <div style={S.warning}>
                  Enter your <strong>current share counts</strong> per account. These are compared
                  against risk parity targets to generate trades. Leave at 0 if you don't hold a
                  position.
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
                    <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>
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
                            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 3 }}>
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
                          <span style={{ color: '#94a3b8' }}>{t}</span>
                          <span>{fmt.usd(v)}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 10, color: '#94a3b8', fontSize: 13 }}>
                      Total tracked:{' '}
                      <strong style={{ color: '#e2e8f0' }}>
                        {fmt.usd(currentTotalFromPrices)}
                      </strong>{' '}
                      vs account total:{' '}
                      <strong style={{ color: '#e2e8f0' }}>{fmt.usd(totalValue)}</strong>
                    </div>
                  </div>
                )}
              </div>
            </ErrorBoundary>
          )}

          {/* ── ANALYSIS TAB ── */}
          {tab === 'analysis' && (
            <ErrorBoundary>
              <div role="tabpanel" id="panel-analysis" aria-labelledby="tab-analysis">
                {analysisState === 'idle' && (
                  <div style={{ color: '#94a3b8', textAlign: 'center', marginTop: 60 }}>
                    Enter your holdings and click{' '}
                    <strong style={{ color: '#94a3b8' }}>Run Analysis</strong> to see risk parity
                    targets.
                  </div>
                )}

                {analysisState === 'error' && (
                  <div style={S.error}>
                    <strong>Error fetching market data:</strong> {errorMsg}
                    {failedTicker && (
                      <div style={{ marginTop: 8, color: '#94a3b8' }}>
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
                              background: '#131d2e',
                              border: '1px solid #1e293b',
                              color: '#93c5fd',
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
                    <div style={{ marginTop: 6, color: '#f87171' }}>
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
                      <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>
                        <span
                          style={{
                            background: '#16a34a',
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
                            background: '#dc2626',
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
                          const curW =
                            totalValue > 0 ? (currentValueByTicker[t] ?? 0) / totalValue : 0;
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
                              const curW =
                                totalValue > 0 ? (currentValueByTicker[t] ?? 0) / totalValue : 0;
                              const drift = curW - tgtW;
                              return (
                                <tr key={t}>
                                  <td
                                    style={{
                                      ...S.td,
                                      fontWeight: 600,
                                      color: '#e2e8f0',
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
                                      color: Math.abs(drift) > threshold ? '#f87171' : '#94a3b8',
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
                      <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>
                        Tax-inefficient assets (bonds, commodities, REITs) are placed in
                        tax-advantaged accounts first. Tax score: 8–10 means hold in an IRA, 5–7 is
                        neutral, 1–4 is tax-efficient. Scores are heuristics — verify with a tax
                        advisor.
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
                                    color: '#e2e8f0',
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
                                      <span style={{ color: '#94a3b8' }}>—</span>
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
                              style={{ fontFamily: 'monospace', fontSize: 13, color: '#94a3b8' }}
                            >
                              {t}
                            </div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0' }}>
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
          )}

          {/* ── TRADES TAB ── */}
          {tab === 'trades' && (
            <ErrorBoundary>
              <div role="tabpanel" id="panel-trades" aria-labelledby="tab-trades">
                {analysisState !== 'done' && (
                  <div style={{ color: '#94a3b8', textAlign: 'center', marginTop: 60 }}>
                    Run Analysis first to generate trades.
                  </div>
                )}

                {analysisState === 'done' && trades.length === 0 && (
                  <div style={{ ...S.card, textAlign: 'center', padding: '32px 20px' }}>
                    <div style={{ fontSize: 28, marginBottom: 10 }}>✓</div>
                    <div style={{ color: '#94a3b8', fontSize: 15 }}>
                      All positions are within the{' '}
                      <strong style={{ color: '#94a3b8' }}>{fmt.pct(threshold)}</strong> rebalance
                      band. No trades needed.
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 8 }}>
                      Shannon's Demon: Only rebalance when drift captures a meaningful volatility
                      premium above transaction costs.
                    </div>
                    <Confetti />
                  </div>
                )}

                {analysisState === 'done' && trades.length > 0 && (
                  <>
                    <div style={S.warning}>
                      These trades move your portfolio toward risk parity targets within
                      tax-efficient accounts.{' '}
                      <strong>Verify share counts and prices before executing.</strong> Consider tax
                      impact of sells in taxable accounts.
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
                          color: '#94a3b8',
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
                                    color: '#e2e8f0',
                                  }}
                                >
                                  {tr.ticker}
                                </td>
                                <td style={{ ...S.td, color: '#94a3b8' }}>{tr.account}</td>
                                <td style={S.td}>{fmt.shares(tr.shares)}</td>
                                <td style={S.td}>{fmt.usd(tr.dollarAmount)}</td>
                                <td style={S.td}>{fmt.pct(tr.currentWeight)}</td>
                                <td style={{ ...S.td, color: '#93c5fd' }}>
                                  {fmt.pct(tr.targetWeight)}
                                </td>
                                <td style={{ ...S.td, color: '#f87171' }}>{fmt.pct(tr.drift)}</td>
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
                                <span style={{ color: '#94a3b8' }}>
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
          )}

          {/* ── RETIREMENT TAB ── */}
          {tab === 'retirement' && (
            <ErrorBoundary>
              <div role="tabpanel" id="panel-retirement" aria-labelledby="tab-retirement">
                {analysisState !== 'done' ? (
                  <div style={{ color: '#94a3b8', textAlign: 'center', marginTop: 60 }}>
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
                            onChange={e =>
                              setRetirement(r => ({ ...r, guardrail: e.target.value }))
                            }
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
                            onChange={e =>
                              setRetirement(r => ({ ...r, driftMode: e.target.value }))
                            }
                          >
                            <option value="historical">Historical Mean</option>
                            <option value="zero">Zero (Conservative)</option>
                          </select>
                        </div>
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
                            <div
                              className="sd-metricVal"
                              style={S.metricVal}
                              data-testid="metric-swr"
                            >
                              {retirementResults.withheld
                                ? '—'
                                : `${(retirementResults.swr * 100).toFixed(2)}%`}
                            </div>
                            <div style={S.metricLbl}>Safe Withdrawal Rate (SWR)</div>
                          </div>
                          <div className="sd-card" style={S.card}>
                            <div
                              className="sd-metricVal"
                              style={S.metricVal}
                              data-testid="metric-pwr"
                            >
                              {retirementResults.withheld
                                ? '—'
                                : `${(retirementResults.pwr * 100).toFixed(2)}%`}
                            </div>
                            <div style={S.metricLbl}>Perpetual Withdrawal Rate (PWR)</div>
                          </div>
                          <div className="sd-card" style={S.card}>
                            <div
                              className="sd-metricVal"
                              style={S.metricVal}
                              data-testid="metric-success"
                            >
                              {retirementResults.withheld
                                ? '—'
                                : `${(retirementResults.successRate * 100).toFixed(1)}%`}
                            </div>
                            <div style={S.metricLbl}>Success Probability</div>
                          </div>
                          <div className="sd-card" style={S.card}>
                            <div
                              className="sd-metricVal"
                              style={S.metricVal}
                              data-testid="metric-maxdd"
                            >
                              {(retirementResults.maxDrawdown * 100).toFixed(1)}%
                            </div>
                            <div style={S.metricLbl}>Max Drawdown</div>
                          </div>
                          <div className="sd-card" style={S.card}>
                            <div
                              className="sd-metricVal"
                              style={S.metricVal}
                              data-testid="metric-horizon"
                            >
                              {retirementResults.effectiveYears?.toFixed(1) ?? '—'} yr
                            </div>
                            <div style={S.metricLbl}>
                              Effective Horizon
                              {retirementResults.limitedBy
                                ? ` (limited by ${retirementResults.limitedBy})`
                                : ''}
                            </div>
                          </div>
                          {retirementResults.bridgeYears != null &&
                            retirementResults.bridgeYears > 0 && (
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
                            color: '#94a3b8',
                            marginBottom: 14,
                            padding: '8px 12px',
                            background: '#131d2e',
                            borderRadius: 6,
                          }}
                        >
                          Planning estimates only — not financial, tax, or legal advice. Historical
                          and simulated results do not guarantee future outcomes. Verify RMDs and
                          tax figures with a qualified advisor.
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
                            <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 8 }}>
                              Both runs use the same simulated markets (seed 42); only the spending
                              rule differs. Guardrails are models, not guarantees.
                            </div>
                          </div>
                        )}

                        {/* Monte Carlo Fan Chart */}
                        <div style={S.card}>
                          <div style={S.cardTitle}>Monte Carlo Fan Chart (P10–P90)</div>
                          <p data-testid="mc-method" style={{ color: '#94a3b8', fontSize: 12 }}>
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
                            <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 8 }}>
                              Table: {RMD_TABLE_VERSION}
                            </span>
                          </div>
                          <div style={S.tableWrap}>
                            <table className="sd-table" style={S.table}>
                              <thead>
                                <tr>
                                  <th style={S.th}>Age</th>
                                  <th style={S.th}>Distribution Period</th>
                                  {ACCOUNT_TYPES.filter(
                                    a => a.includes('IRA') || a.includes('401k')
                                  ).map(a => (
                                    <th key={a} style={S.th}>
                                      {a} RMD
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {[
                                  73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88,
                                  89, 90,
                                ].map(age => (
                                  <tr key={age}>
                                    <td style={S.th}>{age}</td>
                                    <td style={S.td}>
                                      {requiredMinimumDistribution(age, 1000000, {
                                        birthYear: retirement.birthYear,
                                      }).distributionPeriod ?? '—'}
                                    </td>
                                    {ACCOUNT_TYPES.filter(
                                      a => a.includes('IRA') || a.includes('401k')
                                    ).map(a => (
                                      <td key={a} style={S.td}>
                                        {accounts[a]
                                          ? fmt.usd(
                                              requiredMinimumDistribution(age, accounts[a], {
                                                birthYear: retirement.birthYear,
                                              }).rmd
                                            )
                                          : '—'}
                                      </td>
                                    ))}
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
                                  const seq = withdrawalSequence(
                                    accounts,
                                    retirement.monthlySpend,
                                    {
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
                                    }
                                  );
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
                                    <td style={S.td}>
                                      {row.roth > 0 ? fmt.usd(row.roth * 12) : '—'}
                                    </td>
                                    <td style={S.td}>
                                      {fmt.usd((row.taxable + row.traditional + row.roth) * 12)}
                                    </td>
                                  </tr>
                                ))}
                                <tr>
                                  <td style={S.th}>Yearly Total</td>
                                  <td style={S.td}>
                                    {(() => {
                                      const seq = withdrawalSequence(
                                        accounts,
                                        retirement.monthlySpend,
                                        {
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
                                        }
                                      );
                                      return fmt.usd(seq.byAccount.Taxable * 12);
                                    })()}
                                  </td>
                                  <td style={S.td}>
                                    {(() => {
                                      const seq = withdrawalSequence(
                                        accounts,
                                        retirement.monthlySpend,
                                        {
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
                                        }
                                      );
                                      return fmt.usd(seq.byAccount['Traditional IRA / 401k'] * 12);
                                    })()}
                                  </td>
                                  <td style={S.td}>
                                    {(() => {
                                      const seq = withdrawalSequence(
                                        accounts,
                                        retirement.monthlySpend,
                                        {
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
                                        }
                                      );
                                      return fmt.usd(seq.byAccount['Roth IRA'] * 12);
                                    })()}
                                  </td>
                                  <td style={S.td}>
                                    {(() => {
                                      const seq = withdrawalSequence(
                                        accounts,
                                        retirement.monthlySpend,
                                        {
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
                                        }
                                      );
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
          )}

          {tab === 'learn' && (
            <ErrorBoundary>
              <div role="tabpanel" id="panel-learn" aria-labelledby="tab-learn">
                <LearnTab S={S} learning={learning} setLearning={setLearning} />
              </div>
            </ErrorBoundary>
          )}

          {tab === 'portfolios' && (
            <ErrorBoundary>
              <div role="tabpanel" id="panel-portfolios" aria-labelledby="tab-portfolios">
                <PortfoliosTab
                  S={S}
                  analysisState={analysisState}
                  targetWeights={targetWeights}
                  totalValue={totalValue}
                  retirement={retirement}
                  selectedTemplateId={selectedTemplateId}
                  setSelectedTemplateId={setSelectedTemplateId}
                  extraTemplateIds={extraTemplateIds}
                  setExtraTemplateIds={setExtraTemplateIds}
                  comparisonMode={comparisonMode}
                  setComparisonMode={setComparisonMode}
                  onLoadTemplate={loadTemplate}
                />
              </div>
            </ErrorBoundary>
          )}

          {isMobile && (
            <div style={S.mobileAction}>
              <button
                type="button"
                style={{
                  ...S.btn,
                  ...(analysisState === 'loading' || !canRun ? S.btnDisabled : {}),
                }}
                onClick={runAnalysis}
                disabled={analysisState === 'loading' || !canRun}
              >
                {analysisState === 'loading' ? '⏳ Fetching data…' : '▶ Run Analysis'}
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
