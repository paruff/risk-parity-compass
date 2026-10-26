import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const MOCK_CLOSES = Array.from({ length: 600 }, (_, i) => 100 + Math.sin(i * 0.1) * 5 + i * 0.03);
const MOCK_TIMESTAMPS = Array.from({ length: 600 }, (_, i) =>
  Math.floor((Date.now() - 600 * 30 * 24 * 60 * 60 * 1000 + i * 30 * 24 * 60 * 60 * 1000) / 1000)
);

test.describe.configure({ timeout: 120000 });

async function clickRetirementCalculate(page) {
  await page.locator('#panel-retirement button').filter({ hasText: /^▶ Calculate$/ }).click();
}

test.beforeEach(async ({ page }) => {
  await page.route('https://query1.finance.yahoo.com/**', route =>
    route.fulfill({
      json: {
        chart: {
          result: [{ indicators: { adjclose: [{ adjclose: MOCK_CLOSES }] }, timestamp: MOCK_TIMESTAMPS }],
        },
      },
    })
  );
  await page.goto('/risk-parity-compass/');
  await page.waitForSelector('#root');
});

test.describe('Accessibility', () => {
  test('no violations on holdings tab', async ({ page }) => {
    await page.click('button:has-text("Current Holdings")');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('no violations on analysis tab after run', async ({ page }) => {
    await page.click('button:has-text("Run Analysis")');
    await expect(page.locator('text=Risk Parity Weights')).toBeVisible({ timeout: 15000 });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('no violations on retirement tab after calculation', async ({ page }) => {
    await page.click('button:has-text("Run Analysis")');
    await expect(page.locator('text=Risk Parity Weights')).toBeVisible({ timeout: 15000 });
    await page.click('button:has-text("Retirement")');
    await page.fill('#ret-monthly-spend', '4000');
    await page.fill('#ret-horizon-years', '30');
    await page.fill('#ret-birth-year', '1960');
    await page.fill('#ret-inflation-rate', '0.03');
    await clickRetirementCalculate(page);
    await expect(page.getByText('Safe Withdrawal Rate (SWR)')).toBeVisible({ timeout: 120000 });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
