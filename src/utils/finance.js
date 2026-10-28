import { loadSnapshot } from './priceSnapshot.js';

// ─── FINANCE HELPERS ────────────────────────────────────────────────────────

const TAX_INEFFICIENCY = {
  // Bonds – interest taxed as ordinary income
  TLT: 10,
  IEF: 10,
  BND: 10,
  AGG: 10,
  VGIT: 10,
  VCIT: 10,
  LQD: 10,
  TIP: 9,
  // REITs – non-qualified dividends
  VNQ: 9,
  SCHH: 9,
  IYR: 9,
  // Commodities – collectibles rate or K-1
  GLD: 8,
  IAU: 8,
  DBC: 8,
  PDBC: 8,
  SLV: 8,
  // International – foreign tax credit offsets some drag; keep in taxable if needed
  EEM: 4,
  VEA: 4,
  VXUS: 4,
  // Broad equity – qualified divs, LT cap gains
  SPY: 2,
  VTI: 2,
  QQQ: 2,
  VOO: 2,
  IVV: 2,
  VIG: 3,
};

const ACCOUNT_TYPES = ['Taxable', 'Traditional IRA / 401k', 'Roth IRA'];
const LOOKBACK_OPTIONS = ['3mo', '6mo', '1y', '2y'];

// Common liquid ETFs for "did you mean" suggestions on bad tickers.
const COMMON_ETFS = [
  'SPY',
  'VOO',
  'IVV',
  'VTI',
  'QQQ',
  'IWM',
  'EEM',
  'AGG',
  'TLT',
  'BND',
  'GLD',
  'SLV',
  'VNQ',
  'VEA',
  'VWO',
  'DIA',
  'IEFA',
  'IJR',
  'XLK',
  'XLE',
];

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

// Closest candidate symbols to a (possibly mistyped) ticker.
function closestTickers(ticker, candidates = COMMON_ETFS, limit = 3) {
  return candidates
    .map(c => ({ c, d: levenshtein(ticker.toUpperCase(), c) }))
    .sort((x, y) => x.d - y.d || x.c.localeCompare(y.c))
    .slice(0, limit)
    .map(x => x.c);
}
// ─── FINANCE HELPERS ──────────────────────────────────────────────────────────

// Prices come from the bundled snapshot (see priceSnapshot.js); there is no live network call.
const LOOKBACK_POINTS = { '3mo': 63, '6mo': 126, '1y': 252, '2y': 504 };

async function fetchQuote(ticker, period = '1y') {
  const snap = await loadSnapshot(ticker);
  const closes = (snap.daily ?? []).slice(-(LOOKBACK_POINTS[period] ?? LOOKBACK_POINTS['1y']));
  if (closes.length < 10) throw new Error(`Insufficient history for ${ticker}`);
  return {
    ticker: String(ticker).trim().toUpperCase(),
    closes,
    latestPrice: closes[closes.length - 1],
    asOf: snap.asOf,
  };
}

function annualizedVol(closes) {
  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push(Math.log(closes[i] / closes[i - 1]));
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
  return Math.sqrt(variance * 252); // annualize
}

function inverseVolWeights(vols) {
  const invVols = {};
  let total = 0;
  for (const [t, v] of Object.entries(vols)) {
    const inv = 1 / Math.max(v, 0.001);
    invVols[t] = inv;
    total += inv;
  }
  const weights = {};
  for (const [t, inv] of Object.entries(invVols)) {
    weights[t] = inv / total;
  }
  return weights;
}

// Equal-risk-contribution weights: every asset contributes the same share of
// portfolio variance. Long-only fixed point w_i <- w_i * sqrt(target / rc_i),
// started from inverse-vol (which is exact when all correlations are equal).
// ponytail: plain damped iteration, switch to Newton if a large universe is slow.
function ercWeights(vols, corrMatrix) {
  const tickers = Object.keys(vols);
  const n = tickers.length;
  if (n === 0) return {};
  const sig = tickers.map(t => Math.max(vols[t], 0.001));
  const cov = sig.map((si, i) =>
    sig.map((sj, j) => (i === j ? 1 : (corrMatrix?.[tickers[i]]?.[tickers[j]] ?? 0)) * si * sj)
  );
  let w = sig.map(s => 1 / s);
  const norm = () => {
    const tot = w.reduce((a, b) => a + b, 0);
    w = w.map(x => x / tot);
  };
  norm();
  for (let iter = 0; iter < 20000; iter++) {
    const rc = w.map((wi, i) => wi * cov[i].reduce((a, c, j) => a + c * w[j], 0));
    const tot = rc.reduce((a, b) => a + b, 0);
    if (!(tot > 0)) break;
    const dev = Math.max(...rc.map(r => Math.abs(r / tot - 1 / n)));
    if (dev < 1e-10) break;
    w = w.map((wi, i) => wi * Math.sqrt(tot / n / rc[i]));
    norm();
  }
  return Object.fromEntries(tickers.map((t, i) => [t, w[i]]));
}

// ─── TAX LOCATION WATERFALL ───────────────────────────────────────────────────

// Returns: { "Roth IRA": { SPY: $amount, ... }, ... }
function taxLocationWaterfall(targetWeights, prices, accounts, totalValue) {
  // Sort assets by tax inefficiency descending (put worst in best shelter first)
  const sorted = Object.keys(targetWeights).sort((a, b) => {
    return (TAX_INEFFICIENCY[b] ?? 5) - (TAX_INEFFICIENCY[a] ?? 5);
  });

  // Account priority: Roth = 1 (best), Trad = 2, Taxable = 3
  const accountPriority = name => {
    if (name.includes('Roth')) return 1;
    if (name.includes('IRA') || name.includes('401k')) return 2;
    return 3;
  };

  const sortedAccounts = Object.entries(accounts)
    .sort(([a], [b]) => accountPriority(a) - accountPriority(b))
    .map(([name, bal]) => ({ name, remaining: bal, holdings: {} }));

  for (const ticker of sorted) {
    let needed = targetWeights[ticker] * totalValue;
    for (const acc of sortedAccounts) {
      if (needed <= 0) break;
      if (acc.remaining <= 0) continue;
      const place = Math.min(needed, acc.remaining);
      acc.holdings[ticker] = (acc.holdings[ticker] ?? 0) + place;
      acc.remaining -= place;
      needed -= place;
    }
  }

  const result = {};
  for (const acc of sortedAccounts) {
    result[acc.name] = acc.holdings;
  }
  return result;
}

// ─── TRADE GENERATION ─────────────────────────────────────────────────────────

// currentHoldings: { "Taxable": { SPY: shares }, ... }
// targetAllocation: { "Taxable": { SPY: $amount }, ... }
// prices: { SPY: 450.23, ... }
// threshold: 0.05 (5%)
function generateTrades(currentHoldings, targetAllocation, prices, totalValue, threshold) {
  const trades = [];

  // Compute current $ values per account per ticker
  const currentValues = {};
  for (const [acct, holdings] of Object.entries(currentHoldings)) {
    currentValues[acct] = {};
    for (const [ticker, shares] of Object.entries(holdings)) {
      currentValues[acct][ticker] = shares * (prices[ticker] ?? 0);
    }
  }

  // Aggregate current total per ticker across all accounts
  const currentTotalByTicker = {};
  for (const holdings of Object.values(currentValues)) {
    for (const [ticker, val] of Object.entries(holdings)) {
      currentTotalByTicker[ticker] = (currentTotalByTicker[ticker] ?? 0) + val;
    }
  }

  // Aggregate target total per ticker
  const targetTotalByTicker = {};
  for (const holdings of Object.values(targetAllocation)) {
    for (const [ticker, val] of Object.entries(holdings)) {
      targetTotalByTicker[ticker] = (targetTotalByTicker[ticker] ?? 0) + val;
    }
  }

  // All tickers
  const allTickers = new Set([
    ...Object.keys(currentTotalByTicker),
    ...Object.keys(targetTotalByTicker),
  ]);

  for (const ticker of allTickers) {
    const currentVal = currentTotalByTicker[ticker] ?? 0;
    const targetVal = targetTotalByTicker[ticker] ?? 0;
    const currentWeight = totalValue > 0 ? currentVal / totalValue : 0;
    const targetWeight = targetVal / totalValue;
    const drift = Math.abs(currentWeight - targetWeight);

    if (drift > threshold) {
      const deltaVal = targetVal - currentVal;
      const price = prices[ticker];
      if (!price) continue;
      const shares = Math.abs(deltaVal / price);

      // Find which account to execute trade in (prefer tax-advantaged for sells to avoid cap gains)
      // Simple heuristic: trade in the account where the target says it belongs
      let tradeAccount =
        Object.keys(targetAllocation).find(acc => (targetAllocation[acc][ticker] ?? 0) > 0) ??
        Object.keys(targetAllocation)[0];

      trades.push({
        ticker,
        action: deltaVal > 0 ? 'BUY' : 'SELL',
        shares: parseFloat(shares.toFixed(2)),
        dollarAmount: Math.abs(deltaVal),
        currentWeight,
        targetWeight,
        drift,
        account: tradeAccount,
        price,
      });
    }
  }

  return trades.sort((a, b) => b.drift - a.drift);
}

// ─── CORRELATION ─────────────────────────────────────────────────────────────

// Pearson correlation between two return series.
function correlation(returnsA, returnsB) {
  const n = Math.min(returnsA.length, returnsB.length);
  if (n < 3) return 0;
  const a = returnsA.slice(-n);
  const b = returnsB.slice(-n);
  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;
  let cov = 0,
    varA = 0,
    varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  const denom = Math.sqrt(varA * varB);
  return denom === 0 ? 0 : cov / denom;
}

// Convert closes array to daily log returns.
function dailyReturns(closes) {
  const r = [];
  for (let i = 1; i < closes.length; i++) {
    r.push(Math.log(closes[i] / closes[i - 1]));
  }
  return r;
}

// Pairwise correlation matrix from { ticker: closes[] }.
function correlationMatrix(allCloses) {
  const tickers = Object.keys(allCloses);
  const returns = {};
  for (const t of tickers) {
    returns[t] = dailyReturns(allCloses[t]);
  }
  const matrix = {};
  for (const a of tickers) {
    matrix[a] = {};
    for (const b of tickers) {
      matrix[a][b] = a === b ? 1 : correlation(returns[a], returns[b]);
    }
  }
  return matrix;
}

// ─── RISK CONTRIBUTION ──────────────────────────────────────────────────────

// Risk contribution of each asset in a portfolio.
// weights: { ticker: weight }, vols: { ticker: annualizedVol }, corrMatrix: correlationMatrix output
// Returns: { ticker: riskContributionPct } (sums to ~1.0)
function riskContribution(weights, vols, corrMatrix) {
  const tickers = Object.keys(weights);
  const n = tickers.length;
  if (n === 0) return {};

  // Build covariance matrix: Cov(i,j) = ρ(i,j) × σ(i) × σ(j)
  const cov = [];
  for (let i = 0; i < n; i++) {
    cov[i] = [];
    for (let j = 0; j < n; j++) {
      const rho = corrMatrix[tickers[i]]?.[tickers[j]] ?? (i === j ? 1 : 0);
      cov[i][j] = rho * (vols[tickers[i]] ?? 0) * (vols[tickers[j]] ?? 0);
    }
  }

  // Marginal risk contribution: MRC_i = (Cov × w)_i / σ_p
  // Risk contribution: RC_i = w_i × MRC_i
  const rc = {};
  let totalRC = 0;
  for (let i = 0; i < n; i++) {
    let mrc = 0;
    for (let j = 0; j < n; j++) {
      mrc += cov[i][j] * (weights[tickers[j]] ?? 0);
    }
    const contribution = (weights[tickers[i]] ?? 0) * mrc;
    rc[tickers[i]] = contribution;
    totalRC += contribution;
  }

  // Normalize to percentages. A fully (or near-fully) hedged portfolio can
  // have ~zero total variance, i.e. totalRC <= 0; fall back to an equal
  // split so the "sums to 100%" contract always holds instead of silently
  // returning raw, non-normalized covariance units.
  if (totalRC > 0) {
    for (const t of tickers) {
      rc[t] = rc[t] / totalRC;
    }
  } else {
    for (const t of tickers) {
      rc[t] = 1 / n;
    }
  }
  return rc;
}

// ─── BACKTEST LITE ──────────────────────────────────────────────────────────

// Simulate rebalanced vs buy-and-hold over a period.
// allCloses: { ticker: closes[] }, weights: { ticker: weight }, threshold: rebalance trigger
// Returns: { dates: [], rebalanced: [], buyAndHold: [] } (cumulative returns, starting at 1.0)
function simulatePerformance(allCloses, weights, threshold = 0.05) {
  const tickers = Object.keys(weights);
  if (tickers.length === 0) return { dates: [], rebalanced: [], buyAndHold: [] };

  const minLen = Math.min(...tickers.map(t => allCloses[t]?.length ?? 0));
  if (minLen < 10) return { dates: [], rebalanced: [], buyAndHold: [] };

  // Current weights (rebalanced), drift-tracked across the loop
  const currentWeights = { ...weights };

  const rebalanced = [1];
  const buyAndHold = [1];
  const dates = Array.from({ length: minLen }, (_, i) => i);

  // B&H: fixed dollar amounts per ticker from day 0
  const bhDollars = {};
  for (const t of tickers) {
    bhDollars[t] = weights[t]; // normalized to 1 total
  }

  for (let d = 1; d < minLen; d++) {
    // Rebalanced: compute return from weight drift then check rebalance
    let rebalReturn = 0;
    for (const t of tickers) {
      const dayReturn = (allCloses[t][d] ?? allCloses[t][d - 1]) / (allCloses[t][d - 1] ?? 1);
      rebalReturn += currentWeights[t] * dayReturn;
    }
    rebalanced.push(rebalanced[rebalanced.length - 1] * rebalReturn);

    // Update current weights after price moves
    for (const t of tickers) {
      const dayReturn = (allCloses[t][d] ?? allCloses[t][d - 1]) / (allCloses[t][d - 1] ?? 1);
      currentWeights[t] = (currentWeights[t] * dayReturn) / rebalReturn;
    }

    // Rebalance if drift exceeds threshold
    let needsRebal = false;
    for (const t of tickers) {
      if (Math.abs(currentWeights[t] - weights[t]) > threshold) {
        needsRebal = true;
        break;
      }
    }
    if (needsRebal) {
      for (const t of tickers) {
        currentWeights[t] = weights[t];
      }
    }

    // Buy-and-hold: sum of fixed dollar amounts growing at individual rates
    let bhTotal = 0;
    for (const t of tickers) {
      const dayReturn = (allCloses[t][d] ?? allCloses[t][d - 1]) / (allCloses[t][d - 1] ?? 1);
      bhDollars[t] *= dayReturn;
      bhTotal += bhDollars[t];
    }
    // bhTotal is already the absolute cumulative value (starts at 1, since
    // bhDollars is normalized to sum to 1) — push it directly.
    buyAndHold.push(bhTotal);
  }

  return { dates, rebalanced, buyAndHold };
}

// ─── CHOLESKY DECOMPOSITION ───────────────────────────────────────────────
// Given a positive-definite covariance matrix, return its Cholesky factor L
// such that L * L^T = covariance. L is lower-triangular with positive diagonal.
function choleskyDecompose(covMatrix) {
  const n = covMatrix.length;
  const L = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k];
      }
      if (i === j) {
        const variance = covMatrix[i][i] - sum;
        L[i][j] = variance > 0 ? Math.sqrt(variance) : 0;
      } else {
        L[i][j] = L[j][j] > 0 ? (covMatrix[i][j] - sum) / L[j][j] : 0;
      }
    }
  }
  return L;
}

// ─── SEEDED PRNG ──────────────────────────────────────────────────────────
// mulberry32: small, fast, deterministic 32-bit PRNG. A seed makes Monte
// Carlo runs reproducible and unit-testable.
// ─── MONTHLY HISTORY FETCH ─────────────────────────────────────────────────────
// Monthly adjusted closes from the bundled snapshot, for long-horizon analysis.
async function fetchMonthlyHistory(ticker) {
  const snap = await loadSnapshot(ticker);
  const { dates, closes } = snap.monthly ?? {};
  if (!closes || closes.length < 10) throw new Error(`Insufficient monthly history for ${ticker}`);
  return { dates, closes };
}

// Aligns multiple ticker histories to their common date range.
// Returns { aligned: { [ticker]: number[] }, effectiveYears: number }
function computeOverlap(histories) {
  const tickers = Object.keys(histories);
  if (tickers.length === 0) return { aligned: {}, effectiveYears: 0 };

  // Find common date range
  const allDates = tickers.map(t => new Set(histories[t].dates));
  let commonDates = new Set(allDates[0]);
  for (let i = 1; i < allDates.length; i++) {
    commonDates = new Set([...commonDates].filter(d => allDates[i].has(d)));
  }
  if (commonDates.size === 0) {
    return { aligned: {}, effectiveYears: 0 };
  }
  const sortedCommon = [...commonDates].sort();

  // Align closes to common dates
  const aligned = {};
  for (const t of tickers) {
    const { dates, closes } = histories[t];
    const map = new Map(dates.map((d, i) => [d, closes[i]]));
    aligned[t] = sortedCommon.map(d => map.get(d));
  }

  const effectiveYears = sortedCommon.length / 12;
  // Shortest raw history is what limits the overlap.
  const limitedBy = tickers.reduce((a, b) =>
    histories[b].dates.length < histories[a].dates.length ? b : a
  );
  return { aligned, effectiveYears, limitedBy };
}

// ─── SEEDED PRNG ────────────────────────────────────────────────────────────────
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller transform: returns a function drawing standard normal(0,1)
// numbers from a supplied uniform RNG.
function normalSampler(rng) {
  let spare = null;
  return function () {
    if (spare !== null) {
      const v = spare;
      spare = null;
      return v;
    }
    let u1 = 0;
    let u2 = 0;
    while (u1 === 0) u1 = rng();
    while (u2 === 0) u2 = rng();
    const r = Math.sqrt(-2 * Math.log(u1));
    const theta = 2 * Math.PI * u2;
    spare = r * Math.sin(theta);
    return r * Math.cos(theta);
  };
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)));
  return sorted[idx];
}

// ─── MONTE CARLO SIMULATION ────────────────────────────────────────────────
// Simulate random portfolio paths using geometric Brownian motion with
// correlated asset returns. Uses Cholesky decomposition of the correlation
// matrix to generate correlated shocks.
// allCloses: { ticker: closes[] } - historical close prices
// weights: { ticker: weight } - target portfolio weights (sums to 1)
// vols: { ticker: annualizedVol } - annualized volatilities (per year)
// corrMatrix: { ticker: { [ticker2]: correlation } } - correlation matrix
// options: {
//   simulations: number of paths (default 1000),
//   steps: number of daily steps per path (default 252 ≈ 1 year),
//   threshold: rebalance drift threshold (default 0.05),
//   riskFreeRate: annual risk-free rate for Sharpe ratio (default 0.02),
//   expectedReturn: annual asset drift (default 0 = conservative),
//   seed: PRNG seed for reproducible runs (default 42),
// }
// Returns: { terminalValues: Float64Array, finalPrices: {ticker: median price}, stats }
function monteCarloSimulation(allCloses, weights, vols, corrMatrix, options = {}) {
  const simulations = options.simulations ?? 1000;
  const steps = options.steps ?? 252;
  const threshold = options.threshold ?? 0.05;
  const riskFreeRate = options.riskFreeRate ?? 0.02;
  const expectedReturn = options.expectedReturn ?? 0;
  const seed = options.seed ?? 42;

  const tickers = Object.keys(weights);
  const n = tickers.length;

  if (n === 0 || simulations <= 0 || steps <= 0) {
    return {
      terminalValues: new Float64Array(0),
      finalPrices: {},
      stats: { mean: 0, median: 0, p10: 0, p90: 0, sharpe: 0, cagr: 0, min: 0, max: 0 },
    };
  }

  const dt = 1 / 252;

  // Build daily covariance matrix: Cov(i,j) = ρ(i,j) × σ(i) × σ(j) / 252
  const cov = [];
  for (let i = 0; i < n; i++) {
    cov[i] = [];
    for (let j = 0; j < n; j++) {
      const rho = corrMatrix[tickers[i]]?.[tickers[j]] ?? (i === j ? 1 : 0);
      const sigmaI = vols[tickers[i]] ?? 0;
      const sigmaJ = vols[tickers[j]] ?? 0;
      cov[i][j] = (rho * sigmaI * sigmaJ) / 252;
    }
  }

  const L = choleskyDecompose(cov);

  // Current prices (latest close from historical data)
  const currentPrices = {};
  for (const t of tickers) {
    const series = allCloses[t];
    if (!series || series.length === 0) {
      throw new Error(`No price history for ${t}`);
    }
    currentPrices[t] = series[series.length - 1];
  }

  // Per-step drift for geometric Brownian motion: (μ - σ²/2) · dt
  const dailyDrift = {};
  for (const t of tickers) {
    const sigma = vols[t] ?? 0;
    dailyDrift[t] = (expectedReturn - 0.5 * sigma * sigma) * dt;
  }

  const rng = mulberry32(seed);
  const normal = normalSampler(rng);

  const terminalValues = new Float64Array(simulations);
  const terminalPrices = {};
  for (const t of tickers) terminalPrices[t] = new Float64Array(simulations);

  for (let sim = 0; sim < simulations; sim++) {
    const currentWeights = {};
    for (const t of tickers) currentWeights[t] = weights[t];
    const pathPrices = { ...currentPrices };
    let portfolioValue = 1;

    for (let step = 0; step < steps; step++) {
      // Correlated shocks: Z = L · X
      const normals = Array.from({ length: n }, () => normal());
      const correlated = Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        let sum = 0;
        for (let j = 0; j <= i; j++) sum += L[i][j] * normals[j];
        correlated[i] = sum;
      }

      let rebalReturn = 0;
      for (let i = 0; i < n; i++) {
        const t = tickers[i];
        const growth = Math.exp(dailyDrift[t] + Math.sqrt(dt) * correlated[i]);
        pathPrices[t] *= growth;
        rebalReturn += currentWeights[t] * growth;
        currentWeights[t] *= growth;
      }

      // Renormalize weights after the price move
      let weightSum = 0;
      for (const t of tickers) weightSum += currentWeights[t];
      for (const t of tickers) currentWeights[t] /= weightSum;

      // Rebalance if drift exceeds threshold
      let needsRebal = false;
      for (const t of tickers) {
        if (Math.abs(currentWeights[t] - weights[t]) > threshold) {
          needsRebal = true;
          break;
        }
      }
      if (needsRebal) {
        for (const t of tickers) currentWeights[t] = weights[t];
      }

      portfolioValue *= rebalReturn;
    }

    terminalValues[sim] = portfolioValue;
    for (const t of tickers) terminalPrices[t][sim] = pathPrices[t];
  }

  // Statistics
  const sortedValues = Array.from(terminalValues).sort((a, b) => a - b);
  const mean = sortedValues.reduce((a, b) => a + b, 0) / simulations;
  const median = percentile(sortedValues, 0.5);
  const p10 = percentile(sortedValues, 0.1);
  const p90 = percentile(sortedValues, 0.9);
  const variance = sortedValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / simulations;
  const stdDev = Math.sqrt(variance);

  const years = steps / 252;
  const annualMeanReturn = years > 0 && mean > 0 ? Math.pow(mean, 1 / years) - 1 : 0;
  const annualVol = years > 0 ? stdDev / Math.sqrt(years) : 0;
  const sharpe = annualVol > 0 ? (annualMeanReturn - riskFreeRate) / annualVol : 0;

  const finalPrices = {};
  for (const t of tickers) {
    finalPrices[t] = percentile(
      Array.from(terminalPrices[t]).sort((a, b) => a - b),
      0.5
    );
  }

  return {
    terminalValues,
    finalPrices,
    stats: {
      mean,
      median,
      p10,
      p90,
      sharpe,
      cagr: annualMeanReturn,
      min: sortedValues[0],
      max: sortedValues[sortedValues.length - 1],
    },
  };
}

// Clamp a ratio to [0, 1] for use as a CSS percentage width — negative
// risk contributions (a hedging asset) must not render as a negative width.
const clampPct = v => Math.max(0, Math.min(1, v));

const fmt = {
  pct: v => `${(v * 100).toFixed(1)}%`,
  usd: v =>
    v >= 1000
      ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
      : `$${v.toFixed(2)}`,
  shares: v => v.toFixed(2),
  vol: v => `${(v * 100).toFixed(1)}%`,
};

export {
  COMMON_ETFS,
  TAX_INEFFICIENCY,
  ACCOUNT_TYPES,
  LOOKBACK_OPTIONS,
  fetchQuote,
  fetchMonthlyHistory,
  computeOverlap,
  annualizedVol,
  inverseVolWeights,
  ercWeights,
  taxLocationWaterfall,
  generateTrades,
  closestTickers,
  dailyReturns,
  correlation,
  correlationMatrix,
  riskContribution,
  simulatePerformance,
  monteCarloSimulation,
  mulberry32,
  normalSampler,
  clampPct,
  fmt,
};
