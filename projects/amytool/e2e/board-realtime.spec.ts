import { test, expect, type Page } from '@playwright/test';

// P3-05: with the board as an output target, knob deltas, keyboard notes and the
// sequencer transport all reach the (mock) board as the expected frames.

function sentFrames(page: Page) {
  return page.evaluate(
    () => (window as unknown as { __amyBoardMock?: { sent: string[] } }).__amyBoardMock?.sent ?? [],
  );
}

test('routes knob deltas, notes and sequencer to the board', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __amyUseMockBoard?: boolean }).__amyUseMockBoard = true;
  });
  await page.goto('/patch');

  // a playable patch: VCO + on-screen keyboard
  await page.getByRole('button', { name: 'VCO', exact: true }).click();
  await page.getByRole('button', { name: 'Keyboard', exact: true }).click();

  await page.getByTestId('board-connect').click();
  await expect(page.getByTestId('board-status')).toHaveAttribute('data-state', 'connected');
  await page.getByTestId('output-target').selectOption('both');

  // 1. knob/param delta → zP amy.send
  await page.getByLabel('Wave').selectOption('triangle');
  await expect
    .poll(async () => (await sentFrames(page)).some((p) => p.startsWith('zPamy.send(') && p.includes('wave=4')))
    .toBe(true);

  // 2. keyboard note → amy.send note on the allocated osc
  await page.getByRole('button', { name: 'note 60' }).click();
  await expect
    .poll(async () => (await sentFrames(page)).some((p) => p.includes('note=60')))
    .toBe(true);

  // 3. sequencer transport → zY1Z / zY0Z
  await page.getByTestId('seq-start').click();
  await expect.poll(async () => (await sentFrames(page)).includes('zY1Z')).toBe(true);
  await page.getByTestId('seq-stop').click();
  await expect.poll(async () => (await sentFrames(page)).includes('zY0Z')).toBe(true);
});
