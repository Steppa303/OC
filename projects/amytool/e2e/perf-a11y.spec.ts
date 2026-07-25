import { test, expect, type Page } from '@playwright/test';

// P7-04 (Milestone M7): performance + accessibility pass.

async function dismissFirstRun(page: Page) {
  // Fresh context always shows the tour, then the gallery; wait for each.
  const tourSkip = page.getByTestId('tour-skip');
  await expect(tourSkip).toBeVisible();
  await tourSkip.click();
  const empty = page.getByTestId('starter-empty');
  await expect(empty).toBeVisible();
  await empty.click();
}

test('canvas stays responsive with 40 modules; edits are isolated', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/patch');
  await dismissFirstRun(page);

  // Place 40 modules from the palette.
  const vco = page.getByRole('button', { name: 'VCO', exact: true });
  for (let i = 0; i < 40; i++) await vco.click();
  await expect(page.locator('.react-flow__node')).toHaveCount(40);

  // A slider change on one module updates only that module's value (memoized nodes).
  const first = page.locator('[data-id="vco1"]').getByLabel('Coarse');
  const other = page.locator('[data-id="vco20"]').getByLabel('Coarse');
  const otherBefore = await other.inputValue();
  await first.focus();
  const start = Date.now();
  for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowUp');
  const elapsed = Date.now() - start;

  expect(await first.inputValue()).not.toBe('0');
  expect(await other.inputValue()).toBe(otherBefore); // untouched
  // 20 keyboard-driven param updates across 40 modules stay well under budget.
  expect(elapsed).toBeLessThan(6000);
});

test('keyboard focus shows a visible ring', async ({ page }) => {
  await page.goto('/patch');
  await dismissFirstRun(page);

  // Keyboard navigation (Tab) triggers the :focus-visible heuristic; the module
  // search box focuses first, then the first palette button gets the ring.
  await page.getByLabel('Search modules').focus();
  await page.keyboard.press('Tab');
  const ring = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { tag: el.tagName, style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) };
  });
  expect(ring?.style).toBe('solid');
  expect(ring?.width).toBeGreaterThanOrEqual(2);
});

test('reduced-motion preference neutralizes transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/patch');
  await dismissFirstRun(page);
  await page.getByRole('button', { name: 'VCO', exact: true }).click();

  const panel = page.locator('[data-id="vco1"] .ui-panel');
  const dur = await panel.evaluate((el) => getComputedStyle(el).transitionDuration);
  // "0s" or ~0.000001s — anything effectively instant.
  expect(parseFloat(dur)).toBeLessThan(0.01);
});

test('core controls expose accessible names', async ({ page }) => {
  await page.goto('/patch');
  await dismissFirstRun(page);
  await expect(page.getByRole('slider', { name: 'Master volume' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stop sequencer' })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Sequencer tempo in BPM' })).toBeVisible();
});
