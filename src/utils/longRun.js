// Long-run annual return history (1928+) and the proxy each template ETF
// uses before its own inception. Static data, no runtime network.
import data from './long-run-returns.json';
import { rollingWithdrawalRates } from './withdrawal';

export const LONG_RUN = data;

// ETF -> series to splice in before the ETF's own history begins.
// Caveats are part of the contract: the app must label spliced history.
export const PROXY = {
  VTI: { series: 'stocks', note: 'S&P 500 total return' },
  SPY: { series: 'stocks', note: 'S&P 500 total return' },
  VOO: { series: 'stocks', note: 'S&P 500 total return' },
  IVV: { series: 'stocks', note: 'S&P 500 total return' },
  TLT: { series: 'tBond10', note: '10-year Treasury return; understates long-bond duration' },
  IEF: { series: 'tBond10', note: '10-year Treasury return' },
  GLD: { series: 'gold', note: 'gold price return; fixed price before 1971' },
  IAU: { series: 'gold', note: 'gold price return; fixed price before 1971' },
  VUG: { series: 'stocks', note: 'S&P 500 total return (no growth-only series)' },
  VIOV: { series: 'smallCap', note: 'bottom-decile US stocks; no small-cap value series' },
  VGIT: { series: 'tBond10', note: '10-year Treasury return' },
  VGLT: { series: 'tBond10', note: '10-year Treasury return; understates long-bond duration' },
  VGSH: { series: 'bills', note: '3-month T-bill rate' },
  SHY: { series: 'bills', note: '3-month T-bill rate' },
  BIL: { series: 'bills', note: '3-month T-bill rate' },
  GLDM: { series: 'gold', note: 'gold price return; fixed price before 1971' },
};

/** Annual returns for a ticker's proxy series, as [{year, r}], or null if none. */
export function proxyReturns(ticker) {
  const p = PROXY[ticker];
  if (!p) return null;
  return LONG_RUN.years.map((year, i) => ({ year, r: LONG_RUN.series[p.series][i] }));
}

/**
 * Annually rebalanced portfolio value path over 1928-2025 proxy returns (one point per
 * year-end, starting at startValue), or null if any holding has no proxy.
 */
export function longRunPath(weights, startValue = 1) {
  const tickers = Object.keys(weights);
  const rows = tickers.map(t => proxyReturns(t));
  if (tickers.length === 0 || rows.some(r => !r)) return null;
  const path = [startValue];
  for (let y = 0; y < LONG_RUN.years.length; y++) {
    const ret = tickers.reduce((s, t, i) => s + weights[t] * rows[i][y].r, 0);
    path.push(path[y] * (1 + ret));
  }
  return path;
}

/**
 * Rolling SWR/PWR/success on the 1928-2025 proxy history (annual periods), or null when a
 * holding has no proxy. `annualSpend` is in dollars per year.
 */
export function rollingLongRun(weights, totalValue, { horizonYears, inflationRate, annualSpend }) {
  const path = longRunPath(weights, totalValue);
  if (!path) return null;
  const r = rollingWithdrawalRates(path, {
    horizonYears,
    periodsPerYear: 1,
    inflationRate,
    monthlySpend: annualSpend, // per-period spend; one period is a year here
  });
  return { ...r, effectiveYears: path.length - 1, basis: 'long-run' };
}
