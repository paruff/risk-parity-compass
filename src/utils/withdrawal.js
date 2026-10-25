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
