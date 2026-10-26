// ─── WITHDRAWAL ENGINE ────────────────────────────────────────────────────────
// Pure functions for retirement drawdown, SWR/PWR, Monte Carlo with withdrawals,
// RMD, guardrails, and cash buffer. No side effects, fully unit-testable.

import { mulberry32, normalSampler } from './finance.js';
import rmdTable from './rmd-tables.json';

export const RMD_TABLE_VERSION = rmdTable.version;

// US Uniform Lifetime Table. age: owner age at year end; balance: prior 12/31 balance.
// Returns { age, distributionPeriod, rmd, eligible }
export function requiredMinimumDistribution(age, priorYearEndBalance, options = {}) {
  const { tableVersion, birthYear } = options;
  // Eligibility age: 73 for born 1951-1959, 75 for 1960+
  let eligibleAge = 73;
  if (birthYear != null) {
    eligibleAge = birthYear >= 1960 ? 75 : 73;
  }

  if (age < eligibleAge) {
    return { age, distributionPeriod: null, rmd: 0, eligible: false };
  }

  const table = rmdTable.table;
  const ageKey = String(age);
  const distributionPeriod = table[ageKey];

  if (distributionPeriod == null) {
    // Age beyond table - use last entry
    const lastAge = Math.max(...Object.keys(table).map(Number));
    const fallbackPeriod = table[String(lastAge)];
    return {
      age,
      distributionPeriod: fallbackPeriod,
      rmd: priorYearEndBalance / fallbackPeriod,
      eligible: true,
    };
  }

  return {
    age,
    distributionPeriod,
    rmd: priorYearEndBalance / distributionPeriod,
    eligible: true,
  };
}

// Withdraw a fixed real amount monthly from a portfolio path.
// portfolioValues: number[] (monthly nominal portfolio values WITHOUT withdrawals)
// monthlySpend: real monthly spend amount (constant in real terms)
// options: { periodsPerYear = 12, inflationRate = 0, cashBufferMonths = 0, guardrail = 'none', startingValue = 0 }
// Returns: { balances, depletedYear, maxDrawdown, terminalReal, yearsLasted, bufferBalance, bufferRefills }
export function drawdownPath(portfolioValues, monthlySpend, options = {}) {
  const {
    periodsPerYear = 12,
    inflationRate = 0,
    cashBufferMonths = 0,
    guardrail = 'none',
    startingValue,
  } = options;
  const n = portfolioValues.length;
  if (n === 0) {
    return {
      balances: [],
      depletedYear: null,
      maxDrawdown: 0,
      terminalReal: 0,
      yearsLasted: 0,
      bufferBalance: 0,
      bufferRefills: 0,
    };
  }
  const effectiveStartingValue = startingValue ?? portfolioValues[0];

  const balances = new Array(n);
  let depletedYear = null;
  let peak = -Infinity;
  let maxDrawdown = 0;

  // Cash buffer: funded from portfolio at month 0, tracked as separate nominal balance
  const bufferTarget = monthlySpend * (cashBufferMonths || 0);
  let bufferBalance = bufferTarget;
  let bufferRefills = 0;
  let portfolioPeak = 0;
  let bufferHasBeenExhausted = false;
  let drawdownOccurred = false; // Track if portfolio fell below 90% of peak

  // Guardrail state
  let currentSpend = monthlySpend;

  // Track nominal balance (portfolio value without withdrawals minus portfolio withdrawals)
  // Start with first portfolio value MINUS the buffer funding
  let nominalBalance = portfolioValues[0] - bufferTarget;

  for (let i = 0; i < n; i++) {
    // Inflation factor for this month
    const yearFraction = i / periodsPerYear;
    const inflationFactor = (1 + inflationRate) ** yearFraction;

    // Apply guardrail if enabled (guardrailSpend expects real spend, real portfolio value)
    if (guardrail !== 'none') {
      const realPortfolioValue = nominalBalance / inflationFactor;
      const gr = guardrailSpend(
        currentSpend,
        realPortfolioValue,
        effectiveStartingValue,
        guardrail,
        { wasCut: i > 0, originalSpend: monthlySpend }
      );
      currentSpend = gr.nextSpend;
    }

    // This month's nominal spend
    const nominalSpend = currentSpend * inflationFactor;

    // Draw from cash buffer first (in nominal terms)
    const fromBuffer = Math.min(bufferBalance, nominalSpend);
    bufferBalance -= fromBuffer;
    if (fromBuffer > 0 && bufferBalance === 0) {
      bufferHasBeenExhausted = true;
    }

    // Remaining spend comes from portfolio
    const nominalFromPortfolio = nominalSpend - fromBuffer;

    // Withdraw from portfolio nominal balance
    nominalBalance = Math.max(0, nominalBalance - nominalFromPortfolio);

    // Real balance for reporting (at this time point, before growth for next month)
    const realBalance = nominalBalance / inflationFactor;
    balances[i] = realBalance;

    // Track peak and drawdown on real balances
    if (realBalance > peak) {
      peak = realBalance;
    }
    if (peak > 0 && realBalance < peak) {
      const dd = (peak - realBalance) / peak;
      if (dd > maxDrawdown) maxDrawdown = dd;
      // Mark that a drawdown has occurred (fell below 90% of peak)
      if (dd > 0.1) {
        drawdownOccurred = true;
      }
    }

    // Check depletion (balance <= 0)
    if (depletedYear === null && realBalance <= 0) {
      depletedYear = yearFraction;
    }

    // Apply portfolio growth for next month (if not last month)
    if (i < n - 1) {
      const growthFactor = portfolioValues[i + 1] / portfolioValues[i];
      nominalBalance *= growthFactor;

      // Track portfolio peak for buffer refill (nominal)
      if (nominalBalance > portfolioPeak) {
        portfolioPeak = nominalBalance;
      }

      // Refill buffer when portfolio exceeds 90% of its running peak AND buffer was previously exhausted
      // AND a drawdown has occurred (portfolio fell below 90% of peak at some point)
      // Refill adds 1 month of buffer at a time (simplified)
      if (
        bufferHasBeenExhausted &&
        drawdownOccurred &&
        bufferBalance < bufferTarget &&
        portfolioPeak > 0 &&
        nominalBalance > 0.9 * portfolioPeak
      ) {
        const refillAmount = Math.min(bufferTarget - bufferBalance, nominalBalance * 0.1);
        bufferBalance += refillAmount;
        nominalBalance -= refillAmount;
        bufferRefills++;
      }
    } else {
      // Last month - still track peak
      if (nominalBalance > portfolioPeak) {
        portfolioPeak = nominalBalance;
      }
    }
  }

  const terminalReal = balances[n - 1];
  const yearsLasted = n / periodsPerYear;

  // Return remaining buffer in real spend months
  return {
    balances,
    depletedYear,
    maxDrawdown,
    terminalReal,
    yearsLasted,
    bufferBalance: bufferBalance,
    bufferRefills,
  };
}

// For every historical start period of length horizonYears, find the highest
// constant real withdrawal rate that (a) never depletes the portfolio (SWR) and
// (b) never ends below the original real principal (PWR).
// portfolioValues: monthly real portfolio value series (from weights × prices)
// Returns: { swr, pwr, successRate, worstStart, worstDepletionYear, maxDrawdown, samples }
export function rollingWithdrawalRates(portfolioValues, options = {}) {
  const { horizonYears = 30, periodsPerYear = 12, inflationRate = 0 } = options;
  const horizonMonths = horizonYears * periodsPerYear;
  const n = portfolioValues.length;

  if (n < horizonMonths) {
    return {
      swr: 0,
      pwr: 0,
      successRate: 0,
      worstStart: 0,
      worstDepletionYear: null,
      maxDrawdown: 0,
      samples: [],
    };
  }

  const samples = [];
  let worstSwr = Infinity;
  let worstPwr = Infinity;
  let worstDepletionYear = null;
  let overallMaxDrawdown = 0;

  // For each possible start index
  for (let start = 0; start + horizonMonths <= n; start++) {
    const slice = portfolioValues.slice(start, start + horizonMonths);
    const startValue = slice[0];

    // Binary search for SWR (never depletes)
    let low = 0;
    let high = 0.2; // 20% annual withdrawal rate max
    let swr = 0;

    for (let iter = 0; iter < 30; iter++) {
      // tolerance ~ 1e-4 on annual rate
      const mid = (low + high) / 2;
      const monthlySpend = (mid * startValue) / periodsPerYear;
      const result = drawdownPath(slice, monthlySpend, { periodsPerYear, inflationRate });

      if (result.depletedYear === null) {
        // Not depleted, can try higher rate
        swr = mid;
        low = mid;
      } else {
        // Depleted, need lower rate
        high = mid;
      }
    }

    // Binary search for PWR (terminal >= start)
    low = 0;
    high = 0.2;
    let pwr = 0;

    for (let iter = 0; iter < 30; iter++) {
      const mid = (low + high) / 2;
      const monthlySpend = (mid * startValue) / periodsPerYear;
      const result = drawdownPath(slice, monthlySpend, { periodsPerYear, inflationRate });

      if (result.terminalReal >= startValue) {
        pwr = mid;
        low = mid;
      } else {
        high = mid;
      }
    }

    // Evaluate at SWR for metrics
    const monthlySpendSwr = (swr * startValue) / periodsPerYear;
    const swrResult = drawdownPath(slice, monthlySpendSwr, { periodsPerYear, inflationRate });

    samples.push({
      startIndex: start,
      swr,
      pwr,
      depleted: swrResult.depletedYear !== null,
    });

    if (swr < worstSwr) worstSwr = swr;
    if (pwr < worstPwr) worstPwr = pwr;
    if (
      swrResult.depletedYear !== null &&
      (worstDepletionYear === null || swrResult.depletedYear < worstDepletionYear)
    ) {
      worstDepletionYear = swrResult.depletedYear;
    }
    if (swrResult.maxDrawdown > overallMaxDrawdown) {
      overallMaxDrawdown = swrResult.maxDrawdown;
    }
  }

  const successRate = samples.filter(s => !s.depleted).length / samples.length;

  return {
    swr: worstSwr,
    pwr: worstPwr,
    successRate,
    worstStart: samples.findIndex(s => s.swr === worstSwr),
    worstDepletionYear,
    maxDrawdown: overallMaxDrawdown,
    samples,
  };
}

// Cholesky decomposition (copied from finance.js for independence)
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

// Percentile helper
function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)));
  return sorted[idx];
}

// Monte Carlo with monthly withdrawals, inflation, and percentile bands.
// allCloses: { ticker: closes[] } historical closes
// weights: { ticker: weight }
// vols: { ticker: annualizedVol }
// corrMatrix: { ticker: { [ticker2]: correlation } }
// options: { simulations, steps, monthlySpend, inflationRate, driftMode, expectedReturns, threshold, seed, guardrail, startingValue, age }
// Returns: { terminalValues, successRate, bands: { p10, p25, p50, p75, p90 }, stats, depletionYears }
export function monteCarloWithWithdrawals(allCloses, weights, vols, corrMatrix, options = {}) {
  const {
    simulations = 1000,
    steps = 360,
    monthlySpend = 0,
    inflationRate = 0.03,
    driftMode = 'historical',
    expectedReturns = null,
    threshold = 0.05,
    seed = 42,
    guardrail = 'none',
    startingValue = 0,
    age,
  } = options;

  const tickers = Object.keys(weights);
  const n = tickers.length;

  if (n === 0 || simulations <= 0 || steps <= 0) {
    return {
      terminalValues: new Float64Array(0),
      successRate: 0,
      bands: { p10: [], p25: [], p50: [], p75: [], p90: [] },
      stats: { mean: 0, median: 0, p10: 0, p90: 0, cagr: 0, sharpe: 0 },
      depletionYears: [],
    };
  }

  const dt = 1 / 12; // monthly steps

  // Per-ticker annual drift
  const annualDrift = {};
  for (const t of tickers) {
    if (driftMode === 'zero') {
      annualDrift[t] = 0;
    } else if (driftMode === 'custom' && expectedReturns?.[t] != null) {
      annualDrift[t] = expectedReturns[t];
    } else {
      // historical: compute mean annual return from allCloses
      const closes = allCloses[t] ?? [];
      if (closes.length >= 2) {
        const totalReturn = closes[closes.length - 1] / closes[0];
        const years = closes.length / 12;
        annualDrift[t] = years > 0 ? totalReturn ** (1 / years) - 1 : 0;
      } else {
        annualDrift[t] = 0;
      }
    }
  }

  // Daily covariance matrix (monthly): Cov(i,j) = ρ(i,j) × σ(i) × σ(j) / 12
  const cov = [];
  for (let i = 0; i < n; i++) {
    cov[i] = [];
    for (let j = 0; j < n; j++) {
      const rho = corrMatrix[tickers[i]]?.[tickers[j]] ?? (i === j ? 1 : 0);
      const sigmaI = vols[tickers[i]] ?? 0;
      const sigmaJ = vols[tickers[j]] ?? 0;
      cov[i][j] = (rho * sigmaI * sigmaJ) / 12;
    }
  }

  const L = choleskyDecompose(cov);

  // Current prices (latest close from historical data)
  const currentPrices = {};
  for (const t of tickers) {
    const series = allCloses[t];
    currentPrices[t] = series?.[series.length - 1] ?? 1;
  }

  // Per-step drift for GBM: (μ - σ²/2) · dt
  const stepDrift = {};
  for (const t of tickers) {
    const sigma = vols[t] ?? 0;
    stepDrift[t] = (annualDrift[t] - 0.5 * sigma * sigma) * dt;
  }

  // Seeded PRNG
  const rng = mulberry32(seed);
  const normal = normalSampler(rng);

  const terminalValues = new Float64Array(simulations);
  const depletionYears = new Array(simulations);
  const pathValues = Array.from({ length: simulations }, () => new Float64Array(steps));

  for (let sim = 0; sim < simulations; sim++) {
    const currentWeights = { ...weights };
    const pathPrices = { ...currentPrices };
    let portfolioValue = startingValue || 1; // normalized if not provided

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
        const growth = Math.exp(stepDrift[t] + Math.sqrt(dt) * correlated[i]);
        pathPrices[t] *= growth;
        rebalReturn += currentWeights[t] * growth;
        currentWeights[t] *= growth;
      }

      // Renormalize weights after price moves
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

      // Apply monthly withdrawal (inflation-adjusted)
      const yearFraction = step / 12;
      const inflationFactor = (1 + inflationRate) ** yearFraction;
      let realSpend = monthlySpend * inflationFactor;

      // Apply guardrail if enabled
      if (guardrail !== 'none') {
        const gr = guardrailSpend(realSpend, portfolioValue, startingValue || 1, guardrail, {
          wasCut: step > 0,
        });
        realSpend = gr.nextSpend * inflationFactor;
      }

      portfolioValue = Math.max(0, portfolioValue * rebalReturn - realSpend);

      pathValues[sim][step] = portfolioValue;

      if (depletionYears[sim] === undefined && portfolioValue <= 0) {
        depletionYears[sim] = yearFraction;
      }
    }

    // If never depleted, record full horizon
    if (depletionYears[sim] === undefined) {
      depletionYears[sim] = steps / 12;
    }

    terminalValues[sim] = portfolioValue;
  }

  // Statistics
  const sortedValues = Array.from(terminalValues).sort((a, b) => a - b);
  const mean = sortedValues.reduce((a, b) => a + b, 0) / simulations;
  const median = percentile(sortedValues, 0.5);
  const p10 = percentile(sortedValues, 0.1);
  const p90 = percentile(sortedValues, 0.9);
  const variance = sortedValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / simulations;
  const stdDev = Math.sqrt(variance);

  const years = steps / 12;
  const annualMeanReturn = years > 0 && mean > 0 ? Math.pow(mean, 1 / years) - 1 : 0;
  const annualVol = years > 0 ? stdDev / Math.sqrt(years) : 0;
  const sharpe = annualVol > 0 ? (annualMeanReturn - 0.02) / annualVol : 0; // 2% risk-free

  // Percentile bands per step
  const bands = { p10: [], p25: [], p50: [], p75: [], p90: [] };
  for (let step = 0; step < steps; step++) {
    const stepVals = [];
    for (let sim = 0; sim < simulations; sim++) {
      stepVals.push(pathValues[sim][step]);
    }
    stepVals.sort((a, b) => a - b);
    bands.p10.push(percentile(stepVals, 0.1));
    bands.p25.push(percentile(stepVals, 0.25));
    bands.p50.push(percentile(stepVals, 0.5));
    bands.p75.push(percentile(stepVals, 0.75));
    bands.p90.push(percentile(stepVals, 0.9));
  }

  const successRate = depletionYears.filter(y => y >= steps / 12).length / simulations;

  return {
    terminalValues,
    successRate,
    bands,
    stats: { mean, median, p10, p90, cagr: annualMeanReturn, sharpe },
    depletionYears,
  };
}

// Withdrawal sequencing: determine which account to draw from each month.
// Order: Taxable → Traditional (max of needed and RMD) → Roth
// accounts: { "Taxable": balance, "Traditional IRA / 401k": balance, "Roth IRA": balance }
// monthlySpend: total monthly spend needed
// options: { bracketHeuristic?: boolean, rmdByAccount?: Record<string, number>, traditionalBracketCap?: number }
// rmdByAccount and traditionalBracketCap are MONTHLY values (not annual)
// Returns: { byAccount (monthly), totalSpend (monthly), bracketUsed (monthly), shortfall (monthly) }
export function withdrawalSequence(accounts, monthlySpend, options = {}) {
  const {
    bracketHeuristic = false,
    rmdByAccount = {},
    traditionalBracketCap = 44000 / 12,
  } = options;

  const taxableBalance = accounts.Taxable ?? 0;
  const traditionalBalance = accounts['Traditional IRA / 401k'] ?? 0;
  const rothBalance = accounts['Roth IRA'] ?? 0;

  // RMD floor for traditional (monthly)
  const rmdMonthly = rmdByAccount['Traditional IRA / 401k'] ?? 0;

  // Monthly spending
  let remainingSpend = monthlySpend;

  // 1. Taxable first
  const taxableUsed = Math.min(taxableBalance, remainingSpend);
  remainingSpend -= taxableUsed;

  // 2. Traditional (max of needed and RMD, capped by bracket heuristic)
  // RMD applies even if taxable covered the spend
  let traditionalUsed = 0;
  if (traditionalBalance > 0) {
    const neededFromTraditional = Math.max(remainingSpend, rmdMonthly);
    const maxFromTraditional = bracketHeuristic
      ? Math.min(traditionalBracketCap, traditionalBalance)
      : traditionalBalance;
    traditionalUsed = Math.min(neededFromTraditional, maxFromTraditional);
    remainingSpend -= traditionalUsed;
  }

  // 3. Roth
  let rothUsed = 0;
  if (remainingSpend > 0 && rothBalance > 0) {
    rothUsed = Math.min(rothBalance, remainingSpend);
    remainingSpend -= rothUsed;
  }

  // Shortfall if all accounts exhausted
  const shortfall = Math.max(0, remainingSpend);

  return {
    byAccount: {
      Taxable: taxableUsed,
      'Traditional IRA / 401k': traditionalUsed,
      'Roth IRA': rothUsed,
    },
    totalSpend: monthlySpend - shortfall,
    bracketUsed: bracketHeuristic ? traditionalUsed : 0,
    shortfall,
  };
}

// VPW (Variable Percentage Withdrawal) table based on standard mortality tables
// Age -> withdrawal percentage (annual rate)
const VPW_TABLE = {
  65: 0.046,
  66: 0.047,
  67: 0.048,
  68: 0.049,
  69: 0.05,
  70: 0.051,
  71: 0.052,
  72: 0.053,
  73: 0.054,
  74: 0.055,
  75: 0.056,
  76: 0.057,
  77: 0.058,
  78: 0.059,
  79: 0.06,
  80: 0.061,
  81: 0.062,
  82: 0.063,
  83: 0.064,
  84: 0.065,
  85: 0.067,
  86: 0.069,
  87: 0.071,
  88: 0.073,
  89: 0.075,
  90: 0.077,
  91: 0.08,
  92: 0.083,
  93: 0.086,
  94: 0.089,
  95: 0.092,
  96: 0.096,
  97: 0.1,
  98: 0.104,
  99: 0.108,
  100: 0.113,
  101: 0.118,
  102: 0.123,
  103: 0.128,
  104: 0.133,
  105: 0.138,
  106: 0.143,
  107: 0.148,
  108: 0.153,
  109: 0.158,
  110: 0.163,
  111: 0.168,
  112: 0.173,
  113: 0.178,
  114: 0.183,
  115: 0.188,
  116: 0.193,
  117: 0.198,
  118: 0.203,
  119: 0.208,
  120: 0.213,
  121: 0.218,
  122: 0.223,
  123: 0.228,
  124: 0.233,
  125: 0.238,
  126: 0.243,
  127: 0.248,
  128: 0.253,
  129: 0.258,
  130: 0.263,
  131: 0.268,
  132: 0.273,
  133: 0.278,
  134: 0.283,
  135: 0.288,
  136: 0.293,
  137: 0.298,
  138: 0.303,
  139: 0.308,
  140: 0.313,
  141: 0.318,
  142: 0.323,
  143: 0.328,
  144: 0.333,
  145: 0.338,
  146: 0.343,
  147: 0.348,
  148: 0.353,
  149: 0.358,
  150: 0.363,
};

// Guardrail spending policies: rpr-80, guyton-klinger, vpw
export function guardrailSpend(currentSpend, portfolioValue, startingValue, policy, opts = {}) {
  if (policy === 'rpr-80') {
    const threshold = 0.8 * startingValue;
    if (portfolioValue < threshold) {
      return { nextSpend: 0.06 * portfolioValue, policyState: 'cut', cutRate: 0.06 };
    }
    // Recovery: if previously cut and now above threshold, return to normal
    if (opts.wasCut && portfolioValue >= threshold) {
      const normalSpend = opts.originalSpend ?? currentSpend;
      return { nextSpend: normalSpend, policyState: 'recovering', cutRate: 0 };
    }
    return { nextSpend: currentSpend, policyState: 'normal', cutRate: 0 };
  }

  if (policy === 'guyton-klinger') {
    const { initialRate = 0.05, upperGuardrail = 0.06, lowerGuardrail = 0.04 } = opts;
    const currentRate = currentSpend / portfolioValue;
    const floor = initialRate * 0.8;
    const ceiling = initialRate * 1.2;

    // Get previous state from opts
    const prevState = opts.gkState ?? {
      rate: currentRate,
      spend: currentSpend,
      consecutiveCuts: 0,
      consecutiveIncreases: 0,
    };

    let nextSpend = currentSpend;
    let policyState = 'normal';

    if (currentRate > upperGuardrail) {
      // Cut spending by 10%
      nextSpend = Math.max(currentSpend * 0.9, startingValue * floor);
      policyState = 'cut';
      prevState.consecutiveCuts += 1;
      prevState.consecutiveIncreases = 0;
    } else if (currentRate < lowerGuardrail) {
      // Increase spending by 10%
      nextSpend = Math.min(currentSpend * 1.1, startingValue * ceiling);
      policyState = 'prosperity';
      prevState.consecutiveIncreases += 1;
      prevState.consecutiveCuts = 0;
    } else {
      policyState = 'normal';
      prevState.consecutiveCuts = 0;
      prevState.consecutiveIncreases = 0;
    }

    // Apply floor/ceiling
    nextSpend = Math.max(Math.min(nextSpend, startingValue * ceiling), startingValue * floor);

    // Update state
    prevState.rate = nextSpend / portfolioValue;
    prevState.spend = nextSpend;

    return { nextSpend, policyState, cutRate: 0, gkState: prevState };
  }

  if (policy === 'vpw') {
    const { age, vpwTable } = opts;
    if (age == null) {
      throw new Error('VPW policy requires age parameter');
    }
    const table = vpwTable ?? VPW_TABLE;
    // Get the withdrawal percentage for the given age
    // Clamp age to table bounds
    const ageKeys = Object.keys(table).map(Number);
    const minAge = Math.min(...ageKeys);
    const maxAge = Math.max(...ageKeys);
    const clampedAge = Math.max(minAge, Math.min(maxAge, age));
    const withdrawalRate = table[clampedAge] ?? table[maxAge];

    // Cap at 100% of portfolio
    const nextSpend = Math.min(currentSpend, portfolioValue * withdrawalRate, portfolioValue);

    return {
      nextSpend,
      policyState: 'normal',
      cutRate: 0,
      withdrawalRate,
    };
  }

  // other policies handled in future tasks
  return { nextSpend: currentSpend, policyState: 'normal', cutRate: 0 };
}

// Net spend after Social Security and pension income
// grossSpend: total monthly spend needed
// ssMonthly: Social Security monthly benefit
// pensionMonthly: pension monthly benefit
// ssStartAge: age when SS starts
// pensionStartAge: age when pension starts
// currentAge: current age of the person
// Returns: { netMonthlySpend, bridgeYears, ssActive, pensionActive }
export function netSpend(
  grossSpend,
  ssMonthly,
  pensionMonthly,
  ssStartAge,
  pensionStartAge,
  currentAge
) {
  let netMonthlySpend = grossSpend;
  let ssActive = false;
  let pensionActive = false;
  let bridgeYears = 0;

  if (ssMonthly > 0 && currentAge >= ssStartAge) {
    netMonthlySpend -= ssMonthly;
    ssActive = true;
  } else if (ssMonthly > 0) {
    bridgeYears = ssStartAge - currentAge;
  }

  if (pensionMonthly > 0 && currentAge >= pensionStartAge) {
    netMonthlySpend -= pensionMonthly;
    pensionActive = true;
  } else if (pensionMonthly > 0) {
    bridgeYears = Math.max(bridgeYears, pensionStartAge - currentAge);
  }

  netMonthlySpend = Math.max(0, netMonthlySpend);

  return { netMonthlySpend, bridgeYears, ssActive, pensionActive };
}
