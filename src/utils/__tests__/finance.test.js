import { describe, it, expect } from 'vitest';
import {
  annualizedVol,
  inverseVolWeights,
  taxLocationWaterfall,
  generateTrades,
  closestTickers,
  dailyReturns,
  correlation,
  correlationMatrix,
  riskContribution,
  simulatePerformance,
  monteCarloSimulation,
  clampPct,
  fetchMonthlyHistory,
  computeOverlap,
  mulberry32,
  normalSampler,
} from '../finance';

describe('annualizedVol', () => {
  it('returns ~0.16 for 1% daily alternating returns', () => {
    const closes = [100, 101, 100, 101, 100, 101, 100, 101, 100, 101];
    const vol = annualizedVol(closes);
    expect(vol).toBeGreaterThan(0.1);
    expect(vol).toBeLessThan(0.3);
  });
  it('returns 0 for flat prices', () => {
    expect(annualizedVol([100, 100, 100, 100])).toBe(0);
  });
});

describe('inverseVolWeights', () => {
  it('weights inversely to volatility', () => {
    const weights = inverseVolWeights({ A: 0.1, B: 0.2 });
    expect(weights.A).toBeCloseTo(0.667, 2);
    expect(weights.B).toBeCloseTo(0.333, 2);
  });
});

describe('taxLocationWaterfall', () => {
  it('places high-inefficiency assets in best accounts first', () => {
    const targetWeights = { TLT: 0.4, SPY: 0.6 };
    const prices = { TLT: 100, SPY: 400 };
    const accounts = { 'Roth IRA': 50000, Taxable: 50000 };
    const result = taxLocationWaterfall(targetWeights, prices, accounts, 100000);
    expect(result['Roth IRA'].TLT).toBeGreaterThan(0);
  });
});

describe('generateTrades', () => {
  it('generates BUY when underweight', () => {
    const current = { Taxable: { SPY: 0 } };
    const target = { Taxable: { SPY: 50000 } };
    const prices = { SPY: 500 };
    const trades = generateTrades(current, target, prices, 100000, 0.05);
    expect(trades[0].action).toBe('BUY');
  });
  it('generates no trades when within threshold', () => {
    const current = { Taxable: { SPY: 100 } };
    const target = { Taxable: { SPY: 50000 } };
    const prices = { SPY: 500 };
    const trades = generateTrades(current, target, prices, 100000, 0.05);
    expect(trades.length).toBe(0);
  });
});

describe('closestTickers', () => {
  it('suggests exact match first', () => {
    expect(closestTickers('SPY')[0]).toBe('SPY');
  });
  it('suggests near miss (VOO for VOOO)', () => {
    expect(closestTickers('VOOO')).toContain('VOO');
  });
});

describe('dailyReturns', () => {
  it('computes log returns from closes', () => {
    const closes = [100, 110, 105];
    const returns = dailyReturns(closes);
    expect(returns.length).toBe(2);
    expect(returns[0]).toBeCloseTo(Math.log(110 / 100), 5);
    expect(returns[1]).toBeCloseTo(Math.log(105 / 110), 5);
  });
});

describe('correlation', () => {
  it('returns 1 for identical series', () => {
    const a = [0.01, 0.02, -0.01, 0.03];
    expect(correlation(a, a)).toBeCloseTo(1, 4);
  });
  it('returns -1 for perfectly inversely correlated', () => {
    const a = [0.01, 0.02, -0.01, 0.03];
    const b = a.map(v => -v);
    expect(correlation(a, b)).toBeCloseTo(-1, 4);
  });
  it('returns 0 for uncorrelated series', () => {
    const a = [0.01, -0.01, 0.01, -0.01];
    const b = [0.02, 0.02, -0.02, -0.02];
    expect(Math.abs(correlation(a, b))).toBeLessThan(0.1);
  });
});

describe('correlationMatrix', () => {
  it('returns diagonal of 1s', () => {
    const closes = {
      A: [100, 101, 102, 103, 104],
      B: [200, 201, 199, 202, 200],
    };
    const m = correlationMatrix(closes);
    expect(m.A.A).toBe(1);
    expect(m.B.B).toBe(1);
  });
  it('is symmetric', () => {
    const closes = {
      A: [100, 101, 102, 103, 104],
      B: [200, 201, 199, 202, 200],
    };
    const m = correlationMatrix(closes);
    expect(m.A.B).toBeCloseTo(m.B.A, 5);
  });
});

describe('riskContribution', () => {
  it('sums to approximately 1', () => {
    const weights = { A: 0.5, B: 0.5 };
    const vols = { A: 0.2, B: 0.1 };
    const corr = { A: { A: 1, B: 0.3 }, B: { A: 0.3, B: 1 } };
    const rc = riskContribution(weights, vols, corr);
    const sum = rc.A + rc.B;
    expect(sum).toBeCloseTo(1, 4);
  });
  it('gives more risk contribution to higher-vol asset with equal weights', () => {
    const weights = { A: 0.5, B: 0.5 };
    const vols = { A: 0.3, B: 0.1 };
    const corr = { A: { A: 1, B: 0.5 }, B: { A: 0.5, B: 1 } };
    const rc = riskContribution(weights, vols, corr);
    expect(rc.A).toBeGreaterThan(rc.B);
  });
  it('falls back to an equal split when total risk contribution is zero (fully hedged portfolio)', () => {
    const weights = { A: 0.5, B: 0.5 };
    const vols = { A: 0.1, B: 0.1 };
    const corr = { A: { A: 1, B: -1 }, B: { A: -1, B: 1 } };
    const rc = riskContribution(weights, vols, corr);
    expect(rc.A).toBeCloseTo(0.5, 5);
    expect(rc.B).toBeCloseTo(0.5, 5);
    expect(rc.A + rc.B).toBeCloseTo(1, 5);
  });
});

describe('simulatePerformance', () => {
  it('returns arrays of equal length starting at 1', () => {
    const closes = {
      A: Array.from({ length: 50 }, (_, i) => 100 + i * 0.5),
      B: Array.from({ length: 50 }, (_, i) => 200 - i * 0.3),
    };
    const weights = { A: 0.5, B: 0.5 };
    const result = simulatePerformance(closes, weights, 0.05);
    expect(result.dates.length).toBe(50);
    expect(result.rebalanced.length).toBe(50);
    expect(result.buyAndHold.length).toBe(50);
    expect(result.rebalanced[0]).toBe(1);
    expect(result.buyAndHold[0]).toBe(1);
  });
  it('handles empty input gracefully', () => {
    const result = simulatePerformance({}, {}, 0.05);
    expect(result.dates.length).toBe(0);
  });
});

describe('clampPct', () => {
  it('clamps negative values to 0', () => {
    expect(clampPct(-0.05)).toBe(0);
  });
  it('clamps values above 1 to 1', () => {
    expect(clampPct(1.2)).toBe(1);
  });
  it('passes through in-range values unchanged', () => {
    expect(clampPct(0.42)).toBe(0.42);
  });
});

describe('monteCarloSimulation', () => {
  const makeCloses = () => ({
    A: Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i * 0.2) * 5),
    B: Array.from({ length: 60 }, (_, i) => 100 + Math.cos(i * 0.15) * 4),
  });
  const weights = { A: 0.6, B: 0.4 };
  const vols = { A: 0.2, B: 0.1 };
  const corr = {
    A: { A: 1, B: 0.3 },
    B: { A: 0.3, B: 1 },
  };

  it('is deterministic for a fixed seed', () => {
    const opts = { simulations: 50, steps: 60, seed: 7 };
    const first = monteCarloSimulation(makeCloses(), weights, vols, corr, opts);
    const second = monteCarloSimulation(makeCloses(), weights, vols, corr, opts);
    expect(Array.from(first.terminalValues)).toEqual(Array.from(second.terminalValues));
  });

  it('produces the requested number of terminal values', () => {
    const result = monteCarloSimulation(makeCloses(), weights, vols, corr, {
      simulations: 25,
      steps: 30,
      seed: 1,
    });
    expect(result.terminalValues.length).toBe(25);
  });

  it('orders percentiles p10 <= median <= p90', () => {
    const { stats } = monteCarloSimulation(makeCloses(), weights, vols, corr, {
      simulations: 200,
      steps: 60,
      seed: 2,
    });
    expect(stats.p10).toBeLessThanOrEqual(stats.median);
    expect(stats.median).toBeLessThanOrEqual(stats.p90);
  });

  it('returns a final price for every ticker', () => {
    const result = monteCarloSimulation(makeCloses(), weights, vols, corr, {
      simulations: 20,
      steps: 30,
      seed: 3,
    });
    expect(Object.keys(result.finalPrices).sort()).toEqual(['A', 'B']);
    expect(result.finalPrices.A).toBeGreaterThan(0);
    expect(result.finalPrices.B).toBeGreaterThan(0);
  });

  it('leaves a zero-volatility portfolio unchanged', () => {
    const flat = { A: 0.0, B: 0.0 };
    const result = monteCarloSimulation(makeCloses(), weights, flat, corr, {
      simulations: 10,
      steps: 30,
      seed: 4,
    });
    for (const v of result.terminalValues) {
      expect(v).toBeCloseTo(1, 10);
    }
  });

  it('handles empty weights gracefully', () => {
    const result = monteCarloSimulation({}, {}, {}, {}, { simulations: 10 });
    expect(result.terminalValues.length).toBe(0);
    expect(result.stats.median).toBe(0);
  });
});

describe('fetchMonthlyHistory', () => {
  it('returns monthly dates and closes', async () => {
    const { dates, closes } = await fetchMonthlyHistory('SPY');
    expect(Array.isArray(dates)).toBe(true);
    expect(Array.isArray(closes)).toBe(true);
    expect(dates.length).toBe(closes.length);
    expect(dates.length).toBeGreaterThan(0);
  });

  it('throws on 404', async () => {
    await expect(fetchMonthlyHistory('INVALID')).rejects.toThrow();
  });
});

describe('computeOverlap', () => {
  it('aligns tickers to common date range', () => {
    const histories = {
      A: { dates: ['2020-01', '2020-02', '2020-03'], closes: [100, 101, 102] },
      B: { dates: ['2020-02', '2020-03', '2020-04'], closes: [50, 51, 52] },
    };
    const { aligned, effectiveYears } = computeOverlap(histories);
    expect(Object.keys(aligned)).toEqual(['A', 'B']);
    expect(aligned.A).toEqual([101, 102]); // B starts Feb
    expect(aligned.B).toEqual([50, 51]);
    expect(effectiveYears).toBeCloseTo(2 / 12, 2);
  });

  it('returns empty when no overlap', () => {
    const histories = {
      A: { dates: ['2020-01'], closes: [100] },
      B: { dates: ['2021-01'], closes: [50] },
    };
    const { aligned, effectiveYears } = computeOverlap(histories);
    expect(Object.keys(aligned)).toEqual([]);
    expect(effectiveYears).toBe(0);
  });
});

describe('mulberry32', () => {
  it('produces deterministic sequence for fixed seed', () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it('produces different sequences for different seeds', () => {
    const rng1 = mulberry32(1);
    const rng2 = mulberry32(2);
    let same = true;
    for (let i = 0; i < 100; i++) {
      if (rng1() !== rng2()) {
        same = false;
        break;
      }
    }
    expect(same).toBe(false);
  });

  it('outputs values in [0, 1)', () => {
    const rng = mulberry32(123);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('normalSampler', () => {
  it('produces approximately normal distribution', () => {
    const rng = mulberry32(42);
    const sampler = normalSampler(rng);
    const samples = Array.from({ length: 10000 }, () => sampler());
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length;
    expect(mean).toBeCloseTo(0, 1);
    expect(variance).toBeCloseTo(1, 1);
  });
});

describe('computeOverlap reporting', () => {
  it('names the shortest-history ticker as the limiting one', () => {
    const mk = n => ({
      dates: Array.from(
        { length: n },
        (_, i) => `2000-${String((i % 12) + 1).padStart(2, '0')}-${i}`
      ),
      closes: Array(n).fill(1),
    });
    const long = mk(36);
    const short = { dates: long.dates.slice(12), closes: Array(24).fill(1) };
    const r = computeOverlap({ AAA: long, BBB: short });
    expect(r.effectiveYears).toBe(2);
    expect(r.limitedBy).toBe('BBB');
  });
});
