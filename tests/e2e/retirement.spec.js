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
  await page.goto('/risk-parity-compass/');
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

test('Retirement tab shows RMD table for traditional accounts', async ({ page }) => {
  await page.click('button:has-text("Run Analysis")');
  await expect(page.getByText('Risk Parity Weights')).toBeVisible({ timeout: 15000 });
  await page.click('button:has-text("Retirement")');
  // Wait for the Retirement Parameters card to be visible
  await expect(page.getByText('Retirement Parameters')).toBeVisible({ timeout: 5000 });
  // Find the birth year input by its id
  await expect(page.locator('#ret-birth-year')).toBeVisible({ timeout: 10000 });
  await page.locator('#ret-birth-year').fill('1955');
  await page.click('button:has-text("Calculate")');
  await expect(page.getByText(/Required Minimum Distribution/i)).toBeVisible({ timeout: 5000 });
  // Check that the RMD table has rows (at least one row with age data)
  await expect(page.locator('table.sd-table tbody tr').first()).toBeVisible();
  await expect(page.getByText(/Distribution period/i)).toBeVisible();
});

test('Retirement tab shows withdrawal sequencing by account', async ({ page }) => {
  await page.click('button:has-text("Run Analysis")');
  await expect(page.getByText('Risk Parity Weights')).toBeVisible({ timeout: 15000 });
  await page.click('button:has-text("Retirement")');
  await page.fill('#ret-monthly-spend', '5000');
  await page.click('button:has-text("Calculate")');
  await expect(page.getByText(/Withdrawal sequencing/i)).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('columnheader', { name: /Taxable Withdrawal/i })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /Traditional Withdrawal/i })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /Roth Withdrawal/i })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Taxable' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Traditional IRA / 401k' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Roth IRA' })).toBeVisible();
});
