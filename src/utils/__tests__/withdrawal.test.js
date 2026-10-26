import { describe, it, expect } from 'vitest';
import {
  drawdownPath,
  rollingWithdrawalRates,
  monteCarloWithWithdrawals,
  requiredMinimumDistribution,
  RMD_TABLE_VERSION,
  withdrawalSequence,
  guardrailSpend,
  netSpend,
} from '../withdrawal';

describe('drawdownPath', () => {
  // Oracle tests: expected values computed independently of the implementation
  // Flat 6% real growth, $1M, 30 years
  const g = 1.06 ** (1 / 12);
  const flat = Array.from({ length: 360 }, (_, i) => 1_000_000 * g ** i);

  it('compounds withdrawals: 7.2% spend depletes near year 28.25', () => {
    const r = drawdownPath(flat, 6000, {});
    expect(r.depletedYear).toBeCloseTo(28.25, 1);
    expect(r.terminalReal).toBe(0);
  });

  it('compounds withdrawals: 4% spend leaves the annuity value', () => {
    const r = drawdownPath(flat, 4000, {});
    expect(r.terminalReal).toBeCloseTo(1_817_618, -3);
  });

  it('never depletes when spend is below the sustainable rate', () => {
    // Sustainable rate is ~5893.70; use slightly less to ensure survival over 30y
    const r = drawdownPath(flat, 5800, {});
    expect(r.depletedYear).toBeNull();
  });

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
    // Buffer funded at month 0: 100000 - 48000 = 52000
    // First 12 months (indices 0-11) draw from buffer, portfolio stays at 52000
    expect(r.balances[0]).toBe(52000);
    expect(r.balances[11]).toBe(52000);
    // Month 12: buffer exhausted, portfolio draws
    expect(r.balances[12]).toBeLessThan(52000);
  });

  it('drawdownPath buffer refills when portfolio recovers after drawdown', () => {
    // Portfolio: grows, drops 20%, then recovers past previous peak
    const values = [
      1000000,
      1010000,
      1020000,
      1030000,
      1040000,
      1050000,
      1060000,
      1070000,
      1080000,
      1090000, // growth
      872000,
      906880,
      943155,
      980881,
      1020116,
      1060921,
      1103358,
      1147492,
      1193392,
      1241128, // drop 20%, recover 4%/month past peak
      1253539,
      1266074,
      1278735,
      1291522,
      1304438,
      1317482,
      1330657,
      1343963,
      1357403,
      1370977, // continued growth
    ];
    const r = drawdownPath(values, 5000, { inflationRate: 0, cashBufferMonths: 3 });
    // Buffer funded at month 0: 1M - 15k = 985k
    // Buffer lasts 3 months, then portfolio draws during drop
    // When portfolio recovers past 90% of peak, buffer should refill
    expect(r.bufferRefills).toBeGreaterThan(0);
    expect(r.bufferBalance).toBeGreaterThan(0);
  });

  it('drawdownPath buffer depletion forces portfolio withdrawal', () => {
    const values = Array.from({ length: 60 }, (_, i) => 100000); // flat
    const r = drawdownPath(values, 4000, { inflationRate: 0, cashBufferMonths: 3 });
    // Buffer funded at month 0: 100000 - 12000 = 88000
    // Buffer lasts 3 months (indices 0, 1, 2), portfolio stays at 88000
    expect(r.balances[0]).toBe(88000);
    expect(r.balances[2]).toBe(88000);
    // Month 3: buffer exhausted, portfolio draws
    expect(r.balances[3]).toBe(84000);
  });
});

describe('rollingWithdrawalRates', () => {
  // Oracle tests: honest success rate and available history
  const g = 1.06 ** (1 / 12);
  const flat = Array.from({ length: 360 }, (_, i) => 1_000_000 * g ** i);

  it('computes over available history instead of returning zeros', () => {
    const short = flat.slice(0, 263); // ~21.9 years
    const r = rollingWithdrawalRates(short, { horizonYears: 30 });
    expect(r.effectiveYears).toBeCloseTo(21.9, 1);
    expect(r.swr).toBeGreaterThan(0.06);
  });

  it('reports success at the user spend and counts multiple historical windows', () => {
    // The path rises for 15 years, then collapses; enough windows remain to show a mixed
    // historical success rate instead of the all-0/all-100 single-window behavior.
    const synthetic = Array.from({ length: 360 }, (_, i) => {
      const base = 150000 * (1.008 ** i);
      return i < 180 ? base : base * 0.8;
    });
    const r = rollingWithdrawalRates(synthetic, {
      horizonYears: 15,
      monthlySpend: 5000,
      inflationRate: 0,
    });
    expect(r.windowCount).toBeGreaterThan(1);
    expect(r.effectiveYears).toBe(15);
    expect(r.successRate).toBeGreaterThan(0);
    expect(r.successRate).toBeLessThan(1);
    expect(r.samples).toHaveLength(r.windowCount);
  });

  it('reports success at a fixed reference rate, not at the SWR', () => {
    const falling = flat.map((_, i) => flat[i] * (i > 200 ? 0.6 : 1));
    expect(rollingWithdrawalRates(falling, { referenceRate: 0.12 }).successRate).toBeLessThan(1);
    expect(rollingWithdrawalRates(flat, { referenceRate: 0.04 }).successRate).toBe(1);
  });

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
  // Oracle tests: Monte Carlo must run in dollars, not normalized
  const closes = { SPY: Array.from({ length: 300 }, (_, i) => 100 * 1.007 ** i) };
  const args = [closes, { SPY: 1 }, { SPY: 0.15 }, { SPY: { SPY: 1 } }];

  it('requires a starting value in dollars', () => {
    expect(() => monteCarloWithWithdrawals(...args, { simulations: 10, steps: 12 })).toThrow(
      'startingValue is required'
    );
  });

  it('succeeds with no spending', () => {
    const r = monteCarloWithWithdrawals(...args, {
      simulations: 50,
      steps: 120,
      startingValue: 1e6,
      monthlySpend: 0,
    });
    expect(r.successRate).toBe(1);
    expect(r.stats.median).toBeGreaterThan(1e6);
  });

  it('gets worse as spending rises', () => {
    const low = monteCarloWithWithdrawals(...args, {
      simulations: 200,
      steps: 240,
      startingValue: 1e6,
      monthlySpend: 2000,
    });
    const high = monteCarloWithWithdrawals(...args, {
      simulations: 200,
      steps: 240,
      startingValue: 1e6,
      monthlySpend: 9000,
    });
    expect(high.successRate).toBeLessThan(low.successRate);
    expect(high.successRate).toBeLessThan(1);
  });

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
      startingValue: 1e6,
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
      startingValue: 1e6,
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

  // Oracle tests for withdrawalSequence
  it('never truncates an RMD below its floor', () => {
    const r = withdrawalSequence(
      { Taxable: 100_000, 'Traditional IRA / 401k': 500_000, 'Roth IRA': 0 },
      1000,
      {
        bracketHeuristic: true,
        traditionalBracketCap: 500,
        rmdByAccount: { 'Traditional IRA / 401k': 2000 },
      }
    );
    expect(r.byAccount['Traditional IRA / 401k']).toBe(2000);
  });

  it('reports the RMD surplus so the columns foot', () => {
    const r = withdrawalSequence(
      { Taxable: 0, 'Traditional IRA / 401k': 500_000, 'Roth IRA': 0 },
      1000,
      { rmdByAccount: { 'Traditional IRA / 401k': 2500 } }
    );
    expect(r.totalSpend).toBe(2500);
    expect(r.rmdSurplus).toBe(1500);
  });
});

describe('guardrailSpend', () => {
  describe('rpr-80', () => {
    it('cuts to 6% when portfolio < 80% of starting', () => {
      const r = guardrailSpend(50000, 70000, 100000, 'rpr-80', { periodsPerYear: 1 });
      expect(r.nextSpend).toBeCloseTo(0.06 * 70000, 0); // 6% of current value
      expect(r.policyState).toBe('cut');
      expect(r.cutRate).toBe(0.06);
    });

    it('stays at 6% until recovery above 80%', () => {
      let r = guardrailSpend(50000, 70000, 100000, 'rpr-80', { periodsPerYear: 1 });
      expect(r.policyState).toBe('cut');
      r = guardrailSpend(r.nextSpend, 75000, 100000, 'rpr-80', {
        wasCut: true,
        originalSpend: 50000,
        periodsPerYear: 1,
      });
      expect(r.policyState).toBe('cut');
      r = guardrailSpend(r.nextSpend, 85000, 100000, 'rpr-80', {
        wasCut: true,
        originalSpend: 50000,
        periodsPerYear: 1,
      });
      expect(r.policyState).toBe('recovering'); // or 'normal'
      expect(r.nextSpend).toBeGreaterThan(0.06 * 85000); // back to normal rate
    });

    it('normal when portfolio >= 80%', () => {
      const r = guardrailSpend(50000, 90000, 100000, 'rpr-80', { periodsPerYear: 1 });
      expect(r.nextSpend).toBe(50000);
      expect(r.policyState).toBe('normal');
    });
  });

  describe('guyton-klinger', () => {
    it('cuts when portfolio drops below lower guardrail', () => {
      const opts = {
        initialRate: 0.05,
        upperGuardrail: 0.06,
        lowerGuardrail: 0.04,
        periodsPerYear: 1,
        step: 1,
      };
      // Starting value 1M, initial rate 5% = 50000 initial spend
      // Portfolio dropped 20% to 800k, rate = 50000/800000 = 6.25% > upper (6%) → cut
      const r = guardrailSpend(50000, 800000, 1000000, 'guyton-klinger', opts);
      expect(r.nextSpend).toBeLessThan(50000); // cut by 10%
      expect(r.policyState).toBe('cut');
    });

    it('increases when portfolio above upper guardrail', () => {
      const opts = {
        initialRate: 0.05,
        upperGuardrail: 0.06,
        lowerGuardrail: 0.04,
        periodsPerYear: 1,
        step: 1,
      };
      // Portfolio up enough that rate < lower guardrail (4%)
      // 50000 / 1500000 = 0.0333 < 0.04
      const r = guardrailSpend(50000, 1500000, 1000000, 'guyton-klinger', opts);
      expect(r.nextSpend).toBeGreaterThan(50000); // increase by 10%
      expect(r.policyState).toBe('prosperity');
    });

    it('respects floor/ceiling', () => {
      const opts = {
        initialRate: 0.05,
        upperGuardrail: 0.06,
        lowerGuardrail: 0.04,
        periodsPerYear: 1,
        step: 1,
      };
      // Many cuts — should not go below floor (initialRate * 0.8) * startingValue
      let r = guardrailSpend(50000, 500000, 1000000, 'guyton-klinger', opts);
      for (let i = 0; i < 10; i++) {
        r = guardrailSpend(r.nextSpend, 400000, 1000000, 'guyton-klinger', {
          ...opts,
          gkState: r.gkState,
        });
      }
      // Floor = initialRate * 0.8 * startingValue = 0.05 * 0.8 * 1000000 = 40000
      expect(r.nextSpend).toBeGreaterThanOrEqual(1000000 * 0.05 * 0.8);
    });
  });

  describe('vpw', () => {
    it('returns age-based percentage', () => {
      const r = guardrailSpend(50000, 100000, 100000, 'vpw', { age: 70, periodsPerYear: 12 });
      // VPW at 70 ~ 5.1% annual = ~0.425% monthly
      expect(r.nextSpend).toBeGreaterThan(0);
      expect(r.nextSpend / 100000).toBeGreaterThan(0.004);
      expect(r.nextSpend / 100000).toBeLessThan(0.01);
    });

    it('increases with age', () => {
      const r70 = guardrailSpend(50000, 100000, 100000, 'vpw', { age: 70, periodsPerYear: 12 });
      const r80 = guardrailSpend(50000, 100000, 100000, 'vpw', { age: 80, periodsPerYear: 12 });
      expect(r80.nextSpend).toBeGreaterThan(r70.nextSpend);
    });

    it('caps at 100% of portfolio per period for very old ages', () => {
      const r = guardrailSpend(50000, 100000, 100000, 'vpw', { age: 110, periodsPerYear: 12 });
      // Cap is portfolioValue / periodsPerYear = 100000/12 ≈ 8333
      expect(r.nextSpend).toBeLessThanOrEqual(100000 / 12);
    });
  });
});

describe('guardrailSpend oracle tests (realistic scale)', () => {
  it('rpr-80 trip never raises spend at 3%, 4%, or 5% starting rates', () => {
    const startingValue = 1_000_000;
    const tripValue = 790_000;
    const expectedCap = (0.06 / 12) * tripValue; // 3950
    const scenarios = [
      { currentSpend: (startingValue * 0.03) / 12 },
      { currentSpend: (startingValue * 0.04) / 12 },
      { currentSpend: (startingValue * 0.05) / 12 },
    ];

    scenarios.forEach(({ currentSpend }) => {
      const r = guardrailSpend(currentSpend, tripValue, startingValue, 'rpr-80', {
        periodsPerYear: 12,
      });
      expect(r.nextSpend).toBeCloseTo(Math.min(currentSpend, expectedCap), 6);
      expect(r.nextSpend).toBeLessThanOrEqual(currentSpend);
      expect(r.policyState).toBe('cut');
    });
  });

  it('rpr-80 cuts spending when the portfolio falls below 80%', () => {
    const r = guardrailSpend(4000, 790_000, 1_000_000, 'rpr-80', { periodsPerYear: 12 });
    // 6% annual of 790k = 47400/year = 3950/month
    expect(r.nextSpend).toBeCloseTo(3950, 0);
    expect(r.nextSpend).toBeLessThan(4000);
  });

  it('guyton-klinger does not raise spending at a sustainable rate', () => {
    const r = guardrailSpend(4000, 1_000_000, 1_000_000, 'guyton-klinger', {
      periodsPerYear: 12,
      initialRate: 0.048,
    });
    expect(r.nextSpend).toBe(4000);
    expect(r.policyState).toBe('normal');
  });

  it('vpw tracks the age percentage', () => {
    const r = guardrailSpend(4000, 1_000_000, 1_000_000, 'vpw', { age: 70, periodsPerYear: 12 });
    // VPW at 70 ~ 5.1% annual
    expect(r.nextSpend).toBeCloseTo((1_000_000 * 0.051) / 12, 0);
  });

  it('never spends more than the portfolio in a period', () => {
    const r = guardrailSpend(4000, 1000, 1_000_000, 'rpr-80', { periodsPerYear: 12 });
    expect(r.nextSpend).toBeLessThanOrEqual(1000);
  });
});

describe('drawdownPath with guardrails', () => {
  it('drawdownPath with rpr-80 reduces spend after drop', () => {
    const values = Array.from({ length: 60 }, (_, i) => (i < 12 ? 100000 : 70000)); // drop at month 12
    const r = drawdownPath(values, 5000, { guardrail: 'rpr-80' });
    // Spend drops from 5000 to 4200 after month 12 (guardrail triggers at 70% < 80%)
    // Balance decline should SLOW DOWN, not reverse
    const declineBefore = r.balances[11] - r.balances[12]; // month 11->12
    const declineAfter = r.balances[12] - r.balances[13]; // month 12->13 (guardrail active)
    expect(declineAfter).toBeLessThan(declineBefore); // slower decline
    expect(r.balances[12]).toBeGreaterThan(r.balances[13]); // still declining
  });
});

describe('monteCarloWithWithdrawals with guardrails', () => {
  it('guardrail affects successRate', () => {
    const allCloses = { SPY: Array.from({ length: 200 }, (_, i) => 100 * 1.005 ** i) };
    const weights = { SPY: 1 };
    const vols = { SPY: 0.15 };
    const corr = { SPY: { SPY: 1 } };
    const base = monteCarloWithWithdrawals(allCloses, weights, vols, corr, {
      simulations: 200,
      steps: 120,
      monthlySpend: 400,
      guardrail: 'none',
      seed: 1,
      startingValue: 1e6,
    });
    const guarded = monteCarloWithWithdrawals(allCloses, weights, vols, corr, {
      simulations: 200,
      steps: 120,
      monthlySpend: 400,
      guardrail: 'rpr-80',
      seed: 1,
      startingValue: 1e6,
    });
    expect(guarded.successRate).toBeGreaterThanOrEqual(base.successRate);
  });
});

describe('monteCarloWithWithdrawals guardrail oracles (realistic scale)', () => {
  const run = (growth, vol, guardrail, extra = {}) => {
    const allCloses = { SPY: Array.from({ length: 200 }, (_, i) => 100 * growth ** i) };
    return monteCarloWithWithdrawals(
      allCloses,
      { SPY: 1 },
      { SPY: vol },
      { SPY: { SPY: 1 } },
      {
        simulations: 100,
        steps: 240,
        monthlySpend: 4000,
        inflationRate: 0.03,
        guardrail,
        seed: 7,
        startingValue: 1_000_000,
        ...extra,
      }
    );
  };

  it('a guardrail that never trips spends exactly what the static policy spends', () => {
    // ~12.7%/yr drift vs 4.8%/yr spend at $1M: portfolio never falls below 80% of start.
    const stat = run(1.01, 0.01, 'none');
    const guarded = run(1.01, 0.01, 'rpr-80');
    expect(Math.min(...stat.bands.p10)).toBeGreaterThan(0.8 * 1_000_000);
    expect(Array.from(guarded.terminalValues)).toEqual(Array.from(stat.terminalValues));
  });

  it('in a falling market the rpr-80 cut keeps the portfolio alive where static spend depletes it', () => {
    // -11%/yr drift, $4,000/mo (8%/yr) from $600k: static spend must deplete.
    const stat = run(0.99, 0.02, 'none', { startingValue: 600_000 });
    const guarded = run(0.99, 0.02, 'rpr-80', { startingValue: 600_000 });
    expect(stat.successRate).toBe(0);
    expect(guarded.successRate).toBe(1); // spending 0.5%/month of balance cannot reach zero
    expect(guarded.stats.median).toBeGreaterThan(0);
  });

  it('vpw runs through the simulation when an age is supplied', () => {
    const r = run(1.005, 0.1, 'vpw', { age: 65 });
    expect(r.successRate).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(r.stats.median)).toBe(true);
  });
});

describe('netSpend', () => {
  it('subtracts SS when active', () => {
    const r = netSpend(5000, 2000, 0, 67, 0, 70);
    expect(r.netMonthlySpend).toBe(3000);
    expect(r.ssActive).toBe(true);
    expect(r.bridgeYears).toBe(0);
  });

  it('shows bridge years before SS starts', () => {
    const r = netSpend(5000, 2000, 0, 67, 0, 62);
    expect(r.netMonthlySpend).toBe(5000); // SS not started
    expect(r.ssActive).toBe(false);
    expect(r.bridgeYears).toBe(5);
  });

  it('handles both SS and pension', () => {
    const r = netSpend(5000, 2000, 1500, 67, 65, 70);
    expect(r.netMonthlySpend).toBe(1500);
    expect(r.ssActive).toBe(true);
    expect(r.pensionActive).toBe(true);
  });
});
