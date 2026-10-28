import { test, expect } from '@playwright/test';

// No mocks: proves the site prices real tickers from the bundled snapshot in public/prices/.
// Skipped while no snapshot has been generated (`npm run prices:update`); the post-deploy job
// sets REQUIRE_REAL_PRICES=1 so a deploy without data fails instead of skipping.
test('Run Analysis prices the default tickers from the bundled snapshot', async ({
  page,
  request,
}) => {
  const index = await request.get('/risk-parity-compass/prices/index.json');
  const hasIndex = index.ok() && (index.headers()['content-type'] ?? '').includes('json');
  if (!process.env.REQUIRE_REAL_PRICES) {
    test.skip(!hasIndex, 'no bundled snapshot yet (run npm run prices:update)');
  }
  expect(hasIndex, 'prices/index.json must be published').toBe(true);

  const problems = [];
  page.on('console', m => {
    if (/CORS|Content Security Policy|Failed to load resource/i.test(m.text()))
      problems.push(m.text().slice(0, 160));
  });
  await page.goto('/risk-parity-compass/');
  await page.click('button:has-text("Run Analysis")');
  await expect(page.locator('text=Risk Parity Weights')).toBeVisible({ timeout: 60000 });
  await expect(page.locator('td:has-text("SPY")').first()).toBeVisible();
  expect(problems).toEqual([]);
});
