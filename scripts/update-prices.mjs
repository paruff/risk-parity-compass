// Refreshes the bundled price snapshot in public/prices/ from Yahoo Finance's chart endpoint.
// Runs server-side (a developer machine or CI), where CORS does not apply. Yahoo's chart API is
// unofficial: be gentle (one request at a time with a pause) and stop at the first 429 instead of
// retrying. A ticker that fails keeps its previous file, so a partial run never loses data.
//
//   node scripts/update-prices.mjs            # refresh everything
//   node scripts/update-prices.mjs SPY TLT    # refresh only these tickers
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { buildSnapshot } from '../src/utils/priceSnapshot.js';
import { COMMON_ETFS } from '../src/utils/finance.js';
import { MACRO_CLASS_MAP, PORTFOLIO_TEMPLATES } from '../src/utils/portfolios.js';

const OUT = new URL('../public/prices/', import.meta.url);
const PAUSE_MS = 1500;
const HOST = 'https://query1.finance.yahoo.com/v8/finance/chart';

export const UNIVERSE = [
  ...new Set([
    'SPY',
    'TLT',
    'GLD',
    'VNQ',
    'EEM', // app defaults
    ...COMMON_ETFS,
    ...Object.keys(MACRO_CLASS_MAP),
    ...PORTFOLIO_TEMPLATES.flatMap(t => Object.keys(t.allocations)),
  ]),
].sort();

class RateLimited extends Error {}

async function chart(ticker, range, interval) {
  const resp = await fetch(`${HOST}/${ticker}?range=${range}&interval=${interval}&events=history`);
  if (resp.status === 429) throw new RateLimited(`HTTP 429 for ${ticker}`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${ticker}`);
  return resp.json();
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const wanted = process.argv.slice(2).map(t => t.toUpperCase());
  const tickers = wanted.length ? wanted : UNIVERSE;
  await mkdir(OUT, { recursive: true });
  const asOf = new Date().toISOString().slice(0, 10);
  const failed = [];
  let done = 0;
  for (const t of tickers) {
    try {
      const daily = await chart(t, '2y', '1d');
      await sleep(PAUSE_MS);
      const monthly = await chart(t, 'max', '1mo');
      const snap = buildSnapshot(t, daily, monthly, asOf);
      await writeFile(new URL(`${t}.json`, OUT), JSON.stringify(snap));
      done++;
    } catch (e) {
      failed.push(`${t}: ${e.message}`);
      if (e instanceof RateLimited) {
        console.error('Yahoo rate-limited this run; stopping. Existing files were kept.');
        break;
      }
    }
    await sleep(PAUSE_MS);
  }
  // index.json lists what the site can price, from the files actually on disk.
  const index = {};
  for (const t of UNIVERSE) {
    try {
      index[t] = JSON.parse(await readFile(new URL(`${t}.json`, OUT), 'utf8')).asOf;
    } catch {
      /* no file for this ticker yet */
    }
  }
  await writeFile(new URL('index.json', OUT), JSON.stringify({ updated: asOf, tickers: index }));
  console.log(`Updated ${done}/${tickers.length}; ${Object.keys(index).length} tickers on disk.`);
  if (failed.length) console.error(`Failed:\n  ${failed.join('\n  ')}`);
  process.exit(done === 0 ? 1 : 0);
}

main();
