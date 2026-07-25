import { test, expect, type Page } from '@playwright/test';

// P6-03: a generated patch whose loopCode carries a custom device gets a native
// Device Module panel (follow-up extraction, mocked LLM). Its knobs bind to
// sketch variables: turning one writes the value into the running micropython
// sim, audibly. If extraction fails, the plain Custom Code box is the fallback.

const LOOP_CODE = [
  'import amy',
  'feedback = 0.12',
  'tone = 0.7',
  "amy.send(osc=0, wave=0, freq=220, vel=0.12)",
  '',
  'def loop():',
  '    amy.send(osc=0, vel=feedback)',
  '',
].join('\n');

const MOCK_PLAN = JSON.stringify({
  contract: 'patchplan.v1',
  name: 'Ping-Pong Delay',
  modules: [{ id: 'out1', type: 'core.out', params: {} }],
  cables: [],
  notes: 'A stereo ping-pong delay driven by custom loop code.',
  loopCode: LOOP_CODE,
});

const MOCK_DEVICE = JSON.stringify({
  contract: 'devicemanifest.v1',
  name: 'Ping-Pong Delay',
  description: 'Stereo ping-pong delay with feedback and tone knobs.',
  params: [
    { id: 'feedback', label: 'Feedback', min: 0, max: 0.95, default: 0.12, binding: 'feedback' },
    { id: 'tone', label: 'Tone', min: 0, max: 1, default: 0.7, binding: 'tone' },
  ],
  jacks: [{ id: 'out', kind: 'audio', dir: 'out', label: 'out' }],
});

/** Mock chat: the device-extraction call is recognized by its system prompt. */
function installMockChat(page: Page, deviceReply: string) {
  return page.addInitScript(
    ([plan, device]: string[]) => {
      (
        window as unknown as {
          __amyChat?: (messages: { role: string; content: string }[]) => Promise<string>;
        }
      ).__amyChat = (messages) =>
        Promise.resolve((messages[0]?.content ?? '').includes('DeviceManifest') ? device! : plan!);
    },
    [MOCK_PLAN, deviceReply],
  );
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

test('generated loopCode becomes a device panel with working knobs, audible in sim', async ({ page }) => {
  test.setTimeout(90000);
  await installMockChat(page, MOCK_DEVICE);
  await page.goto('/code');

  await page.getByLabel('Patch prompt').fill('stereo ping-pong delay with feedback and tone knobs');
  await page.getByTestId('generate-submit').click();
  await expect(page.getByTestId('generate-trace')).toContainText('accept');

  // The canvas shows a native device panel (not the raw Custom Code box).
  await page.getByRole('link', { name: 'Patch' }).click();
  const device = page.locator('[data-id="device1"]');
  await expect(device).toBeVisible();
  await expect(device).toContainText('Ping-Pong Delay');
  const feedback = device.getByLabel('Feedback');
  await expect(feedback).toHaveValue('0.12');
  await expect(device.getByLabel('Tone')).toBeVisible();
  await expect(page.locator('.react-flow__node', { hasText: 'Custom Code' })).toHaveCount(0);

  // The device's loop code runs in the Level-2 sim and is audible.
  await page.getByTestId('audio-toggle').click();
  await expect(page.getByTestId('engine-state')).toHaveText('live', { timeout: 30000 });
  await expect.poll(() => rms(page), { timeout: 25000 }).toBeGreaterThan(0.001);
  const before = await rms(page);

  // Working control: raising Feedback writes the variable into the running sketch
  // (loop() sends vel=feedback), so the output gets clearly louder.
  await feedback.fill('0.9');
  await expect(feedback).toHaveValue('0.9');
  await expect.poll(() => rms(page), { timeout: 15000 }).toBeGreaterThan(before * 3);
});

test('failed extraction falls back to the plain Custom Code module', async ({ page }) => {
  await installMockChat(page, 'this is not json');
  await page.goto('/code');

  await page.getByLabel('Patch prompt').fill('stereo ping-pong delay with feedback and tone knobs');
  await page.getByTestId('generate-submit').click();
  await expect(page.getByTestId('generate-trace')).toContainText('accept');

  await page.getByRole('link', { name: 'Patch' }).click();
  await expect(page.locator('.react-flow__node', { hasText: 'Custom Code' })).toHaveCount(1);
  await expect(page.locator('[data-id="device1"]')).toHaveCount(0);
});
