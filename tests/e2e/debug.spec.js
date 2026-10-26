import { test, expect } from '@playwright/test';

const MOCK_CLOSES = Array.from({ length: 600 }, (_, i) => 100 + Math.sin(i * 0.1) * 2 + i * 0.03);
const MOCK_TIMESTAMPS = Array.from({ length: 600 }, (_, i) =>
  Math.floor((Date.now() - 600 * 30 * 24 * 60 * 60 * 1000 + i * 30 * 24 * 60 * 60 * 1000) / 1000)
);

test.beforeEach(async ({ page }) => {
  await page.route('https://query1.finance.yahoo.com/**', route =>
    route.fulfill({
      json: {
        chart: {
          result: [
            {
              indicators: {
                adjclose: [{ adjclose: MOCK_CLOSES }],
              },
              timestamp: MOCK_TIMESTAMPS,
            },
          ],
        },
      },
    })
  );
  await page.goto('/risk-parity-compass/');
  await page.waitForSelector('#root');
});

test('debug: full flow with all steps', async ({ page }) => {
  // Step 1: Run Analysis
  console.log('Step 1: Click Run Analysis');
  await page.click('button:has-text("Run Analysis")');
  await expect(page.getByText('Risk Parity Weights')).toBeVisible({ timeout: 60000 });
  console.log('Step 1 done: Analysis complete');

  // Step 2: Click Retirement tab
  console.log('Step 2: Click Retirement tab');
  await page.click('button:has-text("Retirement")');
  await expect(page.getByLabel(/Monthly spend/i)).toBeVisible({ timeout: 10000 });
  console.log('Step 2 done: Retirement tab open');

  // Step 3: Fill all fields
  console.log('Step 3: Fill fields');
  await page.fill('#ret-monthly-spend', '4000');
  await page.fill('#ret-horizon-years', '30');
  await page.fill('#ret-birth-year', '1960');
  await page.fill('#ret-inflation-rate', '0.03');
  console.log('Step 3 done: Fields filled');

  // Step 4: Click Calculate
  console.log('Step 4: Click Calculate');
  await page.click('button:has-text("Calculate")');
  console.log('Step 4 done: Calculate clicked');

  // Step 5: Wait for results
  console.log('Step 5: Waiting for results...');
  await Promise.race([
    page.getByText('Safe Withdrawal Rate (SWR)').waitFor({ state: 'visible', timeout: 120000 }),
    page.getByRole('alert').waitFor({ state: 'visible', timeout: 120000 }),
    page.getByText(/calculation failed/i).waitFor({ state: 'visible', timeout: 120000 }),
  ]);
  console.log('Step 5 done: Results appeared');

  // Check what we got
  const swrVisible = await page
    .getByText('Safe Withdrawal Rate (SWR)')
    .isVisible({ timeout: 5000 });
  console.log('SWR visible:', swrVisible);

  if (swrVisible) {
    const swrCard = page.locator('.sd-card').filter({ hasText: 'Safe Withdrawal Rate (SWR)' });
    const swrValue = swrCard.locator('.sd-metricVal');
    await expect(swrValue).toBeVisible({ timeout: 10000 });
    const swrText = await swrValue.textContent();
    console.log('SWR text:', swrText);
    expect(swrText).toMatch(/^\d+(\.\d+)?%$/);
    expect(swrText).not.toMatch(/NaN/);
  } else {
    const errorVisible = await page.getByRole('alert').isVisible({ timeout: 5000 });
    console.log('Error visible:', errorVisible);
    if (errorVisible) {
      const errorText = await page.getByRole('alert').textContent();
      console.log('Error text:', errorText);
    }
  }
});
