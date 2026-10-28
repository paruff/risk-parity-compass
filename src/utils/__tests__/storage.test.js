import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  STORAGE_KEY,
  loadState,
  saveState,
  loadScenarios,
  saveScenarios,
  exportPlan,
  importPlan,
  storageBytes,
  backupDue,
  getCachedQuote,
  cacheQuote,
} from '../storage';

// Node's own localStorage global shadows jsdom's; use an in-memory stand-in.
beforeEach(() => {
  const m = new Map();
  vi.stubGlobal('localStorage', {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    clear: () => m.clear(),
  });
  Object.defineProperty(localStorage, 'length', { get: () => m.size });
  localStorage.key = i => [...m.keys()][i];
});

describe('storage v2', () => {
  it('returns null when nothing is stored', () => {
    expect(loadState()).toBeNull();
  });

  it('saves with schemaVersion 2 under the v2 key', () => {
    saveState({ tickers: ['SPY'] });
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(raw).toEqual({ schemaVersion: 2, tickers: ['SPY'] });
  });

  it.each(['shannonsdemon_v1', 'shannonsdemon_v2'])(
    'migrates legacy %s and keeps it as a backup',
    legacyKey => {
      localStorage.setItem(legacyKey, JSON.stringify({ tickers: ['TLT'] }));
      expect(loadState()).toEqual({ schemaVersion: 2, tickers: ['TLT'] });
      expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
      expect(localStorage.getItem(legacyKey)).not.toBeNull();
    }
  );

  it('prefers the current key over legacy keys', () => {
    localStorage.setItem('shannonsdemon_v2', JSON.stringify({ tickers: ['OLD'] }));
    saveState({ tickers: ['NEW'] });
    expect(loadState().tickers).toEqual(['NEW']);
  });

  it('falls back to null on corrupt data', () => {
    localStorage.setItem(STORAGE_KEY, '{nope');
    localStorage.setItem('shannonsdemon_v1', '{nope');
    expect(loadState()).toBeNull();
  });

  it('migrates v1 scenarios', () => {
    localStorage.setItem('shannonsdemon_scenarios_v1', JSON.stringify([{ name: 'a' }]));
    expect(loadScenarios()).toEqual([{ name: 'a' }]);
    saveScenarios([{ name: 'b' }]);
    expect(loadScenarios()).toEqual([{ name: 'b' }]);
  });
});

describe('export / import', () => {
  it('accepts plan files exported under the old app id', () => {
    const json = JSON.stringify({
      app: 'shannonsdemon',
      schemaVersion: 2,
      state: { tickers: ['SPY'] },
    });
    expect(importPlan(json).state.tickers).toEqual(['SPY']);
  });

  it('exports under the current app id', () => {
    expect(JSON.parse(exportPlan({})).app).toBe('risk-parity-compass');
  });

  it('round-trips state and scenarios', () => {
    const json = exportPlan({ tickers: ['SPY'] }, [{ name: 'a' }]);
    expect(importPlan(json)).toEqual({
      state: { schemaVersion: 2, tickers: ['SPY'] },
      scenarios: [{ name: 'a' }],
    });
  });

  it.each([
    ['not json', 'nope'],
    ['wrong app', JSON.stringify({ app: 'x', schemaVersion: 2, state: {} })],
    ['future version', JSON.stringify({ app: 'shannonsdemon', schemaVersion: 99, state: {} })],
    ['missing state', JSON.stringify({ app: 'shannonsdemon', schemaVersion: 2 })],
    [
      'bad tickers',
      JSON.stringify({ app: 'shannonsdemon', schemaVersion: 2, state: { tickers: 'SPY' } }),
    ],
  ])('rejects %s', (_n, json) => {
    expect(() => importPlan(json)).toThrow();
  });
});

describe('backup reminder', () => {
  it('reports size and flags overdue backups', () => {
    saveState({ a: 'x'.repeat(100) });
    expect(storageBytes()).toBeGreaterThan(100);
    expect(backupDue(null, 0)).toBe(false);
    expect(backupDue(Date.now() - 31 * 864e5, Date.now())).toBe(true);
    expect(backupDue(Date.now() - 864e5, Date.now())).toBe(false);
  });
});

describe('price cache', () => {
  it('returns the last good quote with its timestamp', () => {
    expect(getCachedQuote('SPY', '1y')).toBeNull();
    cacheQuote({ ticker: 'SPY', closes: [1, 2], latestPrice: 2 }, '1y', 123);
    expect(getCachedQuote('SPY', '1y')).toEqual({
      ticker: 'SPY',
      closes: [1, 2],
      latestPrice: 2,
      at: 123,
    });
    expect(getCachedQuote('SPY', '3mo')).toBeNull();
  });
});

describe('learning progress in plan files', () => {
  const wrap = state => JSON.stringify({ app: 'shannonsdemon', schemaVersion: 2, state });

  it('round-trips learning state through export/import', () => {
    const learning = { rubricChoice: 3, modules: { cost: { attempts: 1, nextDue: 5 } } };
    const out = importPlan(exportPlan({ tickers: ['SPY'], learning }));
    expect(out.state.learning).toEqual(learning);
  });

  it('rejects malformed learning state', () => {
    expect(() => importPlan(wrap({ learning: 'x' }))).toThrow(/learning/i);
    expect(() => importPlan(wrap({ learning: [] }))).toThrow(/learning/i);
    expect(() => importPlan(wrap({ learning: { modules: 5 } }))).toThrow(/learning/i);
  });

  it('accepts plans saved before M6 (no learning key)', () => {
    expect(importPlan(wrap({ tickers: ['SPY'] })).state.learning).toBeUndefined();
  });
});
