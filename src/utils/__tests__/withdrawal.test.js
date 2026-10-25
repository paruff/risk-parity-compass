import { describe, it, expect } from 'vitest';
import { drawdownPath } from '../withdrawal';

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
