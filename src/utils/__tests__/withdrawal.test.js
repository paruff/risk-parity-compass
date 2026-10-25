import { describe, it, expect } from 'vitest';
import {
  drawdownPath,
  rollingWithdrawalRates,
  monteCarloWithWithdrawals,
  requiredMinimumDistribution,
  RMD_TABLE_VERSION,
} from '../withdrawal';

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

describe('monteCarloWithWithdrawals', () => {
  it('is deterministic with fixed seed', () => {
    const allCloses = { SPY: Array.from({ length: 200 }, (_, i) => 100 + Math.sin(i * 0.1) * 2) };
    const weights = { SPY: 1 };
    const vols = { SPY: 0.15 };
    const corr = { SPY: { SPY: 1 } };
    const opts = {
      simulations: 100,
      steps: 120,
      monthlySpend: 400,
      inflationRate: 0.03,
      driftMode: 'zero',
      seed: 42,
    };
    const r1 = monteCarloWithWithdrawals(allCloses, weights, vols, corr, opts);
    const r2 = monteCarloWithWithdrawals(allCloses, weights, vols, corr, opts);
    expect(Array.from(r1.terminalValues)).toEqual(Array.from(r2.terminalValues));
    expect(r1.bands.p50).toEqual(r2.bands.p50);
  });

  it('successRate = fraction never depleted', () => {
    const allCloses = { SPY: Array.from({ length: 200 }, (_, i) => 100 * 1.005 ** i) };
    const weights = { SPY: 1 };
    const vols = { SPY: 0.15 };
    const corr = { SPY: { SPY: 1 } };
    const opts = {
      simulations: 200,
      steps: 120,
      monthlySpend: 100,
      inflationRate: 0.03,
      driftMode: 'historical',
      seed: 123,
    };
    const r = monteCarloWithWithdrawals(allCloses, weights, vols, corr, opts);
    expect(r.successRate).toBeGreaterThanOrEqual(0);
    expect(r.successRate).toBeLessThanOrEqual(1);
    expect(r.bands.p10.length).toBe(120);
    expect(r.bands.p50.length).toBe(120);
    expect(r.bands.p90.length).toBe(120);
    expect(r.depletionYears.length).toBe(200);
  });
});

describe('requiredMinimumDistribution', () => {
  it('RMD_TABLE_VERSION is exposed', () => {
    expect(RMD_TABLE_VERSION).toBe('2022+');
  });

  it('requiredMinimumDistribution before eligibility returns 0', () => {
    const r = requiredMinimumDistribution(70, 1000000);
    expect(r.eligible).toBe(false);
    expect(r.rmd).toBe(0);
    expect(r.distributionPeriod).toBeNull();
  });

  it('requiredMinimumDistribution at age 73 uses correct factor', () => {
    const r = requiredMinimumDistribution(73, 1000000);
    expect(r.eligible).toBe(true);
    expect(r.distributionPeriod).toBe(26.5);
    expect(r.rmd).toBeCloseTo(1000000 / 26.5, 0);
  });

  it('requiredMinimumDistribution birth-year rule', () => {
    // Born 1959 -> eligible at 73
    const r1 = requiredMinimumDistribution(73, 1000000, { birthYear: 1959 });
    expect(r1.eligible).toBe(true);
    // Born 1960 -> eligible at 75
    const r2 = requiredMinimumDistribution(73, 1000000, { birthYear: 1960 });
    expect(r2.eligible).toBe(false);
    const r3 = requiredMinimumDistribution(75, 1000000, { birthYear: 1960 });
    expect(r3.eligible).toBe(true);
  });
});
