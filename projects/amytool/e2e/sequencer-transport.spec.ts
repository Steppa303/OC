import { test, expect } from '@playwright/test';

// P5-02: the transport bar edits tempo and starts/stops the sequencer on both the
// simulator and the (mock) board.
test('tempo edit + sequencer transport reaches the board (zY)', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __amyUseMockBoard?: boolean }).__amyUseMockBoard = true;
  });
  await page.goto('/patch');

  // set tempo — it persists in the patch (reload restores it via autosave)
  await page.getByTestId('tempo').fill('140');
  await page.getByTestId('tempo').blur();
  await expect(page.getByTestId('tempo')).toHaveValue('140');

  // route to the board and drive the sequencer transport
  await page.getByTestId('board-connect').click();
  await expect(page.getByTestId('board-status')).toHaveAttribute('data-state', 'connected');
  await page.getByTestId('output-target').selectOption('both');

  const sent = () =>
    page.evaluate(() => (window as unknown as { __amyBoardMock?: { sent: string[] } }).__amyBoardMock?.sent ?? []);

  await page.getByTestId('seq-start').click();
  await expect.poll(async () => (await sent()).includes('zY1Z')).toBe(true);
  await page.getByTestId('seq-stop').click();
  await expect.poll(async () => (await sent()).includes('zY0Z')).toBe(true);
});
