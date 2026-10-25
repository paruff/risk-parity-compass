// ─── WITHDRAWAL ENGINE ────────────────────────────────────────────────────────
// Pure functions for retirement drawdown, SWR/PWR, Monte Carlo with withdrawals,
// RMD, guardrails, and cash buffer. No side effects, fully unit-testable.

// Withdraw a fixed real amount monthly from a portfolio path.
// portfolioValues: number[] (monthly nominal portfolio values WITHOUT withdrawals)
// monthlySpend: real monthly spend amount (constant in real terms)
// options: { periodsPerYear = 12, inflationRate = 0 }
// Returns: { balances, depletedYear, maxDrawdown, terminalReal, yearsLasted }
export function drawdownPath(portfolioValues, monthlySpend, options = {}) {
  const { periodsPerYear = 12, inflationRate = 0 } = options;
  const n = portfolioValues.length;
  if (n === 0) {
    return { balances: [], depletedYear: null, maxDrawdown: 0, terminalReal: 0, yearsLasted: 0 };
  }

  const balances = new Array(n);
  let depletedYear = null;
  let peak = -Infinity;
  let maxDrawdown = 0;
  let cumulativeSpend = 0;

  for (let i = 0; i < n; i++) {
    // Real portfolio value at month i (divide by inflation factor)
    const yearFraction = i / periodsPerYear;
    const inflationFactor = (1 + inflationRate) ** yearFraction;
    const realPortfolioValue = portfolioValues[i] / inflationFactor;

    // Add this month's spend (spend is constant in real terms)
    cumulativeSpend += monthlySpend;

    // Real balance = real portfolio value - cumulative real spends
    balances[i] = realPortfolioValue - cumulativeSpend;

    // Track peak and drawdown on real balances
    if (balances[i] > peak) {
      peak = balances[i];
    }
    if (peak > 0 && balances[i] < peak) {
      const dd = (peak - balances[i]) / peak;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    // Check depletion (balance <= 0)
    if (depletedYear === null && balances[i] <= 0) {
      depletedYear = yearFraction;
    }
  }

  const terminalReal = balances[n - 1];
  const yearsLasted = n / periodsPerYear;

  return { balances, depletedYear, maxDrawdown, terminalReal, yearsLasted };
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
