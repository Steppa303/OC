import { test, expect } from '@playwright/test';

// P4-03: the core.audioin module captures the mic via getUserMedia and shows a
// live level meter. Runs against Chromium's fake media device (config launch args).
test('audio input meter activates from a fake media stream', async ({ page, context }) => {
  await context.grantPermissions(['microphone']);
  await page.goto('/patch');

  await page.getByRole('button', { name: 'Audio In', exact: true }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(1);

  await page.getByTestId('audio-mic-toggle').click();

  // the meter becomes active…
  await expect(page.getByTestId('audio-level')).toHaveAttribute('data-active', 'true');
  await expect(page.getByTestId('audio-mic-toggle')).toHaveText('Stop mic');

  // …and the analyser loop reports a numeric level (the fake device is silent)
  const level = Number(await page.getByTestId('audio-level').getAttribute('data-level'));
  expect(Number.isFinite(level)).toBe(true);
  expect(level).toBeGreaterThanOrEqual(0);

  // stopping releases it
  await page.getByTestId('audio-mic-toggle').click();
  await expect(page.getByTestId('audio-mic-toggle')).toHaveText('Enable mic');
});
