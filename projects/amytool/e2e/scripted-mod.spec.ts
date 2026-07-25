import { test, expect, type Page } from '@playwright/test';

// Stufe 5: keyboard aftertouch → echo feedback is a *scripted* modulation (a
// non-coef target realized by a generated control loop). Raising the pressure
// macro feeds the echo more, so the sustained output gets louder — audibly, in
// the simulator.

async function dismissFirstRun(page: Page) {
  await page.getByTestId('tour-skip').click();
  await page.getByTestId('starter-empty').click();
}

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
    const eng = (window as unknown as { __amyEngine?: { getLastOutputBlock(): Int16Array | null } }).__amyEngine;
    const block = eng?.getLastOutputBlock();
    if (!block) return 0;
    let sum = 0;
    for (const s of block) sum += s * s;
    return Math.sqrt(sum / block.length) / 32768;
  });

test('aftertouch → delay feedback: raising pressure boosts the echo (scripted mod)', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/patch');
  await dismissFirstRun(page);

  await add(page, 'Keyboard');
  await add(page, 'Noise');
  await add(page, 'Echo');
  await add(page, 'Output');

  // Sound path: Noise → Echo → Output. Modulation: keyboard aftertouch → echo FB.
  await dragConnect(page, '[data-nodeid="noise1"][data-handleid="out"]', '[data-nodeid="echo1"][data-handleid="in"]');
  await dragConnect(page, '[data-nodeid="echo1"][data-handleid="out"]', '[data-nodeid="out1"][data-handleid="in"]');
  await dragConnect(
    page,
    '[data-nodeid="keyboard1"][data-handleid="aftertouch"]',
    '[data-nodeid="echo1"][data-handleid="fb_cv"]',
  );
  await expect(page.locator('.react-flow__edge')).toHaveCount(3);

  await page.getByTestId('audio-toggle').click();
  await expect(page.getByTestId('engine-state')).toHaveText('live', { timeout: 30000 });

  // Hold a key so the noise sustains through the echo.
  const key = page.locator('.piano-white').first();
  const box = (await key.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect.poll(() => rms(page), { timeout: 10000 }).toBeGreaterThan(0.002);

  // Pressure low: baseline level. Then raise it → more feedback → louder.
  const pressure = page.locator('[data-id="keyboard1"]').getByLabel('Pressure');
  await pressure.fill('0');
  await page.waitForTimeout(600);
  const quiet = await rms(page);

  await pressure.fill('1');
  await expect.poll(() => rms(page), { timeout: 10000 }).toBeGreaterThan(quiet * 1.3);

  await page.mouse.up();
});
