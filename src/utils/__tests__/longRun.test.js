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
