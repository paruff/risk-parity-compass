import { describe, it, expect } from 'vitest';
import { drawdownPath, rollingWithdrawalRates } from '../withdrawal';

describe('drawdownPath', () => {
  it('drawdownPath with zero spend returns full balance', () => {
    const values = [100000, 102000, 104000];
    const r = drawdownPath(values, 0);
    expect(r.balances).toEqual(values);
    expect(r.depletedYear).toBeNull();
    expect(r.maxDrawdown).toBe(0);
    expect(r.terminalReal).toBe(104000);
    expect(r.yearsLasted).toBeCloseTo(values.length / 12);
  });

  it('drawdownPath depletes when spend > returns', () => {
    const values = Array.from({ length: 60 }, (_, i) => 100000 * 0.99 ** i); // declining ~12% nominal
    const r = drawdownPath(values, 1500); // 18% annual real spend on declining portfolio
    expect(r.depletedYear).not.toBeNull();
    expect(r.depletedYear).toBeLessThan(r.yearsLasted); // depletes before end
  });

  it('drawdownPath with inflation adjusts spend', () => {
    const values = Array.from({ length: 120 }, (_, i) => 100000); // flat nominal
    const r = drawdownPath(values, 4000, { inflationRate: 0.03 });
    expect(r.balances[12]).toBeLessThan(r.balances[0]); // inflation erodes
  });

  it('drawdownPath maxDrawdown is peak-to-trough', () => {
    const values = [100000, 90000, 95000, 80000, 85000];
    const r = drawdownPath(values, 0);
    expect(r.maxDrawdown).toBeCloseTo(0.2, 3); // (100k->80k) / 100k = 20%
  });
});

describe('rollingWithdrawalRates', () => {
  it('rollingWithdrawalRates returns SWR and PWR for growing portfolio', () => {
    // 40 years with some volatility: 5% average but with down years
    const values = Array.from({ length: 480 }, (_, i) => {
      const base = 100000 * 1.004 ** i;
      const noise = Math.sin(i * 0.1) * 0.05 * base; // ±5% oscillation
      return base + noise;
    });
    const r = rollingWithdrawalRates(values, { horizonYears: 30, inflationRate: 0 });
    // With volatility, SWR should be in a reasonable range
    expect(r.swr).toBeGreaterThan(0.03);
    expect(r.swr).toBeLessThan(0.15);
    expect(r.pwr).toBeLessThanOrEqual(r.swr);
    expect(r.successRate).toBeGreaterThanOrEqual(0);
    expect(r.successRate).toBeLessThanOrEqual(1);
  });

  it('rollingWithdrawalRates binary search tolerance', () => {
    const values = Array.from({ length: 480 }, (_, i) => {
      const base = 100000 * 1.004 ** i;
      const noise = Math.sin(i * 0.1) * 0.05 * base;
      return base + noise;
    });
    const r = rollingWithdrawalRates(values, { horizonYears: 30, inflationRate: 0.03 });
    expect(r.swr).toBeGreaterThan(0.03);
    expect(r.swr).toBeLessThan(0.15);
    expect(r.pwr).toBeLessThanOrEqual(r.swr);
  });
});
