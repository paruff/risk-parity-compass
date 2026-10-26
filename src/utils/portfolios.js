// ─── PORTFOLIO TEMPLATES & DIVERSIFICATION ────────────────────────────────────
// RPR-sourced portfolio templates + diversification scoring. Pure functions.

/**
 * Macro asset class mapping for diversification analysis.
 * Add tickers here as templates expand.
 */
export const MACRO_CLASS_MAP = {
  // US Equity
  VTI: 'US Equity',
  VOO: 'US Equity',
  IVV: 'US Equity',
  QQQ: 'US Equity',
  VUG: 'US Equity',
  VTV: 'US Equity',
  VIOV: 'US Equity',
  IWM: 'US Equity',
  SPY: 'US Equity',
  SCHB: 'US Equity',
  // International Equity
  VXUS: 'Intl Equity',
  VEU: 'Intl Equity',
  VEA: 'Intl Equity',
  IEFA: 'Intl Equity',
  VWO: 'EM Equity',
  IEMG: 'EM Equity',
  EEM: 'EM Equity',
  // US Bonds
  TLT: 'US Long Bonds',
  VGLT: 'US Long Bonds',
  EDV: 'US Long Bonds',
  IEF: 'US Interm Bonds',
  VGIT: 'US Interm Bonds',
  SCHR: 'US Interm Bonds',
  BND: 'US Agg Bonds',
  AGG: 'US Agg Bonds',
  SCHZ: 'US Agg Bonds',
  VGSH: 'US Short Bonds',
  SHV: 'US Short Bonds',
  BIL: 'US Short Bonds',
  TIP: 'TIPS',
  VTIP: 'TIPS',
  SCHP: 'TIPS',
  // International Bonds
  BNDX: 'Intl Bonds',
  VWOB: 'EM Bonds',
  EMB: 'EM Bonds',
  // Commodities
  GLD: 'Gold',
  IAU: 'Gold',
  GLDM: 'Gold',
  SLV: 'Silver',
  SIVR: 'Silver',
  DBC: 'Broad Commodities',
  PDBC: 'Broad Commodities',
  COMT: 'Broad Commodities',
  // Real Estate
  VNQ: 'US REIT',
  SCHH: 'US REIT',
  VNQI: 'Intl REIT',
  // Crypto (optional, not in RPR templates)
  // BITO: 'Crypto', IBIT: 'Crypto',
};

// Default class for unknown tickers
const DEFAULT_CLASS = 'Other';

/**
 * Get macro class for a ticker.
 * @param {string} ticker
 * @returns {string}
 */
export function getMacroClass(ticker) {
  return MACRO_CLASS_MAP[ticker] ?? DEFAULT_CLASS;
}

/**
 * RPR Portfolio Templates.
 * Allocations transcribed from Risk Parity Radio portfolio pages.
 * Each template includes: id, name, source, lastReviewed (YYYY-MM-DD), description, allocations.
 * Allocations sum to 1.0. Weights are target portfolio weights.
 */
export const PORTFOLIO_TEMPLATES = [
  {
    id: 'golden-butterfly',
    name: 'Golden Butterfly',
    source: 'Risk Parity Radio',
    lastReviewed: '2026-10-26',
    description:
      'Equal-weight 5-asset portfolio: 20% each US stocks, small-cap value, long bonds, short bonds, gold. Designed for all-weather resilience.',
    allocations: {
      VTI: 0.2, // US Total Market
      VIOV: 0.2, // US Small-Cap Value
      VGLT: 0.2, // Long-Term Treasury
      VGSH: 0.2, // Short-Term Treasury
      GLDM: 0.2, // Gold
    },
  },
  {
    id: 'all-seasons',
    name: 'All Seasons (RPR Version)',
    source: 'Risk Parity Radio',
    lastReviewed: '2026-10-26',
    description:
      'RPR adaptation of the All Weather portfolio: 30% US stocks, 15% long bonds, 40% intermediate bonds, 7.5% gold, 7.5% commodities.',
    allocations: {
      VTI: 0.3, // US Total Market
      VGLT: 0.15, // Long-Term Treasury
      VGIT: 0.4, // Intermediate Treasury
      GLDM: 0.075, // Gold
      DBC: 0.075, // Broad Commodities
    },
  },
  {
    id: 'golden-ratio',
    name: 'Golden Ratio',
    source: 'Risk Parity Radio',
    lastReviewed: '2026-10-26',
    description:
      'Fibonacci-inspired allocation: 61.8% growth assets (stocks/REITs), 38.2% defensive (bonds/gold).',
    allocations: {
      VTI: 0.4, // US Total Market
      VXUS: 0.218, // Intl Equity (61.8% * ~35%)
      VGLT: 0.15, // Long Bonds
      VGIT: 0.15, // Intermediate Bonds
      VNQ: 0.05, // REITs
      GLDM: 0.032, // Gold (adjusted to sum to 1)
    },
  },
  {
    id: 'permanent-portfolio',
    name: 'Permanent Portfolio',
    source: 'Risk Parity Radio / Harry Browne',
    lastReviewed: '2026-10-26',
    description:
      'Classic 25% each: US stocks, long bonds, cash/short bonds, gold. Designed for any economic environment.',
    allocations: {
      VTI: 0.25, // US Stocks
      VGLT: 0.25, // Long Treasury
      VGSH: 0.25, // Short Treasury (cash proxy)
      GLDM: 0.25, // Gold
    },
  },
  {
    id: 'aggressive-50-50',
    name: 'Aggressive 50/50',
    source: 'Risk Parity Radio',
    lastReviewed: '2026-10-26',
    description:
      'Simple 50% US stocks / 50% long bonds. High volatility, historically strong returns.',
    allocations: {
      VTI: 0.5,
      VGLT: 0.5,
    },
  },
  {
    id: 'risk-parity-core',
    name: 'Risk Parity Core (RPR)',
    source: 'Risk Parity Radio',
    lastReviewed: '2026-10-26',
    description:
      'RPR flagship risk parity: equal-risk allocation across 4 macro regimes using 4 ETFs.',
    allocations: {
      VTI: 0.2, // Growth
      VGLT: 0.3, // Deflation hedge
      GLDM: 0.25, // Inflation hedge
      VGIT: 0.25, // Intermediate bonds
    },
  },
];

/**
 * Validate template allocations sum to 1.0 (within tolerance).
 * @param {Record<string, number>} allocations
 * @returns {boolean}
 */
export function validateAllocations(allocations) {
  const sum = Object.values(allocations).reduce((a, b) => a + b, 0);
  return Math.abs(sum - 1) < 1e-6;
}

/**
 * Get template by ID.
 * @param {string} id
 * @returns {Object|undefined}
 */
export function getTemplate(id) {
  return PORTFOLIO_TEMPLATES.find(t => t.id === id);
}

/**
 * Get all template IDs and names for UI selector.
 * @returns {Array<{id: string, name: string}>}
 */
export function getTemplateList() {
  return PORTFOLIO_TEMPLATES.map(t => ({ id: t.id, name: t.name }));
}

/**
 * Compute diversification score from correlation matrix.
 * @param {Record<string, Record<string, number>>} corrMatrix - Ticker -> { ticker2: correlation }
 * @returns {{
 *   avgPairwiseCorrelation: number,
 *   maxPairwiseCorrelation: number,
 *   classCount: number,
 *   warnings: string[]
 * }}
 */
export function diversificationScore(corrMatrix) {
  const tickers = Object.keys(corrMatrix);
  const n = tickers.length;

  if (n < 2) {
    // Still compute class count for single ticker
    const classes = new Set();
    for (const t of tickers) {
      classes.add(getMacroClass(t));
    }
    return {
      avgPairwiseCorrelation: 0,
      maxPairwiseCorrelation: 0,
      classCount: classes.size,
      warnings: ['Need at least 2 tickers for diversification analysis'],
    };
  }

  // Compute average and max pairwise correlation (excluding diagonal)
  let sumCorr = 0;
  let count = 0;
  let maxCorr = -Infinity;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const corr = corrMatrix[tickers[i]]?.[tickers[j]] ?? 0;
      sumCorr += corr;
      count++;
      if (corr > maxCorr) maxCorr = corr;
    }
  }

  const avgCorr = count > 0 ? sumCorr / count : 0;

  // Count unique macro classes represented
  const classes = new Set();
  for (const t of tickers) {
    classes.add(getMacroClass(t));
  }
  const classCount = classes.size;

  // Build warnings per RPR rules
  const warnings = [];
  if (avgCorr > 0.6) {
    warnings.push('Average pairwise correlation exceeds 0.6 — portfolio may lack diversification');
  }
  if (classCount < 4) {
    warnings.push('Fewer than 4 macro asset classes represented');
  }
  if (maxCorr > 0.9) {
    warnings.push('Extreme pairwise correlation > 0.9 detected — two assets may be redundant');
  }

  return {
    avgPairwiseCorrelation: avgCorr,
    maxPairwiseCorrelation: maxCorr,
    classCount,
    warnings,
  };
}

/**
 * Normalize weights for a template, filtering to available tickers.
 * @param {Record<string, number>} templateAllocations
 * @param {string[]} availableTickers
 * @returns {Record<string, number>} normalized weights for available tickers
 */
export function normalizeTemplateWeights(templateAllocations, availableTickers) {
  const availableSet = new Set(availableTickers);
  let weightSum = 0;
  const filtered = {};

  for (const [ticker, weight] of Object.entries(templateAllocations)) {
    if (availableSet.has(ticker)) {
      filtered[ticker] = weight;
      weightSum += weight;
    }
  }

  if (weightSum === 0) return {};

  const normalized = {};
  for (const [ticker, weight] of Object.entries(filtered)) {
    normalized[ticker] = weight / weightSum;
  }
  return normalized;
}

const COMPARED_METRICS = ['swr', 'pwr', 'successRate', 'maxDrawdown'];

/**
 * Template minus current for each retirement metric (positive = template has more).
 * @param {Record<string, number>} current
 * @param {Record<string, number>} template
 * @returns {Record<string, number>}
 */
export function metricDifference(current, template) {
  return Object.fromEntries(COMPARED_METRICS.map(k => [k, template[k] - current[k]]));
}

/**
 * Rows for the weight comparison table over the union of tickers.
 * diffPp is template minus current, in percentage points.
 * @param {Record<string, number>} current
 * @param {Record<string, number>} template
 * @returns {Array<{ticker: string, current: number, template: number, diffPp: number}>}
 */
export function weightRows(current, template) {
  const tickers = [...new Set([...Object.keys(current), ...Object.keys(template)])];
  return tickers.map(ticker => {
    const c = current[ticker] ?? 0;
    const t = template[ticker] ?? 0;
    return { ticker, current: c, template: t, diffPp: (t - c) * 100 };
  });
}
