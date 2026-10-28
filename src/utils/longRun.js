// Long-run annual return history (1928+) and the proxy each template ETF
// uses before its own inception. Static data, no runtime network.
import data from './long-run-returns.json';

export const LONG_RUN = data;

// ETF -> series to splice in before the ETF's own history begins.
// Caveats are part of the contract: the app must label spliced history.
export const PROXY = {
  VTI: { series: 'stocks', note: 'S&P 500 total return' },
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
