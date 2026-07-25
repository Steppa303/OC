import { test, expect } from '@playwright/test';

// P2-06: generating from a prompt updates both the canvas and the code view,
// shows the notes with 👍/👎, and stores the verdict locally. Uses a mock chat
// injected on the window so no OpenRouter key is needed.
const MOCK_PLAN = JSON.stringify({
  contract: 'patchplan.v1',
  name: 'Warm Juno Pad',
  modules: [
    { id: 'juno1', type: 'core.junovoice', params: { patch: 8 } },
    { id: 'rev1', type: 'core.fx.reverb', params: { level: 0.5 } },
    { id: 'out1', type: 'core.out', params: {} },
  ],
  cables: [
    { from: 'juno1.out', to: 'rev1.in' },
    { from: 'rev1.out', to: 'out1.in' },
  ],
  globals: { effects: { reverb: { level: 0.5 } } },
  notes: 'A lush Juno preset pad drenched in reverb.',
});

test('generate a patch from a prompt → canvas + code update, feedback stored', async ({ page }) => {
  await page.addInitScript((planJson: string) => {
    (window as unknown as { __amyChat?: () => Promise<string> }).__amyChat = () =>
      Promise.resolve(planJson);
  }, MOCK_PLAN);

  await page.goto('/code');

  await page.getByLabel('Patch prompt').fill('a warm juno pad with reverb');
  await page.getByTestId('generate-submit').click();

  // trace runs to acceptance and the notes are shown
  await expect(page.getByTestId('generate-trace')).toContainText('accept');
  await expect(page.getByTestId('generate-notes')).toContainText('Juno preset pad');

  // the code view is now the generated sketch
  await expect(page.locator('.cm-content')).toContainText('Warm Juno Pad');
  await expect(page.locator('.cm-content')).toContainText('patch=8');

  // 👍 is stored locally (while the result panel is still shown)
  await page.getByRole('button', { name: 'thumbs up' }).click();
  const feedback = await page.evaluate(() => localStorage.getItem('amypatch:llm:feedback'));
  expect(feedback).toContain('"verdict":"up"');

  // the canvas holds the auto-laid-out modules
  await page.getByRole('link', { name: 'Patch' }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  await expect(page.locator('.react-flow__node').filter({ hasText: 'Juno Voice' })).toHaveCount(1);
});

test('the canvas ✨ button opens the generate overlay', async ({ page }) => {
  await page.goto('/patch');
  await expect(page.getByTestId('generate-panel')).toHaveCount(0);
  await page.getByTestId('canvas-generate').click();
  await expect(page.getByTestId('generate-panel')).toBeVisible();
});
