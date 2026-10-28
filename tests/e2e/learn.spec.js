import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const DAY = 864e5;

test.beforeEach(async ({ page }) => {
  await page.goto('/risk-parity-compass/');
  await page.waitForSelector('#root');
  await page.getByRole('tab', { name: /^Learn/ }).click();
});

test('Learn tab: no violations, rubric is optional and gates nothing', async ({ page }) => {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);

  await page.getByLabel(/Product skeptic/).check();
  for (const name of ['Current Holdings', 'Risk Parity Targets', 'Retirement', 'Portfolios']) {
    await expect(page.getByRole('tab', { name })).toBeEnabled();
  }
  await page.reload();
  await page.getByRole('tab', { name: /^Learn/ }).click();
  await expect(page.getByLabel(/Product skeptic/)).toBeChecked();
});

test('correct answer is graded against the engine value ($134,083 gap)', async ({ page }) => {
  await page.getByLabel('Your estimate in dollars').fill('134000');
  await page.getByLabel('How confident are you?').selectOption('5');
  await page.getByRole('button', { name: 'Check my answer' }).click();
  await expect(page.getByText('Correct.')).toBeVisible();
  await expect(page.getByText(/\$134,083/)).toBeVisible();
  await expect(page.getByText(/Where you’re going/)).toBeVisible();

  const learning = await page.evaluate(
    () => JSON.parse(localStorage.getItem('rpcompass_state')).learning
  );
  expect(learning.modules.cost.correct).toBe(true);
  expect(learning.modules.cost.nextDue).toBeGreaterThan(Date.now() + 6 * DAY);
});

test('wrong, confident answer gets calibration feedback, not a bare "wrong"', async ({ page }) => {
  await page.getByLabel('Your estimate in dollars').fill('1000');
  await page.getByLabel('How confident are you?').selectOption('5');
  await page.getByRole('button', { name: 'Check my answer' }).click();
  await expect(page.getByText('Not quite.')).toBeVisible();
  await expect(page.getByText(/confident and off/)).toBeVisible();
  await page.getByLabel(/When I see a fund fee/).fill('compare the cost over 30 years');
  await page.getByRole('button', { name: 'Save sentence' }).click();
  await expect(page.getByText('Saved on this device.')).toBeVisible();
});

test('a due refresher shows passively on the tab, with no push', async ({ page }) => {
  await page.evaluate(now => {
    localStorage.setItem(
      'rpcompass_state',
      JSON.stringify({
        schemaVersion: 2,
        learning: {
          rubricChoice: null,
          modules: { cost: { attempts: 1, step: 0, nextDue: now - 1 } },
        },
      })
    );
  }, Date.now());
  await page.reload();
  await expect(page.getByRole('tab', { name: /Learn \(refresher due\)/ })).toBeVisible();
  await page.getByRole('tab', { name: /^Learn/ }).click();
  await expect(page.getByText(/refresher on this topic is due/)).toBeVisible();
  // second attempt rotates to the second variant
  await expect(page.getByText(/\$250,000 grows 5%/)).toBeVisible();
});

// Oracles are hand-computed, independent of the app (see learning.test.js).
const MODULE_ANSWERS = [
  ['Correlation and diversification', '11.31', /11\.31%/],
  ['Required minimum distributions', '24390', /\$24,390/],
  ['The 80% spending guardrail', '3750', /\$3,750 a month/],
  ['Which account to draw from', '2000', /\$2,000 this month/],
];

for (const [title, , shown] of MODULE_ANSWERS) {
  test(`module "${title}" grades against its oracle`, async ({ page }) => {
    await page.getByRole('button', { name: new RegExp(title) }).click();
    await expect(page.getByRole('button', { name: new RegExp(title) })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await page.getByLabel(/Your estimate in/).fill('1');
    await page.getByRole('button', { name: 'Check my answer' }).click();
    await expect(page.getByText('Not quite.')).toBeVisible();
    await expect(page.getByText(shown)).toBeVisible();

    await page.getByRole('button', { name: 'Try another' }).click();
    await expect(page.getByText('Not quite.')).toBeHidden();
  });
}

test('exact oracle answer on the first guardrail item is correct', async ({ page }) => {
  await page.getByRole('button', { name: /80% spending guardrail/ }).click();
  await page.getByLabel(/Your estimate in/).fill('3750');
  await page.getByRole('button', { name: 'Check my answer' }).click();
  await expect(page.getByText('Correct.')).toBeVisible();
});

test('module picker is axe-clean', async ({ page }) => {
  await page.getByRole('button', { name: /Required minimum distributions/ }).click();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
