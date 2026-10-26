import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

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

test('debug: just click Calculate and see what happens', async ({ page }) => {
  test.setTimeout(120000);

  await page.click('button:has-text("Run Analysis")');
  await expect(page.getByText('Risk Parity Weights')).toBeVisible({ timeout: 60000 });
  console.log('Analysis complete');

  await page.click('button:has-text("Retirement")');
  console.log('Retirement tab open');

  await page.fill('#ret-monthly-spend', '4000');
  await page.fill('#ret-horizon-years', '30');
  await page.fill('#ret-birth-year', '1960');
  await page.fill('#ret-inflation-rate', '0.03');
  console.log('Fields filled');

  console.log('Clicking Calculate...');
  await page.click('button:has-text("Calculate")');
  console.log('Calculate clicked');

  // Just wait and see what happens
  await page.waitForTimeout(5000);
  console.log('Waited 5s');

  await page.waitForTimeout(10000);
  console.log('Waited 15s total');

  await page.waitForTimeout(30000);
  console.log('Waited 45s total');

  // Check what's on screen
  const bodyText = await page.textContent('body');
  console.log('Body text snippet:', bodyText.substring(0, 500));

  const hasSWR = await page.getByText('Safe Withdrawal Rate (SWR)').isVisible();
  console.log('SWR visible:', hasSWR);

  const hasError = await page.getByRole('alert').isVisible();
  console.log('Error visible:', hasError);

  if (hasError) {
    const errorText = await page.getByRole('alert').textContent();
    console.log('Error:', errorText);
  }
});
