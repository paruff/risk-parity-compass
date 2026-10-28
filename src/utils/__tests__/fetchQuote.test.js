import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { fetchQuote, fetchMonthlyHistory } from '../finance';
import { clearSnapshotCache } from '../priceSnapshot';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { handlers } from '../../mocks/handlers';

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => clearSnapshotCache());
afterEach(() => server.resetHandlers());

describe('fetchQuote (bundled snapshot)', () => {
  it('returns closes, latest price and snapshot date for a bundled ticker', async () => {
    const result = await fetchQuote('SPY', '1y');
    expect(result.ticker).toBe('SPY');
    expect(result.closes).toHaveLength(252);
    expect(result.latestPrice).toBe(result.closes[251]);
    expect(result.asOf).toBe('2026-10-28');
  });
  it('slices the lookback window from the end of the series', async () => {
    expect((await fetchQuote('SPY', '3mo')).closes).toHaveLength(63);
    expect((await fetchQuote('SPY', '2y')).closes).toHaveLength(400); // snapshot has 400
  });
  it('is case-insensitive and rejects malformed tickers without a request', async () => {
    expect((await fetchQuote('spy', '1y')).ticker).toBe('SPY');
    await expect(fetchQuote('../etc', '1y')).rejects.toThrow('Invalid ticker');
  });
  it('explains a ticker that is not bundled', async () => {
    await expect(fetchQuote('INVALID', '1y')).rejects.toThrow('No bundled price data for INVALID');
  });
  it('treats an HTML fallback page served with 200 as missing data', async () => {
    server.use(http.get('*/prices/FALLBACK.json', () => new HttpResponse('<html></html>')));
    await expect(fetchQuote('FALLBACK', '1y')).rejects.toThrow('No bundled price data');
  });
  it('reports other HTTP failures and retries later instead of memoising them', async () => {
    await expect(fetchQuote('RATELIMIT', '1y')).rejects.toThrow('429');
    await expect(fetchQuote('RATELIMIT', '1y')).rejects.toThrow('429');
  });
});

describe('fetchMonthlyHistory (bundled snapshot)', () => {
  it('returns aligned dates and closes', async () => {
    const h = await fetchMonthlyHistory('VTI');
    expect(h.dates).toHaveLength(240);
    expect(h.dates[0]).toBe('2006-01');
    expect(h.closes).toHaveLength(h.dates.length);
  });
});
