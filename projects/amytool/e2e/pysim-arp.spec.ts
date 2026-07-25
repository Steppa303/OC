import { test, expect } from '@playwright/test';

// P6-02: a micropython loop() sketch (arpeggiator) drives amy.send into the engine
// and is audible in the simulator.
test('micropython loop() arpeggiator is audible in the simulator', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/dev/pysim');

  await page.getByTestId('pysim-arp').click();

  // the loop() retriggers notes → non-silent master output
  await expect
    .poll(async () => Number(await page.getByTestId('pysim-rms').getAttribute('data-rms')), { timeout: 25000 })
    .toBeGreaterThan(0.001);
});
