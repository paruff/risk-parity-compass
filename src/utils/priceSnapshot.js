// Bundled price snapshot. Yahoo Finance sends no CORS header, so the deployed site cannot call
// it from the browser; instead `scripts/update-prices.mjs` fetches prices server-side and writes
// one static JSON file per ticker under public/prices/, which the app reads from its own origin.

export const DAILY_POINTS = 504; // about two years of trading days

const TICKER = /^[A-Z0-9][A-Z0-9.-]{0,14}$/;

/** Turns Yahoo chart responses (daily 2y and monthly max) into the stored snapshot shape. */
export function buildSnapshot(ticker, dailyChart, monthlyChart, asOf) {
  const closesOf = chart => {
    const r = chart?.chart?.result?.[0];
    const closes = r?.indicators?.adjclose?.[0]?.adjclose ?? r?.indicators?.quote?.[0]?.close;
    if (!r || !closes) throw new Error(`No data for ${ticker}`);
    return { closes, timestamps: r.timestamp ?? [] };
  };
  const d = closesOf(dailyChart);
  const m = closesOf(monthlyChart);
  const monthly = m.timestamps
    .map((ts, i) => ({ date: new Date(ts * 1000).toISOString().slice(0, 7), close: m.closes[i] }))
    .filter(p => p.close != null);
  const daily = d.closes.filter(c => c != null).slice(-DAILY_POINTS);
  if (daily.length < 10 || monthly.length < 10)
    throw new Error(`Insufficient history for ${ticker}`);
  const round = x => Math.round(x * 10000) / 10000;
  return {
    ticker,
    asOf,
    daily: daily.map(round),
    monthly: { dates: monthly.map(p => p.date), closes: monthly.map(p => round(p.close)) },
  };
}

const cache = new Map();

export function snapshotUrl(ticker) {
  return new URL(`${import.meta.env.BASE_URL}prices/${ticker}.json`, globalThis.location.href).href;
}

/** Loads (and memoises) the bundled snapshot for one ticker. */
export function loadSnapshot(rawTicker) {
  const ticker = String(rawTicker).trim().toUpperCase();
  if (!TICKER.test(ticker)) return Promise.reject(new Error(`Invalid ticker ${rawTicker}`));
  if (!cache.has(ticker)) {
    cache.set(
      ticker,
      fetch(snapshotUrl(ticker)).then(async resp => {
        if (!resp.ok) {
          throw new Error(
            resp.status === 404
              ? `No bundled price data for ${ticker} (HTTP 404)`
              : `Failed to load prices for ${ticker}: HTTP ${resp.status}`
          );
        }
        // Some static servers answer unknown paths with index.html and a 200.
        return resp.json().catch(() => {
          throw new Error(`No bundled price data for ${ticker}`);
        });
      })
    );
    // Do not memoise failures: a later retry may succeed.
    cache.get(ticker).catch(() => cache.delete(ticker));
  }
  return cache.get(ticker);
}

export function clearSnapshotCache() {
  cache.clear();
}
