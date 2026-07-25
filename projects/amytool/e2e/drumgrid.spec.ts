import { test, expect } from '@playwright/test';

// P5-03 (Milestone M5 pt.1): toggle drum-grid steps while the sequencer plays,
// and the pattern round-trips through persistence.
test('drum grid: toggle steps while playing, pattern persists', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/patch');

  await page.getByRole('button', { name: 'Drum Grid', exact: true }).click();

  // start the simulator + sequencer transport
  await page.getByTestId('audio-toggle').click();
  await expect(page.getByTestId('engine-state')).toHaveText('live', { timeout: 30000 });
  await page.getByTestId('seq-start').click();

  // toggle a couple of steps on the kick lane while playing
  const kick1 = page.getByRole('gridcell', { name: 'row 1 step 1', exact: true });
  const kick5 = page.getByRole('gridcell', { name: 'row 1 step 5', exact: true });
  await kick1.click();
  await kick5.click();
  await expect(kick1).toHaveAttribute('aria-pressed', 'true');
  await expect(kick5).toHaveAttribute('aria-pressed', 'true');

  // Clear wipes the pattern
  await page.getByTestId('drum-clear').click();
  await expect(kick1).toHaveAttribute('aria-pressed', 'false');

  // re-arm one step, let autosave flush, reload → the pattern round-trips
  await kick1.click();
  await page.waitForTimeout(900);
  await page.reload();
  await expect(page.getByRole('gridcell', { name: 'row 1 step 1', exact: true })).toHaveAttribute('aria-pressed', 'true');
});
