// Serves the bundled price snapshot shape for every ticker, so specs never depend on the
// real files in public/prices/. `closes` become the daily series; the monthly series reuses
// them with `timestamps` (seconds) when given, else with one month per point ending now.
export async function mockPrices(page, closes, timestamps) {
  const stamps =
    timestamps ??
    Array.from({ length: closes.length }, (_, i) =>
      Math.floor((Date.now() - (closes.length - i) * 30 * 864e5) / 1000)
    );
  const dates = stamps.map(ts => new Date(ts * 1000).toISOString().slice(0, 7));
  await page.route('**/risk-parity-compass/prices/*.json', route => {
    const ticker = route.request().url().split('/').pop().replace('.json', '');
    return route.fulfill({
      json: {
        ticker,
        asOf: '2026-10-28',
        daily: closes,
        monthly: { dates, closes },
      },
    });
  });
}
