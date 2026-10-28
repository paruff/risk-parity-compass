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
            { indicators: { adjclose: [{ adjclose: MOCK_CLOSES }] }, timestamp: MOCK_TIMESTAMPS },
          ],
        },
      },
    })
  );
  await page.goto('/risk-parity-compass/');
  await page.waitForSelector('#root');
  await page.click('button:has-text("Run Analysis")');
  await expect(page.getByText('Risk Parity Weights')).toBeVisible({ timeout: 60000 });
  await page.getByRole('tab', { name: 'Portfolios' }).click();
});

async function pickGoldenButterfly(page) {
  await page.getByRole('combobox', { name: /select template/i }).selectOption('golden-butterfly');
}

test('Portfolios tab loads templates and shows comparison', async ({ page }) => {
  await expect(page.getByText('Portfolio Templates')).toBeVisible();
  await pickGoldenButterfly(page);
  await expect(page.getByRole('heading', { name: /Golden Butterfly/ }).first()).toBeVisible();
  const table = page.getByRole('table', { name: /weight comparison/i });
  await expect(table.getByRole('columnheader', { name: 'Current' })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: 'Template' })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: 'Difference (pp)' })).toBeVisible();
  await expect(table.getByRole('cell', { name: 'GLDM' })).toBeVisible();
});

test('Compare toggle hides and shows the difference column', async ({ page }) => {
  await pickGoldenButterfly(page);
  const table = page.getByRole('table', { name: /weight comparison/i });
  await expect(table.getByRole('columnheader', { name: 'Difference (pp)' })).toBeVisible();
  await page.getByRole('checkbox', { name: /compare/i }).uncheck();
  await expect(table.getByRole('columnheader', { name: 'Difference (pp)' })).toHaveCount(0);
});

test('Template comparison shows numeric metrics for current and template', async ({ page }) => {
  await pickGoldenButterfly(page);
  const swrCards = page.locator('.sd-card').filter({ hasText: 'Safe Withdrawal Rate (SWR)' });
  await expect(swrCards).toHaveCount(2, { timeout: 60000 });
  const swr = page.getByTestId('metric-swr-golden-butterfly');
  await expect(swr).toHaveText(/^\d+(\.\d+)?%$/);
  await expect(page.getByTestId('metric-swr-current')).toHaveText(/^\d+(\.\d+)?%$/);
  await expect(page.getByTestId('metric-swr-diff-golden-butterfly')).toHaveText(
    /^[+-]\d+(\.\d+)? pp$/
  );
});

test('Load template updates tickers and re-runs analysis', async ({ page }) => {
  await pickGoldenButterfly(page);
  await page.getByRole('button', { name: 'Load Template' }).click();
  // Stays on Portfolios; the analysis re-run is observable on the targets tab.
  await expect(page.getByRole('tab', { name: 'Portfolios', selected: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Risk Parity Targets' }).click();
  await expect(page.getByText('Risk Parity Weights')).toBeVisible({ timeout: 60000 });
  await expect(page.getByText('GLDM').first()).toBeVisible({ timeout: 60000 });
  await page.getByRole('tab', { name: 'Portfolios' }).click();
  await expect(
    page.locator('.sd-card').filter({ hasText: 'Safe Withdrawal Rate (SWR)' })
  ).toHaveCount(2, { timeout: 60000 });
});

test('Portfolios tab shows diversification score and warnings', async ({ page }) => {
  await pickGoldenButterfly(page);
  await expect(page.getByText(/Diversification Score/i)).toBeVisible();
  await expect(page.getByText(/Avg Pairwise Correlation/i)).toBeVisible({ timeout: 60000 });
  // Identical mock series are perfectly correlated, so the RPR warning must fire.
  await expect(page.getByTestId('diversification-warnings-golden-butterfly')).toContainText(
    /correlation exceeds 0\.6/i
  );
});

test('Template selection and comparison mode persist across reload', async ({ page }) => {
  await pickGoldenButterfly(page);
  await page.getByRole('checkbox', { name: /compare/i }).uncheck();
  await page.reload();
  await page.waitForSelector('#root');
  await page.getByRole('tab', { name: 'Portfolios' }).click();
  await expect(page.getByRole('combobox', { name: /select template/i })).toHaveValue(
    'golden-butterfly'
  );
  await expect(page.getByRole('checkbox', { name: /compare/i })).not.toBeChecked();
});

test('Template cards compare up to three templates side by side', async ({ page }) => {
  await expect(page.getByTestId('template-card-golden-butterfly')).toBeVisible();
  await pickGoldenButterfly(page);
  await page.getByRole('checkbox', { name: 'Add All Seasons (RPR Version) to comparison' }).check();
  await page.getByRole('checkbox', { name: 'Add Permanent Portfolio to comparison' }).check();
  // Three selected: the remaining cards cannot be added.
  await expect(
    page.getByRole('checkbox', { name: 'Add Golden Ratio to comparison' })
  ).toBeDisabled();
  for (const id of ['golden-butterfly', 'all-seasons', 'permanent-portfolio']) {
    await expect(page.getByTestId(`metric-swr-${id}`)).toHaveText(/^\d+(\.\d+)?%$/, {
      timeout: 60000,
    });
  }
  await expect(
    page.locator('.sd-card').filter({ hasText: 'Safe Withdrawal Rate (SWR)' })
  ).toHaveCount(4); // current + 3 templates
});

test('Load button on a template card loads that template', async ({ page }) => {
  await page.getByRole('button', { name: 'Load Permanent Portfolio' }).click();
  await page.getByRole('tab', { name: 'Risk Parity Targets' }).click();
  await expect(page.getByText('Risk Parity Weights')).toBeVisible({ timeout: 60000 });
  await expect(page.getByText('GLDM').first()).toBeVisible({ timeout: 60000 });
});
