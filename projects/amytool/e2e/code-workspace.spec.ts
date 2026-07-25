import { test, expect } from '@playwright/test';

// P2-04: the code workspace is a live projection of the PatchDoc, and pasting a
// sketch parses it back onto the canvas (Level A/B, no execution).

test('paste code parses onto the canvas (paste → graph)', async ({ page }) => {
  await page.goto('/code');
  await page.locator('.cm-content').waitFor();

  // Simulate a real paste of foreign Python (a def loop the compiler can't model).
  await page.evaluate(() => {
    const el = document.querySelector('.cm-content');
    if (!el) return;
    const dt = new DataTransfer();
    dt.setData('text/plain', 'import amy\ndef loop():\n    print("hi")\n');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });

  // The residue is surfaced in the warnings panel...
  await expect(page.getByTestId('code-warnings')).toContainText('Custom Code module');

  // ...and synced to the canvas as a read-only Custom Code module.
  await page.getByRole('link', { name: 'Patch' }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
  await expect(page.locator('.react-flow__node')).toContainText('Custom Code');
  await expect(page.locator('.react-flow__node')).toContainText('def loop():');
});

test('canvas param changes project into the code (knob → code updates)', async ({ page }) => {
  await page.goto('/patch');
  await page.getByRole('button', { name: 'VCO', exact: true }).click();

  await page.getByRole('link', { name: 'Code' }).click();
  await expect(page.locator('.cm-content')).toContainText("wave=2, freq='440,1'");

  // Change the oscillator waveform on the canvas, then return to the code view.
  await page.getByRole('link', { name: 'Patch' }).click();
  await page.getByLabel('Wave').selectOption('triangle');
  await page.getByRole('link', { name: 'Code' }).click();

  await expect(page.locator('.cm-content')).toContainText("wave=4, freq='440,1'");
  await expect(page.locator('.cm-content')).not.toContainText("wave=2, freq='440,1'");
});

test('the generated header is read-only', async ({ page }) => {
  await page.goto('/code');
  const firstLine = page.locator('.cm-line').first();
  await expect(firstLine).toContainText('AmyPatch Studio sketch');
  // Put the cursor at the very start (inside the header) and try to type.
  await firstLine.click();
  await page.keyboard.press('Home');
  await page.keyboard.type('XXX');
  await expect(page.locator('.cm-content')).not.toContainText('XXX');
});
