import { test, expect } from '@playwright/test';

// P3-03: uploading the current sketch to a (mock) board runs the zT sequence and
// surfaces an X traceback on the error path.

test('uploads the sketch through the full zT sequence', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __amyUseMockBoard?: boolean }).__amyUseMockBoard = true;
  });
  await page.goto('/patch');

  // a patch to compile + upload
  await page.getByRole('button', { name: 'VCO', exact: true }).click();

  await page.getByTestId('board-connect').click();
  await expect(page.getByTestId('board-status')).toHaveAttribute('data-state', 'connected');

  await page.getByTestId('board-upload').click();

  // the begin/chunks/done frames all went out, ending with the transfer-done exec
  await expect
    .poll(() =>
      page.evaluate(() => {
        const sent = (window as unknown as { __amyBoardMock?: { sent: string[] } }).__amyBoardMock?.sent ?? [];
        return sent.some((p) => p.startsWith('zT/user/current/sketch.py')) && sent.some((p) => p.includes('environment_transfer_done'));
      }),
    )
    .toBe(true);

  // clean upload → no error surface
  await expect(page.getByTestId('board-traceback')).toHaveCount(0);
});

test('surfaces an X traceback when the uploaded sketch errors', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as {
      __amyUseMockBoard?: boolean;
      __amyBoardResponder?: (payload: string) => string[];
    };
    w.__amyUseMockBoard = true;
    w.__amyBoardResponder = (payload) => {
      if (payload.includes('environment_transfer_done')) {
        const tb = 'Traceback (most recent call last):\n  File "sketch.py", line 3\nSyntaxError: invalid syntax';
        return ['AK', 'X' + btoa(tb)];
      }
      if (payload === 'zIZ') return ['OK'];
      if (payload.startsWith('zB')) return [];
      return ['AK'];
    };
  });
  await page.goto('/patch');
  await page.getByRole('button', { name: 'VCO', exact: true }).click();

  await page.getByTestId('board-connect').click();
  await expect(page.getByTestId('board-status')).toHaveAttribute('data-state', 'connected');
  await page.getByTestId('board-upload').click();

  const panel = page.getByTestId('board-traceback');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('SyntaxError: invalid syntax');
  await expect(panel).toContainText('line 3');
  await expect(page.getByTestId('traceback-open-code')).toBeVisible();
});
