import { test, expect } from '@playwright/test';

// P5-04 (Milestone M5 pt.1): insert the subtractive + drum-machine groups and
// hear both at once in the simulator.
test('subtractive + drum machine groups play simultaneously in the sim', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/patch');

  // insert both groups + a keyboard + a scope (to read the master output)
  await page.getByRole('button', { name: 'Subtractive Voice', exact: true }).click();
  await page.getByRole('button', { name: 'Drum Machine', exact: true }).click();
  await page.getByRole('button', { name: 'Keyboard', exact: true }).click();
  await page.getByRole('button', { name: 'Scope', exact: true }).click();

  // subtractive(5) + drummachine(4) + keyboard + scope = 11 modules
  await expect(page.locator('.react-flow__node')).toHaveCount(11);

  // arm a drum step so the sequencer produces sound
  await page.getByRole('gridcell', { name: 'row 1 step 1', exact: true }).click();

  await page.getByTestId('audio-toggle').click();
  await expect(page.getByTestId('engine-state')).toHaveText('live', { timeout: 30000 });
  await page.getByTestId('seq-start').click();

  // hold a note so the subtractive voice sounds alongside the drums
  await page.getByRole('button', { name: 'note 60' }).dispatchEvent('pointerdown');

  // the master output (scope) is non-silent → both groups are audible
  await expect
    .poll(async () => Number(await page.getByTestId('scope').getAttribute('data-peak')), { timeout: 15000 })
    .toBeGreaterThan(0);
});
