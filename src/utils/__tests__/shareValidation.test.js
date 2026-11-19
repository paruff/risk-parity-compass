import { describe, it, expect } from 'vitest';
import { CASH, validateAccount, positionDrift } from '../finance';

// Hand-computed at realistic scale: $250,000 Taxable balance.
const prices = { SPY: 500, TLT: 90 };

describe('validateAccount', () => {
  it('prices each position and its weight of the balance; no warning within 5%', () => {
    // 400 SPY = 200,000 (0.80); 400 TLT = 36,000 (0.144); cash 10,000 (0.04) => 246,000, gap 4,000 = 1.6%
    const r = validateAccount({ SPY: 400, TLT: 400, [CASH]: 10_000 }, prices, 250_000);
    expect(r.positions).toEqual([
      { ticker: 'SPY', value: 200_000, weight: 0.8 },
      { ticker: 'TLT', value: 36_000, weight: 0.144 },
    ]);
    expect(r.gap).toBe(4_000);
    expect(r.gapPct).toBeCloseTo(0.016, 10);
    expect(r.warn).toBe(false);
  });
  it('flags a 10x typo: 4000 SPY = 2,000,000 vs 250,000 balance', () => {
    const r = validateAccount({ SPY: 4000 }, prices, 250_000);
    expect(r.gap).toBe(-1_750_000);
    expect(r.warn).toBe(true);
  });
  it('flags a stale count 20% short', () => {
    // 320 SPY = 160,000 vs 250,000 => gap 90,000 = 36%
    expect(validateAccount({ SPY: 320 }, prices, 250_000).warn).toBe(true);
  });
  it('tolerance edge: exactly 5% off is quiet, just over warns', () => {
    // 237.5 SPY = 118,750 vs 125,000 => gap 6,250 = exactly 5%; 237 SPY = 118,500 => 5.2%
    expect(validateAccount({ SPY: 237.5 }, prices, 125_000).warn).toBe(false);
    expect(validateAccount({ SPY: 237 }, prices, 125_000).warn).toBe(true);
  });
  it('does not warn on an empty account or when no balance is stated', () => {
    expect(validateAccount({}, prices, 250_000).warn).toBe(false);
    expect(validateAccount({ SPY: 10 }, prices, 0).warn).toBe(false);
  });
});

describe('validateAccount without a stated balance', () => {
  it('weighs positions against what is held, including cash', () => {
    // 100 SPY = 50,000 + 10,000 cash => SPY weight 50,000 / 60,000
    const r = validateAccount({ SPY: 100, [CASH]: 10_000 }, prices, 0);
    expect(r.positions[0].weight).toBeCloseTo(5 / 6, 10);
  });
});

describe('positionDrift', () => {
  it('flags positions more than 10 points from target', () => {
    // total 100,000: SPY 60,000 (0.60) vs 0.45 => +0.15 warn; TLT 40,000 (0.40) vs 0.55 => -0.15 warn
    const r = positionDrift({ SPY: 60_000, TLT: 40_000 }, 0, { SPY: 0.45, TLT: 0.55 });
    expect(r.map(p => [p.ticker, p.weight, p.delta, p.warn])).toEqual([
      ['SPY', 0.6, expect.closeTo(0.15, 10), true],
      ['TLT', 0.4, expect.closeTo(-0.15, 10), true],
    ]);
  });
  it('counts cash in the denominator', () => {
    // SPY 45,000 of 45,000 + 55,000 cash = 0.45 on a 0.45 target: no drift
    const [spy] = positionDrift({ SPY: 45_000 }, 55_000, { SPY: 0.45 });
    expect(spy.weight).toBeCloseTo(0.45, 10);
    expect(spy.target).toBe(0.45);
    expect(spy.warn).toBe(false);
  });
  it('is quiet within threshold and with nothing held', () => {
    expect(
      positionDrift({ SPY: 50_000, TLT: 50_000 }, 0, { SPY: 0.45, TLT: 0.55 }).some(p => p.warn)
    ).toBe(false);
    expect(positionDrift({}, 0, { SPY: 1 })).toEqual([]);
  });
});
