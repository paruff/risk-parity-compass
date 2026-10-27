import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

const CLOSES = Array.from({ length: 600 }, (_, i) => 100 + Math.sin(i * 0.1) * 5 + i * 0.03);
const STAMPS = Array.from({ length: 600 }, (_, i) =>
  Math.floor((Date.now() - 600 * 30 * 864e5 + i * 30 * 864e5) / 1000)
);

test.describe.configure({ timeout: 120000 });

test.beforeEach(async ({ page }) => {
  await page.route('https://query1.finance.yahoo.com/**', route =>
    route.fulfill({
      json: {
        chart: {
          result: [{ indicators: { adjclose: [{ adjclose: CLOSES }] }, timestamp: STAMPS }],
        },
      },
    })
  );
  await page.goto('/risk-parity-compass/');
  await page.waitForSelector('#root');
});

test('font scale persists across reload', async ({ page }) => {
  await page.selectOption('#pref-font-scale', '1.3');
  await page.reload();
  await expect(page.locator('#pref-font-scale')).toHaveValue('1.3');
});

test('high contrast persists across reload', async ({ page }) => {
  await page.getByRole('button', { name: /High contrast/ }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: /High contrast/ })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
});

test('export then import round-trips a plan', async ({ page }) => {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export plan' }).click(),
  ]);
  const plan = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(plan.schemaVersion).toBe(2);
  expect(plan.app).toBe('risk-parity-compass');
  await page.setInputFiles('input[aria-label="Import plan file"]', {
    name: 'plan.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(plan)),
  });
  await expect(page.getByText('Plan imported.')).toBeVisible();
});

test('import rejects an invalid file', async ({ page }) => {
  await page.setInputFiles('input[aria-label="Import plan file"]', {
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"nope":1}'),
  });
  await expect(page.getByText(/Import failed/)).toBeVisible();
});

test('legacy shannonsdemon_v1 state migrates to the current key', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('shannonsdemon_v1', JSON.stringify({ tickers: ['SPY', 'TLT'] }));
  });
  await page.reload();
  await expect(page.locator('#panel-holdings')).toBeVisible();
  const v2 = await page.evaluate(() => localStorage.getItem('rpcompass_state'));
  expect(JSON.parse(v2).schemaVersion).toBe(2);
});

test('print media hides navigation and sidebar', async ({ page }) => {
  await page.click('button:has-text("Run Analysis")');
  await expect(page.locator('text=Risk Parity Weights')).toBeVisible({ timeout: 15000 });
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('[role="tablist"]')).toBeHidden();
  await expect(page.locator('.sd-sidebar')).toBeHidden();
});

test('no axe violations on portfolios tab', async ({ page }) => {
  await page.click('button:has-text("Run Analysis")');
  await expect(page.locator('text=Risk Parity Weights')).toBeVisible({ timeout: 15000 });
  await page.getByRole('tab', { name: 'Portfolios' }).click();
  await expect(page.locator('#panel-portfolios')).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('keyboard: arrow keys move between tabs and plan tools are reachable', async ({ page }) => {
  await page.getByRole('tab', { name: 'Current Holdings' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Risk Parity Targets' })).toBeFocused();
  await page.getByRole('button', { name: 'Export plan' }).focus();
  await expect(page.getByRole('button', { name: 'Export plan' })).toBeFocused();
});
