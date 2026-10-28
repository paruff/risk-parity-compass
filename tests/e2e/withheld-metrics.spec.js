import { test, expect } from '@playwright/test';

// 10 years of monthly history: shorter than the default 30y horizon.
const CLOSES = Array.from({ length: 120 }, (_, i) => 100 + Math.sin(i * 0.1) * 2 + i * 0.03);
const TIMESTAMPS = Array.from({ length: 120 }, (_, i) =>
  Math.floor((Date.now() - 120 * 30 * 24 * 60 * 60 * 1000 + i * 30 * 24 * 60 * 60 * 1000) / 1000)
);

test('SWR/PWR/success are withheld with the reason when history is short', async ({ page }) => {
  await page.route('https://query1.finance.yahoo.com/**', route =>
    route.fulfill({
      json: {
        chart: {
          result: [{ indicators: { adjclose: [{ adjclose: CLOSES }] }, timestamp: TIMESTAMPS }],
        },
      },
    })
  );
  await page.goto('/risk-parity-compass/');
  await page.waitForSelector('#root');
  await page.click('button:has-text("Run Analysis")');
  await expect(page.getByText('Risk Parity Weights')).toBeVisible({ timeout: 60000 });
  await page.getByRole('tab', { name: /Retirement/ }).click();
  await page
    .locator('#panel-retirement button')
    .filter({ hasText: /^▶ Calculate$/ })
    .click();
  await expect(page.getByTestId('history-windows')).toContainText(/needs ≥ 30\.9 years; have/, {
    timeout: 60000,
  });
  await expect(page.getByTestId('history-windows')).toContainText('Historical windows:');
  for (const id of ['metric-swr', 'metric-pwr', 'metric-success'])
    await expect(page.getByTestId(id)).toHaveText('—');
});
