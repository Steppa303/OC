import { test, expect, type Page } from '@playwright/test';

// Stufe 3: a keyboard can be cabled straight to a VCO's note input ("play this
// oscillator with this keyboard") — the thing that used to be impossible because
// a VCO only had CV inputs. Cabling keyboard.notes → vco.notes and playing a key
// drives audible output.

async function dismissFirstRun(page: Page) {
  const tourSkip = page.getByTestId('tour-skip');
  if (await tourSkip.isVisible().catch(() => false)) await tourSkip.click();
  const empty = page.getByTestId('starter-empty');
  if (await empty.isVisible().catch(() => false)) await empty.click();
}

async function dragConnect(page: Page, from: string, to: string) {
  const a = (await page.locator(from).boundingBox())!;
  const b = (await page.locator(to).boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
}

const rms = (page: Page) =>
  page.evaluate(() => {
    const eng = (window as unknown as { __amyEngine?: { getLastOutputBlock(): Int16Array | null } }).__amyEngine;
    const block = eng?.getLastOutputBlock();
    if (!block) return 0;
    let sum = 0;
    for (const s of block) sum += s * s;
    return Math.sqrt(sum / block.length) / 32768;
  });

test('cable a keyboard to a VCO note input and play it', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/patch');
  await dismissFirstRun(page);

  await page.getByRole('button', { name: 'Keyboard', exact: true }).click();
  await page.getByRole('button', { name: 'VCO', exact: true }).click();
  await page.getByRole('button', { name: 'Output', exact: true }).click();

  // Keyboard notes → VCO notes (the new note input), VCO out → Output.
  await dragConnect(page, '[data-nodeid="keyboard1"][data-handleid="notes"]', '[data-nodeid="vco1"][data-handleid="notes"]');
  await dragConnect(page, '[data-nodeid="vco1"][data-handleid="out"]', '[data-nodeid="out1"][data-handleid="in"]');
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);

  await page.getByTestId('audio-toggle').click();
  await expect(page.getByTestId('engine-state')).toHaveText('live', { timeout: 30000 });
  await expect.poll(() => rms(page), { timeout: 15000 }).toBeLessThan(0.0005);

  // Playing a key drives the cabled VCO → audible output.
  const key = page.locator('.piano-white').first();
  const box = (await key.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect.poll(() => rms(page), { timeout: 8000 }).toBeGreaterThan(0.003);
  await page.mouse.up();
});
