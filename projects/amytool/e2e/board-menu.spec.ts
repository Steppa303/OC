import { test, expect } from '@playwright/test';

// P3-06: the board menu issues Save (zA), Ping (zI → pong), and reboot (zB) frames.
test('board menu: save, ping/pong and reboot', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __amyUseMockBoard?: boolean }).__amyUseMockBoard = true;
  });
  await page.goto('/patch');

  await page.getByTestId('board-connect').click();
  await expect(page.getByTestId('board-status')).toHaveAttribute('data-state', 'connected');

  const sent = () =>
    page.evaluate(() => (window as unknown as { __amyBoardMock?: { sent: string[] } }).__amyBoardMock?.sent ?? []);

  await page.getByTestId('board-menu').click();

  // Save state (zA Z)
  await page.getByTestId('board-save').click();
  await expect.poll(async () => (await sent()).includes('zA Z')).toBe(true);

  // Ping → the default mock answers OK; the menu shows pong ✓
  await page.getByTestId('board-ping').click();
  await expect(page.getByTestId('board-ping')).toContainText('pong');
  expect(await sent()).toContain('zIZ');

  // Reboot (normal = zB1Z)
  await page.getByTestId('board-reboot').click();
  await expect.poll(async () => (await sent()).includes('zB1Z')).toBe(true);
});
