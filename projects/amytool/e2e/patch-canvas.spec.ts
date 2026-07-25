import { test, expect } from '@playwright/test';

// P1-01: place / move / delete a module on the rack; layout persists in PatchDoc.
test('place, move, duplicate and delete modules on the rack', async ({ page }) => {
  await page.goto('/patch');

  await expect(page.getByText('Empty rack')).toBeVisible();

  // Place a VCO from the palette.
  await page.getByRole('button', { name: 'VCO', exact: true }).click();
  const vco = page.locator('.react-flow__node').first();
  await expect(vco).toBeVisible();
  await expect(page.getByText('Empty rack')).toHaveCount(0);
  await expect(page.locator('.react-flow__node')).toHaveCount(1);

  // Move it by its header (the node body is nodrag) and confirm the transform
  // changed (position persisted to store).
  const before = await vco.evaluate((el) => (el as HTMLElement).style.transform);
  const header = vco.locator('.ui-panel-header');
  const hb = (await header.boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(400, 300);
  await page.mouse.move(500, 380);
  await page.mouse.up();
  const after = await vco.evaluate((el) => (el as HTMLElement).style.transform);
  expect(after).not.toBe(before);

  // Moving a slider changes its value without moving the panel (nodrag).
  const posBeforeKnob = await vco.evaluate((el) => (el as HTMLElement).style.transform);
  const coarse = vco.getByLabel('Coarse');
  const valBefore = await coarse.inputValue();
  await coarse.fill('7');
  expect(await coarse.inputValue()).not.toBe(valBefore);
  expect(await vco.evaluate((el) => (el as HTMLElement).style.transform)).toBe(posBeforeKnob);

  // Duplicate the selected module (Cmd/Ctrl+D). Select via the header so focus
  // isn't left inside a slider input.
  await vco.locator('.ui-panel-header .ui-panel-name').click();
  await page.keyboard.press('ControlOrMeta+d');
  await expect(page.locator('.react-flow__node')).toHaveCount(2);

  // Delete the selected copy.
  await page.keyboard.press('Delete');
  await expect(page.locator('.react-flow__node')).toHaveCount(1);

  // Undo brings the deleted copy back; redo removes it again.
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
});

// Stufe 1: newly added modules are highlighted; a header × closes them.
test('added module is selected and closable via ×', async ({ page }) => {
  await page.goto('/patch');
  // Dismiss first-run overlays (onboarding tour → starter gallery).
  await page.getByTestId('tour-skip').click();
  await page.getByTestId('starter-empty').click();

  await page.getByRole('button', { name: 'VCO', exact: true }).click();
  const vco = page.locator('.react-flow__node').first();
  await expect(vco).toBeVisible();
  // React Flow reflects store selection as the `selected` class → highlighted.
  await expect(vco).toHaveClass(/selected/);

  // The header × removes it (same undoable path as Delete).
  await page.getByRole('button', { name: 'Close VCO' }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(0);
});
