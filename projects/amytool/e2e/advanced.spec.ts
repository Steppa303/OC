import { test, expect, type Page } from '@playwright/test';

async function dragConnect(page: Page, fromSel: string, toSel: string) {
  const from = (await page.locator(fromSel).boundingBox())!;
  const to = (await page.locator(toSel).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
}

// P5-07: the per-module advanced toggle reveals advanced params/jacks, and
// collapsing keeps a cable on a now-hidden advanced jack (stub).
test('advanced toggle reveals controls and keeps a connected advanced jack', async ({ page }) => {
  await page.goto('/patch');
  await page.getByRole('button', { name: 'VCO', exact: true }).click();
  await page.getByRole('button', { name: 'LFO', exact: true }).click();

  // Duty is an advanced param — hidden by default, shown after toggling.
  await expect(page.getByLabel('Duty')).toHaveCount(0);
  await page.getByTestId('advanced-toggle-vco1').click();
  await expect(page.getByLabel('Duty')).toBeVisible();

  // connect LFO out → VCO fm (an advanced jack, now visible)
  await dragConnect(page, '[data-nodeid="lfo1"][data-handleid="out"]', '[data-nodeid="vco1"][data-handleid="fm"]');
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);

  // collapse the VCO — the advanced Duty control hides, but the fm cable survives
  await page.getByTestId('advanced-toggle-vco1').click();
  await expect(page.getByLabel('Duty')).toHaveCount(0);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  // the stub handle is still present so React Flow keeps the edge anchored
  await expect(page.locator('[data-nodeid="vco1"][data-handleid="fm"]')).toHaveCount(1);
});
