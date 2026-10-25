import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://query1.finance.yahoo.com/**', route =>
    route.fulfill({
      json: {
        chart: {
          result: [
            {
              indicators: {
                adjclose: [
                  { adjclose: Array.from({ length: 500 }, (_, i) => 100 + Math.sin(i * 0.1) * 2) },
                ],
              },
            },
          ],
        },
      },
    })
  );
  await page.goto('/shannonsdemon/');
  await page.waitForSelector('#root');
});

test('Retirement tab shows inputs and computes metrics after analysis', async ({ page }) => {
  await page.click('button:has-text("Run Analysis")');
  await expect(page.getByText('Risk Parity Weights')).toBeVisible({ timeout: 15000 });
  await page.click('button:has-text("Retirement")');
  await expect(page.getByLabel(/Monthly spend/i)).toBeVisible();
  await expect(page.getByLabel(/Inflation rate/i)).toBeVisible();
  await expect(page.getByLabel(/Horizon.*years/i)).toBeVisible();
  await page.fill('#ret-monthly-spend', '4000');
  await page.click('button:has-text("Calculate")');
  await expect(page.getByText('Safe Withdrawal Rate (SWR)')).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('Perpetual Withdrawal Rate (PWR)')).toBeVisible();
  await expect(page.getByText('Success Probability')).toBeVisible();
});
