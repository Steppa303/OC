import { test, expect, type Page } from '@playwright/test';

// Milestone M1: build a subtractive patch, play it via the on-screen keyboard,
// and tweak the cutoff live — all in the browser simulator.

async function add(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).click();
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
    const eng = (window as unknown as { __amyEngine?: { getLastOutputBlock(): Int16Array | null } })
      .__amyEngine;
    const block = eng?.getLastOutputBlock();
    if (!block) return 0;
    let sum = 0;
    for (const s of block) sum += s * s;
    return Math.sqrt(sum / block.length) / 32768;
  });

test('play a subtractive patch on the keyboard and tweak cutoff live', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/patch');

  await add(page, 'Keyboard');
  await add(page, 'VCO');
  await add(page, 'VCF');
  await add(page, 'Output');
  await dragConnect(page, '[data-nodeid="vco1"][data-handleid="out"]', '[data-nodeid="vcf1"][data-handleid="in"]');
  await dragConnect(page, '[data-nodeid="vcf1"][data-handleid="out"]', '[data-nodeid="out1"][data-handleid="in"]');

  await page.getByTestId('audio-toggle').click();
  await expect(page.getByTestId('engine-state')).toHaveText('live', { timeout: 30000 });
  await expect.poll(() => rms(page), { timeout: 15000 }).toBeLessThan(0.0005);

  const key = page.locator('.piano-white').first();
  const playKey = async () => {
    const box = (await key.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect.poll(() => rms(page), { timeout: 8000 }).toBeGreaterThan(0.003);
    await page.mouse.up();
  };

  // Play a note.
  await playKey();

  // Tweak the cutoff (recompiles a reset-free param update), then play again —
  // the patch keeps working after a live edit.
  const cutoff = page.locator('[data-id="vcf1"]').getByLabel('Cutoff');
  await cutoff.fill('5000');
  await page.waitForTimeout(200);
  await playKey();
});
