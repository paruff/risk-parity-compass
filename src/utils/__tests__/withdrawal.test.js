import { describe, it, expect } from 'vitest';
import {
  drawdownPath,
  rollingWithdrawalRates,
  monteCarloWithWithdrawals,
  requiredMinimumDistribution,
  RMD_TABLE_VERSION,
  withdrawalSequence,
  guardrailSpend,
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

  it('drawdownPath with cash buffer draws from buffer first', () => {
    const values = Array.from({ length: 120 }, (_, i) => 100000);
    const r = drawdownPath(values, 4000, { inflationRate: 0, cashBufferMonths: 12 });
    // First 12 months should come from buffer, portfolio untouched
    expect(r.balances[11]).toBe(100000);
    expect(r.balances[12]).toBeLessThan(100000);
  });

  it('drawdownPath buffer refills when portfolio grows', () => {
    const values = Array.from({ length: 120 }, (_, i) => 100000 * 1.01 ** i); // growing
    const r = drawdownPath(values, 4000, { inflationRate: 0, cashBufferMonths: 12 });
    // Buffer should refill; portfolio balance should reflect refill
    expect(r.balances[24]).toBeGreaterThan(100000 - 4000 * 12);
  });

  it('drawdownPath buffer depletion forces portfolio withdrawal', () => {
    const values = Array.from({ length: 60 }, (_, i) => 100000); // flat
    const r = drawdownPath(values, 4000, { inflationRate: 0, cashBufferMonths: 3 });
    // Buffer lasts 3 months, then portfolio draws
    expect(r.balances[2]).toBe(100000);
    expect(r.balances[3]).toBe(96000);
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

describe('withdrawalSequence', () => {
  it('withdrawalSequence uses taxable first, then traditional, then Roth', () => {
    const accounts = { Taxable: 50000, 'Traditional IRA / 401k': 100000, 'Roth IRA': 30000 };
    const r = withdrawalSequence(accounts, 4000);
    expect(r.byAccount.Taxable).toBe(4000);
    expect(r.byAccount['Traditional IRA / 401k']).toBe(0);
    expect(r.byAccount['Roth IRA']).toBe(0);
  });

  it('withdrawalSequence spills to traditional when taxable exhausted', () => {
    const accounts = { Taxable: 2000, 'Traditional IRA / 401k': 100000, 'Roth IRA': 30000 };
    const r = withdrawalSequence(accounts, 4000);
    expect(r.byAccount.Taxable).toBe(2000);
    expect(r.byAccount['Traditional IRA / 401k']).toBe(2000);
    expect(r.byAccount['Roth IRA']).toBe(0);
  });

  it('withdrawalSequence respects RMD floor on traditional', () => {
    const accounts = { Taxable: 50000, 'Traditional IRA / 401k': 100000, 'Roth IRA': 30000 };
    const rmdByAccount = { 'Traditional IRA / 401k': 5000 }; // RMD > spend
    const r = withdrawalSequence(accounts, 4000, { rmdByAccount });
    expect(r.byAccount['Traditional IRA / 401k']).toBe(5000); // at least RMD
  });

  it('withdrawalSequence bracketHeuristic limits traditional to bracket', () => {
    const accounts = { Taxable: 0, 'Traditional IRA / 401k': 200000, 'Roth IRA': 100000 };
    const r = withdrawalSequence(accounts, 10000, { bracketHeuristic: true });
    // Heuristic: don't push traditional withdrawal into next marginal bracket
    // Implementation detail: cap traditional at ~44k (2024 12% bracket top for single)
    expect(r.byAccount['Traditional IRA / 401k']).toBeLessThanOrEqual(44000 / 12);
  });
});

describe('guardrailSpend', () => {
  describe('rpr-80', () => {
    it('cuts to 6% when portfolio < 80% of starting', () => {
      const r = guardrailSpend(50000, 70000, 100000, 'rpr-80');
      expect(r.nextSpend).toBeCloseTo(0.06 * 70000, 0); // 6% of current value
      expect(r.policyState).toBe('cut');
      expect(r.cutRate).toBe(0.06);
    });

    it('stays at 6% until recovery above 80%', () => {
      let r = guardrailSpend(50000, 70000, 100000, 'rpr-80');
      expect(r.policyState).toBe('cut');
      r = guardrailSpend(r.nextSpend, 75000, 100000, 'rpr-80', {
        wasCut: true,
        originalSpend: 50000,
      });
      expect(r.policyState).toBe('cut');
      r = guardrailSpend(r.nextSpend, 85000, 100000, 'rpr-80', {
        wasCut: true,
        originalSpend: 50000,
      });
      expect(r.policyState).toBe('recovering'); // or 'normal'
      expect(r.nextSpend).toBeGreaterThan(0.06 * 85000); // back to normal rate
    });

    it('normal when portfolio >= 80%', () => {
      const r = guardrailSpend(50000, 90000, 100000, 'rpr-80');
      expect(r.nextSpend).toBe(50000);
      expect(r.policyState).toBe('normal');
    });
  });

  describe('guyton-klinger', () => {
    it('cuts when portfolio drops below lower guardrail', () => {
      const opts = { initialRate: 0.05, upperGuardrail: 0.06, lowerGuardrail: 0.04 };
      // Starting value 1M, initial rate 5% = 50000 initial spend
      // Portfolio dropped 20% to 800k, rate = 50000/800000 = 6.25% > upper (6%) → cut
      const r = guardrailSpend(50000, 800000, 1000000, 'guyton-klinger', opts);
      expect(r.nextSpend).toBeLessThan(50000); // cut by 10%
      expect(r.policyState).toBe('cut');
    });

    it('increases when portfolio above upper guardrail', () => {
      const opts = { initialRate: 0.05, upperGuardrail: 0.06, lowerGuardrail: 0.04 };
      // Portfolio up enough that rate < lower guardrail (4%)
      // 50000 / 1500000 = 0.0333 < 0.04
      const r = guardrailSpend(50000, 1500000, 1000000, 'guyton-klinger', opts);
      expect(r.nextSpend).toBeGreaterThan(50000); // increase by 10%
      expect(r.policyState).toBe('prosperity');
    });

    it('respects floor/ceiling', () => {
      const opts = { initialRate: 0.05, upperGuardrail: 0.06, lowerGuardrail: 0.04 };
      // Many cuts — should not go below floor (initialRate * 0.8) * startingValue
      let r = guardrailSpend(50000, 500000, 1000000, 'guyton-klinger', opts);
      for (let i = 0; i < 10; i++) {
        r = guardrailSpend(r.nextSpend, 400000, 1000000, 'guyton-klinger', opts);
      }
      // Floor = initialRate * 0.8 * startingValue = 0.05 * 0.8 * 1000000 = 40000
      expect(r.nextSpend).toBeGreaterThanOrEqual(1000000 * 0.05 * 0.8);
    });
  });

  describe('vpw', () => {
    it('returns age-based percentage', () => {
      const r = guardrailSpend(50000, 100000, 100000, 'vpw', { age: 70 });
      // VPW at 70 ~ 5-6%
      expect(r.nextSpend).toBeGreaterThan(0);
      expect(r.nextSpend / 100000).toBeGreaterThan(0.04);
      expect(r.nextSpend / 100000).toBeLessThan(0.1);
    });

    it('increases with age', () => {
      const r70 = guardrailSpend(50000, 100000, 100000, 'vpw', { age: 70 });
      const r80 = guardrailSpend(50000, 100000, 100000, 'vpw', { age: 80 });
      expect(r80.nextSpend).toBeGreaterThan(r70.nextSpend);
    });

    it('caps at 100% for very old ages', () => {
      const r = guardrailSpend(50000, 100000, 100000, 'vpw', { age: 110 });
      expect(r.nextSpend).toBeLessThanOrEqual(100000);
    });
  });
});
