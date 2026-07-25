import { test, expect } from '@playwright/test';

// P4-04 (Milestone M4): the core.scope display is driven by live engine output.
test('scope reflects the engine output when a note plays', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/patch');

  await page.getByRole('button', { name: 'VCO', exact: true }).click();
  await page.getByRole('button', { name: 'Keyboard', exact: true }).click();
  await page.getByRole('button', { name: 'Scope', exact: true }).click();

  await page.getByTestId('audio-toggle').click();
  await expect(page.getByTestId('engine-state')).toHaveText('live', { timeout: 30000 });

  // hold a note (pointerdown, no release) so the output sustains while the ~30 fps
  // scope samples it
  await page.getByRole('button', { name: 'note 60' }).dispatchEvent('pointerdown');

  // the engine tap pushes a non-flat waveform into the scope
  await expect
    .poll(async () => Number(await page.getByTestId('scope').getAttribute('data-peak')), { timeout: 15000 })
    .toBeGreaterThan(0);

});
