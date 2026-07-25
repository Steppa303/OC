import { test, expect, type Page } from '@playwright/test';

// P7-02: QoL pass — context menus, cable tidy toggle, param copy/paste, ⌘K palette.

async function addModule(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).click();
}

async function dragConnect(page: Page, fromSel: string, toSel: string) {
  const from = (await page.locator(fromSel).boundingBox())!;
  const to = (await page.locator(toSel).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
}

async function dismissStarter(page: Page) {
  // First-run: skip the onboarding tour, then the starter gallery. On a fresh
  // context both always appear; wait for each so we never race their mount.
  const tourSkip = page.getByTestId('tour-skip');
  await expect(tourSkip).toBeVisible();
  await tourSkip.click();
  const empty = page.getByTestId('starter-empty');
  await expect(empty).toBeVisible();
  await empty.click();
}

test('jack context menu disconnects a cable', async ({ page }) => {
  await page.goto('/patch');
  await dismissStarter(page);
  await addModule(page, 'VCO');
  await addModule(page, 'Output');
  await dragConnect(page, '[data-nodeid="vco1"][data-handleid="out"]', '[data-nodeid="out1"][data-handleid="in"]');
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);

  // right-click the VCO output jack slot
  await page.locator('[data-id="vco1"] .node-pin-slot[data-jack="out"]').click({ button: 'right' });
  const menu = page.getByTestId('context-menu');
  await expect(menu).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Disconnect' }).click();
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
});

test('module context menu: color tag and copy/paste params', async ({ page }) => {
  await page.goto('/patch');
  await dismissStarter(page);
  await addModule(page, 'VCO');
  await addModule(page, 'VCO');

  // set a param on vco1 via the command palette-free path: right-click for menu
  await page.locator('[data-id="vco1"] .ui-panel').click({ button: 'right' });
  let menu = page.getByTestId('context-menu');
  await expect(menu).toBeVisible();

  // color tag → Green, applies an accent class
  await menu.getByRole('menuitem', { name: 'Color tag…' }).click();
  await menu.getByRole('menuitem', { name: 'Green' }).click();
  await expect(page.locator('[data-id="vco1"] .ui-panel-accented')).toHaveCount(1);

  // change vco1 coarse, then copy → paste onto vco2
  const coarse1 = page.locator('[data-id="vco1"]').getByLabel('Coarse');
  await coarse1.fill('7');
  const val = await coarse1.inputValue();

  await page.locator('[data-id="vco1"] .ui-panel').click({ button: 'right' });
  menu = page.getByTestId('context-menu');
  await menu.getByRole('menuitem', { name: 'Copy params' }).click();

  await page.locator('[data-id="vco2"] .ui-panel').click({ button: 'right' });
  menu = page.getByTestId('context-menu');
  await menu.getByRole('menuitem', { name: 'Paste params' }).click();

  await expect(page.locator('[data-id="vco2"]').getByLabel('Coarse')).toHaveValue(val);
});

test('module context menu: replace with a compatible module', async ({ page }) => {
  await page.goto('/patch');
  await dismissStarter(page);
  await addModule(page, 'VCO');

  await page.locator('[data-id="vco1"] .ui-panel').click({ button: 'right' });
  const menu = page.getByTestId('context-menu');
  await menu.getByRole('menuitem', { name: 'Replace with…' }).click();
  // pick the first compatible (same-role) option — Noise is a vco-role source
  await menu.getByRole('menuitem', { name: 'Noise' }).click();
  await expect(page.locator('[data-id="vco1"] .ui-panel')).toContainText('Noise');
});

test('cable tidy toggle persists across reload', async ({ page }) => {
  await page.goto('/patch');
  await dismissStarter(page);
  const toggle = page.getByTestId('cable-tidy-toggle');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByTestId('cable-tidy-toggle')).toHaveAttribute('aria-pressed', 'true');
});

test('⌘K command palette adds a module and jumps workspace', async ({ page }) => {
  await page.goto('/patch');
  await dismissStarter(page);

  await page.keyboard.press('ControlOrMeta+k');
  const palette = page.getByTestId('command-palette');
  await expect(palette).toBeVisible();
  await page.getByLabel('Command palette').fill('add vcf');
  await palette.getByRole('option').first().click();
  await expect(page.locator('.react-flow__node').filter({ hasText: 'VCF' })).toHaveCount(1);

  // reopen and navigate to Settings
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByLabel('Command palette').fill('go to settings');
  await page.getByTestId('command-palette').getByRole('option').first().click();
  await expect(page).toHaveURL(/\/settings$/);
});
