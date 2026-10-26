import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.route('https://query1.finance.yahoo.com/**', route => {
    const url = route.request().url();
    if (url.includes('range=max')) {
      console.log('MONTHLY HISTORY REQUEST:', url);
    } else {
      console.log('QUOTE REQUEST:', url);
    }
    route.fulfill({
      json: {
        chart: {
          result: [
            {
              timestamp: Array.from({ length: 600 }, (_, i) =>
                Math.floor(
                  (Date.now() - 600 * 30 * 24 * 60 * 60 * 1000 + i * 30 * 24 * 60 * 60 * 1000) /
                    1000
                )
              ),
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
            },
          ],
        },
      },
    });
  });
  await page.goto('/risk-parity-compass/');
  await page.waitForSelector('#root');
});

test('debug: check which function is called', async ({ page }) => {
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

  // Wait for any console output or error
  await page.waitForTimeout(5000);
  console.log('Waited 5s');

  await page.waitForTimeout(10000);
  console.log('Waited 15s');

  await page.waitForTimeout(30000);
  console.log('Waited 45s');

  // Check console for any errors
  const hasSWR = await page.getByText('Safe Withdrawal Rate (SWR)').isVisible();
  console.log('SWR visible:', hasSWR);

  const hasError = await page.getByRole('alert').isVisible();
  console.log('Error visible:', hasError);

  if (hasError) {
    const errorText = await page.getByRole('alert').textContent();
    console.log('Error:', errorText);
  }

  // Check if calculating spinner is showing
  const calculating = await page.getByText('⏳ Calculating').isVisible();
  console.log('Calculating spinner visible:', calculating);

  // Check if button is disabled
  const calculateBtn = page.locator(
    'button:has-text("Calculate"), button:has-text("⏳ Calculating")'
  );
  const isDisabled = await calculateBtn.isDisabled();
  console.log('Calculate button disabled:', isDisabled);
});
