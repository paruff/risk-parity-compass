import { test, expect } from '@playwright/test';

const MOCK_CLOSES = Array.from({ length: 600 }, (_, i) => 100 + Math.sin(i * 0.1) * 2 + i * 0.03);
const MOCK_TIMESTAMPS = Array.from({ length: 600 }, (_, i) =>
  Math.floor((Date.now() - 600 * 30 * 24 * 60 * 60 * 1000 + i * 30 * 24 * 60 * 60 * 1000) / 1000)
);

test.beforeEach(async ({ page }) => {
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  await page.route('https://query1.finance.yahoo.com/**', route =>
    route.fulfill({
      json: {
        chart: {
          result: [
            {
              indicators: {
                adjclose: [
                  {
                    adjclose: Array.from(
                      { length: 600 },
                      (_, i) => 100 + Math.sin(i * 0.1) * 2 + i * 0.03
                    ),
                  },
                ],
              },
              timestamp: Array.from({ length: 600 }, (_, i) =>
                Math.floor(
                  (Date.now() - 600 * 30 * 24 * 60 * 60 * 1000 + i * 30 * 24 * 60 * 60 * 1000) /
                    1000
                )
              ),
            },
          ],
        },
      },
    })
  );
  await page.goto('/risk-parity-compass/');
  await page.waitForSelector('#root');
});

test('debug: minimal flow with logging', async ({ page }) => {
  await page.click('button:has-text("Run Analysis")');
  await expect(page.getByText('Risk Parity Weights')).toBeVisible({ timeout: 60000 });
  console.log('Analysis complete');

  await page.click('button:has-text("Retirement")');
  await expect(page.getByLabel(/Monthly spend/i)).toBeVisible({ timeout: 10000 });
  console.log('Retirement tab open');

  await page.fill('#ret-monthly-spend', '4000');
  await page.fill('#ret-horizon-years', '30');
  await page.fill('#ret-birth-year', '1960');
  await page.fill('#ret-inflation-rate', '0.03');
  console.log('Fields filled');

  await page.click('button:has-text("Calculate")');
  console.log('Calculate clicked');

  // Wait with longer timeout and check what happens
  const result = await Promise.race([
    page
      .getByText('Safe Withdrawal Rate (SWR)')
      .waitFor({ state: 'visible', timeout: 180000 })
      .then(() => 'SWR'),
    page
      .getByRole('alert')
      .waitFor({ state: 'visible', timeout: 180000 })
      .then(() => 'ERROR'),
    page.waitForTimeout(180000).then(() => 'TIMEOUT'),
  ]);

  console.log('Result:', result);

  if (result === 'SWR') {
    const swrText = await page
      .getByText('Safe Withdrawal Rate (SWR)')
      .locator('..')
      .locator('.sd-metricVal')
      .textContent();
    console.log('SWR:', swrText);
    expect(swrText).toMatch(/^\d+(\.\d+)?%$/);
    expect(swrText).not.toMatch(/NaN/);
  } else if (result === 'ERROR') {
    const errorText = await page.getByRole('alert').textContent();
    console.log('Error:', errorText);
  } else {
    console.log('Test timed out');
    // Take screenshot for debugging
    await page.screenshot({ path: 'debug-timeout.png', fullPage: true });
  }
});
