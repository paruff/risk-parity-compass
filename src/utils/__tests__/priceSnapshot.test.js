import { describe, it, expect } from 'vitest';
import { buildSnapshot, DAILY_POINTS } from '../priceSnapshot';

const chart = (closes, timestamps) => ({
  chart: { result: [{ timestamp: timestamps, indicators: { adjclose: [{ adjclose: closes }] } }] },
});
const days = n => Array.from({ length: n }, (_, i) => 100 + i);
const months = n => Array.from({ length: n }, (_, i) => Date.UTC(2000, i, 15) / 1000);

describe('buildSnapshot', () => {
  it('keeps the last two years of daily closes and dates the monthly series', () => {
    const s = buildSnapshot(
      'SPY',
      chart(days(600)),
      chart(
        days(24).map(x => x * 2),
        months(24)
      ),
      '2026-10-28'
    );
    expect(s.daily).toHaveLength(DAILY_POINTS);
    expect(s.daily.at(-1)).toBe(699);
    expect(s.monthly.dates[0]).toBe('2000-01');
    expect(s.monthly.dates[13]).toBe('2001-02');
    expect(s.monthly.closes[1]).toBe(202);
    expect(s.asOf).toBe('2026-10-28');
  });
  it('drops null closes from both series', () => {
    const d = days(30);
    d[5] = null;
    const m = days(20);
    m[3] = null;
    const s = buildSnapshot('X', chart(d), chart(m, months(20)), 'd');
    expect(s.daily).toHaveLength(29);
    expect(s.monthly.dates).toHaveLength(19);
    expect(s.monthly.dates).not.toContain('2000-04');
  });
  it('throws on missing data or too little history', () => {
    expect(() =>
      buildSnapshot('X', { chart: { result: null } }, chart(days(20), months(20)), 'd')
    ).toThrow('No data for X');
    expect(() => buildSnapshot('X', chart(days(5)), chart(days(20), months(20)), 'd')).toThrow(
      'Insufficient history'
    );
  });
});
