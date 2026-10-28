import ErrorBoundary from './components/ErrorBoundary';
import { proxyReturns, rollingLongRun } from './utils/longRun';
import Tooltip from './components/Tooltip';

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
  ACCOUNT_TYPES,
  LOOKBACK_OPTIONS,
  fetchQuote,
  fetchMonthlyHistory,
  computeOverlap,
  annualizedVol,
  ercWeights,
  taxLocationWaterfall,
  generateTrades,
  correlationMatrix,
  riskContribution,
  simulatePerformance,
  fmt,
} from './utils/finance';
import {
  drawdownPath,
  rollingWithdrawalRates,
  monteCarloWithWithdrawals,
  requiredMinimumDistribution,
} from './utils/withdrawal';
import { buildPortfolioPath } from './utils/portfolioPath';
import { getTemplate } from './utils/portfolios';
import PortfoliosTab from './PortfoliosTab';
import LearnTab from './LearnTab';
import { dueModules } from './utils/learning';
import PlanTools from './components/PlanTools';
import RetirementTab from './tabs/RetirementTab';
import TradesTab from './tabs/TradesTab';
import AnalysisTab from './tabs/AnalysisTab';
import HoldingsTab from './tabs/HoldingsTab';
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
import { C } from './tokens';

const DEFAULT_TICKERS = ['SPY', 'TLT', 'GLD', 'VNQ', 'EEM'];

const DEFAULT_ACCOUNTS = {
  Taxable: 50000,
  'Traditional IRA / 401k': 30000,
  'Roth IRA': 20000,
};

// ─── FORMATTING HELPERS ───────────────────────────────────────────────────────

// ─── MINI BAR CHART ───────────────────────────────────────────────────────────

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
    sequenceStrategy: 'taxable-first',
    rothConversionAnnual: 0,
    expectedReturn: null,
    birthYear: 1960,
    socialSecurityStartAge: 67,
    pensionStartAge: 65,
  });
  // Draw-order options shared by every withdrawal-sequencing call in the Retirement tab.
  const seqExtra = () => ({
    strategy: retirement.sequenceStrategy,
    rothConversionMonthly: (retirement.rothConversionAnnual ?? 0) / 12,
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
      // Prefer the 1928-2025 index-proxy history when every holding has one.
      const rolling =
        rollingLongRun(targetWeights, totalValue, {
          horizonYears: retirement.horizonYears,
          inflationRate: retirement.inflationRate,
          annualSpend: netMonthlySpend * 12,
        }) ??
        rollingWithdrawalRates(portfolioValues, {
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
      background: C.background,
      color: C.onSurface,
      fontFamily: "'Inter', 'system-ui', sans-serif",
      fontSize: 16,
    },
    header: {
      borderBottom: '1px solid #1e293b',
      padding: '18px 28px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      background: C.surface,
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
    title: { fontSize: 18, fontWeight: 600, color: C.onSurfaceStrong, letterSpacing: '-0.01em' },
    subtitle: { fontSize: 13, color: C.onSurfaceMuted, marginTop: 1 },
    body: { display: 'flex', height: 'calc(100vh - 62px)' },
    sidebar: {
      width: 260,
      background: C.surface,
      borderRight: '1px solid #1e293b',
      padding: '20px 16px',
      overflowY: 'auto',
      flexShrink: 0,
    },
    main: { flex: 1, overflowY: 'auto', padding: '20px 24px' },
    label: {
      fontSize: 12,
      fontWeight: 600,
      color: C.onSurfaceMuted,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      marginBottom: 6,
      display: 'block',
    },
    input: {
      width: '100%',
      minHeight: 44,
      background: C.surfaceInput,
      border: '1px solid #1e293b',
      borderRadius: 6,
      color: C.onSurface,
      padding: '11px 12px',
      fontSize: 15,
      outline: 'none',
      boxSizing: 'border-box',
    },
    section: { marginBottom: 22 },
    sectionTitle: {
      fontSize: 13,
      fontWeight: 700,
      color: C.onSurfaceMuted,
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
      color: active ? C.onSurface : C.onSurfaceMuted,
      cursor: 'pointer',
      fontSize: 15,
      fontWeight: active ? 600 : 400,
      marginBottom: -1,
    }),
    card: {
      background: C.surface,
      border: '1px solid #1e293b',
      borderRadius: 10,
      padding: '16px 18px',
      marginBottom: 14,
    },
    cardTitle: {
      fontSize: 13,
      fontWeight: 700,
      color: C.onSurfaceMuted,
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
      background:
        color === 'buy' ? C.positiveSurface : color === 'sell' ? C.negativeSurface : C.border,
      color: color === 'buy' ? C.onPositive : color === 'sell' ? C.onNegative : C.onSurfaceMuted,
    }),
    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
    metricVal: {
      fontSize: 24,
      fontWeight: 700,
      color: C.onSurfaceStrong,
      letterSpacing: '-0.02em',
    },
    metricLbl: { fontSize: 12, color: C.onSurfaceMuted, marginTop: 2 },
    warning: {
      background: C.warningSurface,
      border: '1px solid #92400e',
      borderRadius: 8,
      padding: '10px 14px',
      color: C.warning,
      fontSize: 13,
      marginBottom: 14,
    },
    error: {
      background: C.errorSurface,
      border: '1px solid #7f1d1d',
      borderRadius: 8,
      padding: '12px 16px',
      color: C.onNegative,
      fontSize: 14,
      marginBottom: 14,
    },
    tableWrap: { overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
    th: {
      padding: '10px 12px',
      textAlign: 'left',
      fontSize: 12,
      color: C.onSurfaceMuted,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      borderBottom: '1px solid #1e293b',
    },
    td: { padding: '12px 12px', borderBottom: '1px solid #0f172a', color: C.onSurfaceSecondary },
    staleBanner: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      flexWrap: 'wrap',
      background: C.warningSurface,
      border: '1px solid #92400e',
      borderRadius: 8,
      padding: '10px 14px',
      color: C.warning,
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
      background: C.surface,
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
              color: C.onSurfaceMuted,
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
        <div
          style={{
            marginLeft: 'auto',
            fontSize: 14,
            color: C.onSurfaceMuted,
            whiteSpace: 'nowrap',
          }}
        >
          Total: <span style={{ color: C.onSurface, fontWeight: 600 }}>{fmt.usd(totalValue)}</span>
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
            <div style={{ fontSize: 13, color: C.onSurfaceMuted, marginTop: 6 }}>
              {tickers.map(t => {
                const st = tickerStatus[t];
                const badge =
                  st === 'ok'
                    ? { c: C.positive, s: '✓' }
                    : st === 'error'
                      ? { c: C.negativeText, s: '✗' }
                      : st === 'pending'
                        ? { c: C.onSurfaceMuted, s: '⏳' }
                        : null;
                return (
                  <span key={t} style={{ marginRight: 10 }}>
                    <span style={{ color: badge?.c ?? C.onSurfaceMuted }}>{badge?.s ?? '·'}</span>{' '}
                    {t}
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
                color: C.onSurfaceMuted,
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
                  style={{ width: '100%', accentColor: C.primary, minHeight: 44 }}
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 13,
                    color: C.onSurfaceMuted,
                  }}
                >
                  <span>1% (active)</span>
                  <span>20% (lazy)</span>
                </div>
                {Object.keys(prices).length > 0 && (
                  <div style={{ fontSize: 13, color: C.onSurfaceMuted, marginTop: 8 }}>
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
              style={{ fontSize: 13, color: C.positiveText, textAlign: 'center', marginTop: 8 }}
            >
              ✓ Analysis complete
              {lastFetch && (
                <div style={{ color: C.onSurfaceMuted, marginTop: 2 }}>
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
              <div style={{ fontSize: 13, color: C.onSurfaceMuted }}>
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
                <span style={{ color: C.onSurfaceSecondary }}>
                  {s.name}
                  <span style={{ color: C.onSurfaceMuted, fontSize: 12, display: 'block' }}>
                    {new Date(s.timestamp).toLocaleDateString()}
                  </span>
                </span>
                <span style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: C.accent,
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
                      color: C.negativeText,
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
              background: C.background,
              borderRadius: 8,
              fontSize: 13,
              color: C.onSurfaceMuted,
              lineHeight: 1.6,
            }}
          >
            ⚠ Uses Yahoo Finance unofficial API. Data is for planning only — not financial advice.
            Verify trades before executing.
            <div style={{ marginTop: 8, fontSize: 12, color: C.onSurfaceMuted }}>
              v{__VERSION__} ·{' '}
              <a
                href={`https://github.com/paruff/risk-parity-compass/commit/${__COMMIT__}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: C.onSurfaceMuted }}
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
              style={{ fontSize: 12, color: C.onSurfaceMuted, marginBottom: 8 }}
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
            <HoldingsTab
              S={S}
              accounts={accounts}
              currentHoldings={currentHoldings}
              currentTotalFromPrices={currentTotalFromPrices}
              currentValueByTicker={currentValueByTicker}
              handlePaste={handlePaste}
              prices={prices}
              tickers={tickers}
              totalValue={totalValue}
              updateHolding={updateHolding}
            />
          )}

          {/* ── ANALYSIS TAB ── */}
          {tab === 'analysis' && (
            <AnalysisTab
              S={S}
              analysisState={analysisState}
              corrMatrix={corrMatrix}
              currentValueByTicker={currentValueByTicker}
              errorMsg={errorMsg}
              failedTicker={failedTicker}
              perfData={perfData}
              prices={prices}
              retryCountdown={retryCountdown}
              riskContrib={riskContrib}
              runAnalysis={runAnalysis}
              setRetryCountdown={setRetryCountdown}
              setTickerInput={setTickerInput}
              setTickers={setTickers}
              targetAllocation={targetAllocation}
              targetWeights={targetWeights}
              threshold={threshold}
              tickers={tickers}
              totalValue={totalValue}
              trades={trades}
              vols={vols}
            />
          )}

          {/* ── TRADES TAB ── */}
          {tab === 'trades' && (
            <TradesTab
              S={S}
              analysisState={analysisState}
              exportState={exportState}
              exportTradesCSV={exportTradesCSV}
              threshold={threshold}
              trades={trades}
            />
          )}

          {/* ── RETIREMENT TAB ── */}
          {tab === 'retirement' && (
            <RetirementTab
              S={S}
              accounts={accounts}
              analysisState={analysisState}
              calculateRetirement={calculateRetirement}
              retirement={retirement}
              retirementCalculating={retirementCalculating}
              retirementResults={retirementResults}
              seqExtra={seqExtra}
              setRetirement={setRetirement}
            />
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
