import { test, expect } from '@playwright/test';
import { mockPrices } from './helpers/mockPrices.js';

const MOCK_CLOSES = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i * 0.1) * 5);

test.beforeEach(async ({ page }) => {
  await mockPrices(page, MOCK_CLOSES);
  await page.goto('/risk-parity-compass/');
  await page.waitForSelector('#root');
  await page.click('button:has-text("Current Holdings")');
});

test.describe('Cash tracking', () => {
  test('cash counts toward tracked total, reconciles to the balance and persists', async ({
    page,
  }) => {
    await page.fill('#cash-Taxable', '10000');
    // Taxable balance is $50,000 by default: $10,000 entered, $40,000 not yet entered.
    await expect(page.locator('text=$40,000 of the balance not entered')).toBeVisible();
    await expect(page.locator('text=Total tracked (incl. cash)')).toBeVisible();
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem('rpcompass_state') || '{}')?.currentHoldings?.Taxable
          ?.CASH === 10000
    );
    await page.reload();
    await page.waitForSelector('#root');
    await page.click('button:has-text("Current Holdings")');
    await expect(page.locator('#cash-Taxable')).toHaveValue('10000');
  });

  test('trades show cash left after buys', async ({ page }) => {
    await page.fill('#cash-Taxable', '50000');
    await page.click('button:has-text("Run Analysis")');
    await expect(page.locator('text=Risk Parity Weights')).toBeVisible({ timeout: 15000 });
    await page.click('button:has-text("Trades")');
    await expect(page.locator('text=/Cash after trades: -?\\$[\\d,.]+/').first()).toBeVisible();
  });
});
