import { test, expect } from '@playwright/test';
import { mockPrices } from './helpers/mockPrices.js';

const MOCK_CLOSES = Array.from({ length: 600 }, (_, i) => 100 + Math.sin(i * 0.1) * 2 + i * 0.03);
const MOCK_TIMESTAMPS = Array.from({ length: 600 }, (_, i) =>
  Math.floor((Date.now() - 600 * 30 * 24 * 60 * 60 * 1000 + i * 30 * 24 * 60 * 60 * 1000) / 1000)
);

test.describe.configure({ timeout: 120000 });

async function clickRetirementCalculate(page) {
  await page
    .locator('#panel-retirement button')
    .filter({ hasText: /^▶ Calculate$/ })
    .click();
}

test.beforeEach(async ({ page }) => {
  await mockPrices(page, MOCK_CLOSES, MOCK_TIMESTAMPS);
  await page.goto('/risk-parity-compass/');
  await page.waitForSelector('#root');
});

test('Run Analysis produces results', async ({ page }) => {
  await page.click('button:has-text("Run Analysis")');
  await expect(page.getByText('Risk Parity Weights')).toBeVisible({ timeout: 60000 });
});

test('Retirement tab shows inputs after analysis', async ({ page }) => {
  await page.click('button:has-text("Run Analysis")');
  await expect(page.getByText('Risk Parity Weights')).toBeVisible({ timeout: 60000 });
  await page.click('button:has-text("Retirement")');
  await expect(page.getByLabel(/Monthly spend/i)).toBeVisible({ timeout: 10000 });
  await expect(page.getByLabel(/Inflation rate/i)).toBeVisible();
  await expect(page.getByLabel(/Horizon.*years/i)).toBeVisible();
});

test('Calculate retirement metrics shows SWR', async ({ page }) => {
  await page.click('button:has-text("Run Analysis")');
  await expect(page.getByText('Risk Parity Weights')).toBeVisible({ timeout: 60000 });
  await page.click('button:has-text("Retirement")');

  await page.fill('#ret-monthly-spend', '4000');
  await page.fill('#ret-horizon-years', '30');
  await page.fill('#ret-birth-year', '1960');
  await page.fill('#ret-inflation-rate', '0.03');

  await clickRetirementCalculate(page);

  await expect(page.getByText('Safe Withdrawal Rate (SWR)')).toBeVisible({ timeout: 120000 });

  const swrText = await page
    .getByText('Safe Withdrawal Rate (SWR)')
    .locator('xpath=preceding-sibling::*[1]')
    .textContent();
  expect(swrText).toMatch(/^\d+(\.\d+)?%$/);
  expect(swrText).not.toMatch(/NaN/);
});

test('Calculate retirement metrics shows RMD table', async ({ page }) => {
  await page.click('button:has-text("Run Analysis")');
  await expect(page.getByText('Risk Parity Weights')).toBeVisible({ timeout: 60000 });
  await page.click('button:has-text("Retirement")');

  await page.fill('#ret-monthly-spend', '5000');
  await page.fill('#ret-horizon-years', '30');
  await page.fill('#ret-birth-year', '1955');
  await page.fill('#ret-inflation-rate', '0.03');

  await clickRetirementCalculate(page);

  await expect(page.getByText(/Required Minimum Distribution/i)).toBeVisible({ timeout: 90000 });
  await expect(page.locator('table.sd-table tbody tr').first()).toBeVisible();
  await expect(page.getByText(/Distribution period/i)).toBeVisible();
});

test('Calculate retirement metrics shows withdrawal sequencing', async ({ page }) => {
  await page.click('button:has-text("Run Analysis")');
  await expect(page.getByText('Risk Parity Weights')).toBeVisible({ timeout: 60000 });
  await page.click('button:has-text("Retirement")');

  await page.fill('#ret-monthly-spend', '5000');
  await page.fill('#ret-horizon-years', '30');
  await page.fill('#ret-birth-year', '1960');
  await page.fill('#ret-inflation-rate', '0.03');

  await clickRetirementCalculate(page);

  await expect(page.getByText(/Withdrawal sequencing/i)).toBeVisible({ timeout: 90000 });
  await expect(page.getByRole('columnheader', { name: /Taxable Withdrawal/i })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /Traditional Withdrawal/i })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /Roth Withdrawal/i })).toBeVisible();
});

test('Monte Carlo and Backtest charts render', async ({ page }) => {
  await page.click('button:has-text("Run Analysis")');
  await expect(page.getByText('Risk Parity Weights')).toBeVisible({ timeout: 60000 });
  await page.click('button:has-text("Retirement")');

  await page.fill('#ret-monthly-spend', '4000');
  await page.fill('#ret-horizon-years', '30');
  await page.fill('#ret-birth-year', '1960');
  await page.fill('#ret-inflation-rate', '0.03');

  await clickRetirementCalculate(page);

  await expect(page.getByText(/Monte Carlo Fan Chart/i)).toBeVisible({ timeout: 90000 });
  await expect(page.getByText(/Historical SWR\/PWR by Start Year/i)).toBeVisible({
    timeout: 90000,
  });
});

test('Retirement tab compares static spending with the selected guardrail', async ({ page }) => {
  await page.click('button:has-text("Run Analysis")');
  await expect(page.getByText('Risk Parity Weights')).toBeVisible({ timeout: 60000 });
  await page.click('button:has-text("Retirement")');
  await page.fill('#ret-monthly-spend', '4000');
  await page.selectOption('#ret-guardrail', 'rpr-80');
  await clickRetirementCalculate(page);

  const panel = page.getByTestId('guardrail-comparison');
  await expect(panel).toBeVisible({ timeout: 120000 });
  await expect(panel).toContainText(/Static vs Guardrail/i);
  for (const column of ['static', 'guardrail']) {
    await expect(page.getByTestId(`cmp-success-${column}`)).toHaveText(/^\d+(\.\d+)?%$/);
    await expect(page.getByTestId(`cmp-median-${column}`)).toHaveText(/^\$[\d,]+(\.\d{2})?$/);
    await expect(page.getByTestId(`cmp-p10-${column}`)).toHaveText(/^\$[\d,]+(\.\d{2})?$/);
  }
  await expect(panel).not.toContainText('NaN');
});

test('No comparison is shown when the guardrail is None', async ({ page }) => {
  await page.click('button:has-text("Run Analysis")');
  await expect(page.getByText('Risk Parity Weights')).toBeVisible({ timeout: 60000 });
  await page.click('button:has-text("Retirement")');
  await clickRetirementCalculate(page);
  await expect(page.getByText('Safe Withdrawal Rate (SWR)')).toBeVisible({ timeout: 120000 });
  await expect(page.getByTestId('guardrail-comparison')).toHaveCount(0);
});
