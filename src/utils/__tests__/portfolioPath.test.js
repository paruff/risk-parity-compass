import { describe, it, expect } from 'vitest';
import { buildPortfolioPath } from '../portfolioPath';

describe('buildPortfolioPath', () => {
  it('weights by target weight, not by share price', () => {
    const path = buildPortfolioPath(
      { SPY: [600, 660], TLT: [85, 85] },
      { SPY: 0.5, TLT: 0.5 },
      100_000
    );
    expect(path[0]).toBeCloseTo(100_000, 0);
    expect(path[1]).toBeCloseTo(105_000, 0); // SPY +10% on half the portfolio
  });

  it('renormalises weights for tickers without history', () => {
    const path = buildPortfolioPath(
      { SPY: [100, 110], TLT: [50, 52] },
      { SPY: 0.5, TLT: 0.3, GLD: 0.2 },
      1000
    );
    // GLD has no history, weights renormalised to SPY=0.5/0.8=0.625, TLT=0.3/0.8=0.375
    expect(path[1]).toBeCloseTo(1000 * (0.625 * 1.1 + 0.375 * 1.04), 2);
  });

  it('returns empty array when no tickers have history', () => {
    const path = buildPortfolioPath({ GLD: [] }, { GLD: 1 }, 100000);
    expect(path).toEqual([]);
  });

  it('handles single ticker', () => {
    const path = buildPortfolioPath({ SPY: [100, 110, 121] }, { SPY: 1 }, 10000);
    expect(path[0]).toBe(10000);
    expect(path[1]).toBe(11000);
    expect(path[2]).toBe(12100);
  });
});
