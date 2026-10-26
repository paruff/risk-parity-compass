// Versioned persistence, plan export/import, backup reminder.
export const STORAGE_KEY_V1 = 'shannonsdemon_v1';
export const STORAGE_KEY_V2 = 'shannonsdemon_v2';
const SCENARIOS_KEY_V1 = 'shannonsdemon_scenarios_v1';
const SCENARIOS_KEY_V2 = 'shannonsdemon_scenarios_v2';
const SCHEMA_VERSION = 2;
const APP_ID = 'shannonsdemon';
const BACKUP_DAYS = 30;
const SIZE_WARN_BYTES = 4 * 1024 * 1024; // localStorage is ~5MB

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // quota or private mode
  }
}

export function loadState() {
  const v2 = read(STORAGE_KEY_V2);
  if (v2) return v2;
  const v1 = read(STORAGE_KEY_V1);
  if (!v1 || typeof v1 !== 'object') return null;
  const migrated = { schemaVersion: SCHEMA_VERSION, ...v1 };
  write(STORAGE_KEY_V2, migrated); // v1 left in place as a backup
  return migrated;
}

export function saveState(state) {
  return write(STORAGE_KEY_V2, { ...state, schemaVersion: SCHEMA_VERSION });
}

export function loadScenarios() {
  const s = read(SCENARIOS_KEY_V2) ?? read(SCENARIOS_KEY_V1);
  return Array.isArray(s) ? s : [];
}

export function saveScenarios(scenarios) {
  return write(SCENARIOS_KEY_V2, scenarios);
}

export function exportPlan(state, scenarios = []) {
  return JSON.stringify(
    {
      app: APP_ID,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      state: { ...state, schemaVersion: SCHEMA_VERSION },
      scenarios,
    },
    null,
    2
  );
}

export function importPlan(json) {
  let doc;
  try {
    doc = JSON.parse(json);
  } catch {
    throw new Error('File is not valid JSON.');
  }
  if (doc?.app !== APP_ID) throw new Error('Not a Shannon’s Demon plan file.');
  if (doc.schemaVersion > SCHEMA_VERSION) {
    throw new Error(`Plan was saved by a newer version (schema ${doc.schemaVersion}).`);
  }
  const s = doc.state;
  if (!s || typeof s !== 'object' || Array.isArray(s)) throw new Error('Plan has no state.');
  if (
    s.tickers !== undefined &&
    !(Array.isArray(s.tickers) && s.tickers.every(t => typeof t === 'string'))
  ) {
    throw new Error('Plan tickers are invalid.');
  }
  if (s.accounts !== undefined && (typeof s.accounts !== 'object' || s.accounts === null)) {
    throw new Error('Plan accounts are invalid.');
  }
  if (
    s.learning !== undefined &&
    (typeof s.learning !== 'object' ||
      s.learning === null ||
      Array.isArray(s.learning) ||
      (s.learning.modules != null && typeof s.learning.modules !== 'object'))
  ) {
    throw new Error('Plan learning progress is invalid.');
  }
  const scenarios = doc.scenarios ?? [];
  if (!Array.isArray(scenarios)) throw new Error('Plan scenarios are invalid.');
  return { state: { ...s, schemaVersion: SCHEMA_VERSION }, scenarios };
}

export function storageBytes() {
  try {
    let n = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith('shannonsdemon_')) n += k.length + localStorage.getItem(k).length;
    }
    return n * 2; // UTF-16
  } catch {
    return 0;
  }
}

export function backupDue(lastBackupMs, now = Date.now()) {
  if (storageBytes() > SIZE_WARN_BYTES) return true;
  return lastBackupMs != null && now - lastBackupMs > BACKUP_DAYS * 864e5;
}

// Last good quote per ticker+lookback, so a Yahoo outage degrades to stale data, not failure.
const PRICE_CACHE_KEY = 'shannonsdemon_pricecache_v1';

export function getCachedQuote(ticker, lookback) {
  return read(PRICE_CACHE_KEY)?.[`${ticker}|${lookback}`] ?? null;
}

export function cacheQuote(quote, lookback, at = Date.now()) {
  const cache = read(PRICE_CACHE_KEY) ?? {};
  cache[`${quote.ticker}|${lookback}`] = { ...quote, at };
  write(PRICE_CACHE_KEY, cache);
}
