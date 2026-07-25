import { test, expect } from '@playwright/test';

// P3-02: the topbar board chip connects/disconnects and reflects transport state.
// Uses the in-memory MockTransport (no hardware) via a window flag.
test('board status chip connects and disconnects (mock transport)', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __amyUseMockBoard?: boolean }).__amyUseMockBoard = true;
  });
  await page.goto('/patch');

  const chip = page.getByTestId('board-status');
  await expect(chip).toHaveAttribute('data-state', 'disconnected');
  await expect(page.getByTestId('board-label')).toHaveText('no board');

  await page.getByTestId('board-connect').click();
  await expect(chip).toHaveAttribute('data-state', 'connected');
  await expect(page.getByTestId('board-label')).toHaveText('AMYboard');

  await page.getByTestId('board-connect').click();
  await expect(chip).toHaveAttribute('data-state', 'disconnected');
});
