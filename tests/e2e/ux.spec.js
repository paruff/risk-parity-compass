import { test, expect } from '@playwright/test';

// Deterministic fixture for the Yahoo Finance chart endpoint.
const MOCK_CLOSES = Array.from({ length: 400 }, (_, i) => 100 + Math.sin(i * 0.05) * 8 + i * 0.03);

test.beforeEach(async ({ page }) => {
  await page.route('https://query1.finance.yahoo.com/**', route =>
    route.fulfill({
      json: {
        chart: { result: [{ indicators: { adjclose: [{ adjclose: MOCK_CLOSES }] } }] },
      },
    })
  );
  await page.goto('/shannonsdemon/');
  await page.waitForSelector('#root');
});

async function useViewport(page, width, height) {
  await page.setViewportSize({ width, height });
  await page.reload();
  await page.waitForSelector('#root');
}

test.describe('Usability and accessibility', () => {
  test('the primary action is inside the viewport on mobile', async ({ page }) => {
    await useViewport(page, 390, 844);

    const boxes = await page.getByRole('button', { name: /Run Analysis/ }).evaluateAll(buttons =>
      buttons.map(button => {
        const rect = button.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        };
      })
    );

    const reachable = boxes.some(
      box =>
        box.width > 0 &&
        box.height > 0 &&
        box.left >= 0 &&
        box.right <= 390 &&
        box.top >= 0 &&
        box.bottom <= 844
    );
    expect(reachable).toBe(true);
  });

  test('the sidebar collapses on tablet at 768px', async ({ page }) => {
    await useViewport(page, 768, 900);
    await expect(page.getByRole('button', { name: 'Toggle sidebar' })).toBeVisible();
  });

  test('holdings inputs use more than one column on mobile', async ({ page }) => {
    await useViewport(page, 390, 844);
    await page.getByRole('tab', { name: /Current Holdings/ }).click();

    const columns = await page.locator('#holding-Taxable-SPY').evaluate(input => {
      const grid = input.closest('.sd-holdings-grid') ?? input.parentElement?.parentElement;
      if (!grid) return 0;
      return getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
    });

    expect(columns).toBeGreaterThan(1);
  });

  test('offers a recalculate prompt after an input changes', async ({ page }) => {
    await page
      .getByRole('button', { name: /Run Analysis/ })
      .first()
      .click();
    await expect(page.getByText('Risk Parity Weights')).toBeVisible({ timeout: 15000 });

    await page.locator('#acct-Taxable').fill('60000');
    await expect(page.getByText(/Inputs changed/i)).toBeVisible();
  });

  test('tabs expose tab semantics and selected state', async ({ page }) => {
    const tab = page.getByRole('tab', { name: /Current Holdings/ });
    await expect(tab).toBeVisible();
    await expect(tab).toHaveAttribute('aria-selected', 'true');

    await page.getByRole('tab', { name: /Risk Parity Targets/ }).click();
    await expect(page.getByRole('tab', { name: /Risk Parity Targets/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  test('announces analysis status to assistive technology', async ({ page }) => {
    await page
      .getByRole('button', { name: /Run Analysis/ })
      .first()
      .click();
    await expect(page.getByText('Risk Parity Weights')).toBeVisible({ timeout: 15000 });

    await expect(page.locator('[role="status"]')).toContainText(/Analysis complete/i);
  });

  test('interactive controls meet a 44px minimum height', async ({ page }) => {
    const tooSmall = await page
      .locator('main button, aside button, main input, aside input, main select, aside select')
      .evaluateAll(controls =>
        controls
          .filter(control => {
            const rect = control.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && rect.height < 44;
          })
          .map(control => {
            const rect = control.getBoundingClientRect();
            return {
              tag: control.tagName,
              text: (control.textContent || '').trim().slice(0, 24),
              height: Math.round(rect.height),
            };
          })
      );

    expect(tooSmall).toEqual([]);
  });

  test('visible text meets minimum size and contrast', async ({ page }) => {
    const failures = await page.evaluate(() => {
      const parseColor = value => {
        const match = value.match(/rgba?\(([^)]+)\)/);
        if (!match) return null;
        const [r, g, b, a = '1'] = match[1].split(',').map(Number);
        return { r, g, b, a };
      };

      const luminance = ({ r, g, b }) => {
        const channel = value => {
          const v = value / 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
      };

      const contrast = (a, b) => {
        const l1 = Math.max(luminance(a), luminance(b));
        const l2 = Math.min(luminance(a), luminance(b));
        return (l1 + 0.05) / (l2 + 0.05);
      };

      const background = element => {
        let node = element;
        while (node) {
          const style = getComputedStyle(node);
          if (style.backgroundImage && style.backgroundImage !== 'none') return null;
          const color = parseColor(style.backgroundColor);
          if (color && color.a > 0.5) return color;
          node = node.parentElement;
        }
        return { r: 13, g: 20, b: 36, a: 1 };
      };

      const failures = [];
      document.querySelectorAll('main *, aside *').forEach(element => {
        if (element.children.length > 0) return;
        if (element.closest('button, a, svg, select, script, style')) return;
        if (!element.offsetParent) return;

        const text = (element.textContent || '').trim();
        if (!text) return;

        const style = getComputedStyle(element);
        const fontSize = parseFloat(style.fontSize);
        const foreground = parseColor(style.color);
        const backdrop = background(element);
        if (!foreground || !backdrop) return;

        const ratio = contrast(foreground, backdrop);
        const large = fontSize >= 24 || (fontSize >= 18.66 && Number(style.fontWeight) >= 700);
        const tooSmall = fontSize < 12;
        const tooLow = large ? ratio < 3 : ratio < 4.5;

        if (tooSmall || tooLow) {
          failures.push({
            text: text.slice(0, 40),
            fontSize,
            contrast: Number(ratio.toFixed(2)),
          });
        }
      });
      return failures;
    });

    expect(failures).toEqual([]);
  });
});
