import { describe, it, expect } from 'vitest';
import { LONG_RUN, PROXY, proxyReturns } from '../longRun';

const cagr = xs =>
  Math.pow(
    xs.reduce((a, r) => a * (1 + r), 1),
    1 / xs.length
  ) - 1;

describe('long-run returns', () => {
  it('has one value per year for every series, 1928-2025', () => {
    expect(LONG_RUN.years[0]).toBe(1928);
    expect(LONG_RUN.years.at(-1)).toBe(2025);
    for (const s of Object.values(LONG_RUN.series)) expect(s).toHaveLength(LONG_RUN.years.length);
  });
  it('reproduces the published 1928-2025 geometric means', () => {
    // Damodaran sheet "Returns by year": stocks 10.02%, bills 3.37%, T-bond 4.53%
    expect(cagr(LONG_RUN.series.stocks)).toBeCloseTo(0.10018, 4);
    expect(cagr(LONG_RUN.series.bills)).toBeCloseTo(0.03372, 4);
    expect(cagr(LONG_RUN.series.tBond10)).toBeCloseTo(0.04535, 4);
  });
  it('has a documented source and a proxy for every template ticker', () => {
    expect(LONG_RUN.source).toMatch(/Damodaran/);
    for (const t of ['VTI', 'VUG', 'VIOV', 'VGLT', 'VGIT', 'VGSH', 'SHY', 'BIL', 'GLDM'])
      expect(proxyReturns(t)).toHaveLength(98);
    expect(PROXY.DBMF).toBeUndefined();
    expect(proxyReturns('DBMF')).toBeNull();
  });
});

import { longRunPath, rollingLongRun } from '../longRun';

describe('rolling metrics on long-run history', () => {
  it('builds a rebalanced path from proxy returns', () => {
    const p = longRunPath({ VTI: 0.5, VGSH: 0.5 }, 100);
    expect(p).toHaveLength(99);
    const s = LONG_RUN.series;
    expect(p[1]).toBeCloseTo(100 * (1 + 0.5 * s.stocks[0] + 0.5 * s.bills[0]), 8);
  });
  it('returns null when a holding has no proxy', () => {
    expect(longRunPath({ VTI: 0.5, DBMF: 0.5 })).toBeNull();
    expect(rollingLongRun({ DBMF: 1 }, 1e6, { horizonYears: 30 })).toBeNull();
  });
  it('gives many windows and is not withheld over 98 years at 30y horizon', () => {
    const r = rollingLongRun({ VTI: 0.6, VGIT: 0.4 }, 1e6, {
      horizonYears: 30,
      inflationRate: 0.03,
      annualSpend: 40000,
    });
    // 99 points, 30-point windows: 70 starts
    expect(r.windowCount).toBe(70);
    expect(r.withheld).toBe(false);
    expect(r.successRate).toBeGreaterThan(0.5);
    expect(r.successRate).toBeLessThanOrEqual(1);
    // 4% real-ish rule on 60/40 over 1928+ should find an SWR in the 3-6% band
    expect(r.swr).toBeGreaterThan(0.03);
    expect(r.swr).toBeLessThan(0.07);
  });
});
