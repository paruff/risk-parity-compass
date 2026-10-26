// ─── PORTFOLIO PATH ────────────────────────────────────────────────────────────
// Build a weight-normalised portfolio path from historical price series.

/**
 * Build a portfolio path normalised by target weights.
 * @param {Record<string, number[]>} seriesByTicker - Monthly closing prices per ticker
 * @param {Record<string, number>} weights - Target weights per ticker (sum to 1)
 * @param {number} startingValue - Initial portfolio value in dollars
 * @returns {number[]} Monthly portfolio values (normalised, starting at startingValue)
 */
export function buildPortfolioPath(seriesByTicker, weights, startingValue) {
  const tickers = Object.keys(weights).filter(t => seriesByTicker[t]?.length > 0);
  if (tickers.length === 0) return [];

  // Renormalise weights for tickers that have data
  let weightSum = 0;
  for (const t of tickers) weightSum += weights[t] ?? 0;
  if (weightSum === 0) return [];

  const normWeights = {};
  for (const t of tickers) {
    normWeights[t] = (weights[t] ?? 0) / weightSum;
  }

  // Find minimum series length
  const minLength = Math.min(...tickers.map(t => seriesByTicker[t].length));
  if (minLength === 0) return [];

  // Normalise each series to its first point, apply weight, sum
  const path = new Array(minLength);
  for (let i = 0; i < minLength; i++) {
    let value = 0;
    for (const t of tickers) {
      const series = seriesByTicker[t];
      const price = series[i];
      const firstPrice = series[0];
      if (price && firstPrice) {
        value += normWeights[t] * (price / firstPrice);
      }
    }
    path[i] = startingValue * value;
  }
  return path;
}
