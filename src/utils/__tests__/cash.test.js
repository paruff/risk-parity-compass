import { describe, it, expect } from 'vitest';
import { CASH, holdingsValue, cashAfterTrades, generateTrades } from '../finance';
import { getMacroClass } from '../portfolios';

// Hand-computed: Taxable holds 100 SPY @ $500 = $50,000 and $10,000 cash; Roth holds 200 TLT @ $90 = $18,000.
const prices = { SPY: 500, TLT: 90 };
const holdings = {
  Taxable: { SPY: 100, [CASH]: 10_000 },
  'Roth IRA': { TLT: 200 },
};

describe('holdingsValue', () => {
  it('prices shares and adds cash at face value', () => {
    expect(holdingsValue(holdings.Taxable, prices)).toEqual({ invested: 50_000, cash: 10_000 });
    expect(holdingsValue(holdings['Roth IRA'], prices)).toEqual({ invested: 18_000, cash: 0 });
  });
  it('ignores unpriced tickers and negative cash', () => {
    expect(holdingsValue({ XYZ: 5, [CASH]: -5 }, prices)).toEqual({ invested: 0, cash: 0 });
  });
});

describe('cash in trades', () => {
  const target = { Taxable: { SPY: 45_000, TLT: 15_000 }, 'Roth IRA': { TLT: 18_000 } };
  const trades = generateTrades(holdings, target, prices, 78_000, 0.01);

  it('does not trade the cash row', () => {
    expect(trades.some(t => t.ticker === CASH)).toBe(false);
  });
  it('cash after trades = cash - buys + sells, per account', () => {
    // Taxable: sell $5,000 SPY, buy $15,000 TLT => 10,000 + 5,000 - 15,000 = 0
    expect(cashAfterTrades(holdings, trades).Taxable).toBeCloseTo(0, 2);
    expect(cashAfterTrades(holdings, trades)['Roth IRA']).toBe(0);
  });
  it('goes negative when buys exceed cash and sells', () => {
    const big = { Taxable: { SPY: 50_000, TLT: 20_000 } };
    const t = generateTrades(holdings, big, prices, 78_000, 0.01);
    expect(cashAfterTrades(holdings, t).Taxable).toBeCloseTo(-10_000, 2);
  });
});

describe('cashAfterTrades edge input', () => {
  it('treats negative stored cash as zero, matching holdingsValue', () => {
    expect(cashAfterTrades({ Taxable: { [CASH]: -500 } }, []).Taxable).toBe(0);
  });
});

describe('macro class', () => {
  it('maps cash and the new tickers', () => {
    expect(getMacroClass(CASH)).toBe('Cash');
    expect(getMacroClass('GOVZ')).toBe('US Long Bonds');
    expect(getMacroClass('AVUV')).toBe('US Equity');
    expect(getMacroClass('KBWP')).toBe('US Equity');
  });
});
