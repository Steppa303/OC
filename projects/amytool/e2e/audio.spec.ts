import { test, expect } from '@playwright/test';

// Milestone M0: AMY-WASM produces audible (non-silent) output in the browser.
// Uses the /dev/audio page; RMS is read from the last rendered engine block
// (BUILD.md — no headless Node rendering with the stock build).
test('AMY engine renders non-silent audio for a Juno note', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/dev/audio');

  const readRms = async () => Number(await page.getByTestId('rms').getAttribute('data-rms'));

  await page.getByRole('button', { name: 'Start audio' }).click();
  await expect(page.getByTestId('engine-state')).toHaveText(/state: running/, { timeout: 30000 });

  // Wait for the startup bleep to fully decay so the note is what we measure.
  await expect.poll(readRms, { timeout: 15000 }).toBeLessThan(0.0005);

  await page.getByTestId('play-note').click();
  await expect.poll(readRms, { timeout: 10000 }).toBeGreaterThan(0.005);
});

// P1-05: a compiled subtractive patch (compileToWire) produces audible output.
test('compiled subtractive patch renders non-silent audio', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/dev/audio');
  const readRms = async () => Number(await page.getByTestId('rms').getAttribute('data-rms'));

  await page.getByRole('button', { name: 'Start audio' }).click();
  await expect(page.getByTestId('engine-state')).toHaveText(/state: running/, { timeout: 30000 });
  await expect.poll(readRms, { timeout: 15000 }).toBeLessThan(0.0005);

  await page.getByTestId('play-subtractive').click();
  await expect.poll(readRms, { timeout: 10000 }).toBeGreaterThan(0.005);
});
