import { test, expect } from '@playwright/test';

// P2-07: an on-canvas instruction edits the current patch (mocked LLM) and the
// change is a single undo step.
const BASE_PLAN = JSON.stringify({
  contract: 'patchplan.v1',
  name: 'Juno Pad',
  modules: [
    { id: 'juno1', type: 'core.junovoice', params: { patch: 8 } },
    { id: 'rev1', type: 'core.fx.reverb', params: { level: 0.5 } },
    { id: 'out1', type: 'core.out', params: {} },
  ],
  cables: [
    { from: 'juno1.out', to: 'rev1.in' },
    { from: 'rev1.out', to: 'out1.in' },
  ],
  notes: 'A lush Juno pad.',
});

const EDITED_PLAN = JSON.stringify({
  contract: 'patchplan.v1',
  name: 'Juno Pad',
  modules: [
    { id: 'juno1', type: 'core.junovoice', params: { patch: 8 } },
    { id: 'rev1', type: 'core.fx.reverb', params: { level: 0.5 } },
    { id: 'echo1', type: 'core.fx.echo', params: { level: 0.3, time: 350 } },
    { id: 'out1', type: 'core.out', params: {} },
  ],
  cables: [
    { from: 'juno1.out', to: 'rev1.in' },
    { from: 'rev1.out', to: 'echo1.in' },
    { from: 'echo1.out', to: 'out1.in' },
  ],
  notes: 'Added a tape echo after the reverb.',
});

test('edit the current patch by instruction, undoable in one step', async ({ page }) => {
  await page.addInitScript(
    ([base, edited]: string[]) => {
      const queue = [base, edited];
      (window as unknown as { __amyChat?: () => Promise<string> }).__amyChat = () =>
        Promise.resolve(queue.shift() ?? '{}');
    },
    [BASE_PLAN, EDITED_PLAN],
  );

  // Seed a base patch via generation, then confirm it on the canvas.
  await page.goto('/code');
  await page.getByLabel('Patch prompt').fill('a juno pad');
  await page.getByTestId('generate-submit').click();
  await expect(page.getByTestId('generate-notes')).toBeVisible();

  await page.getByRole('link', { name: 'Patch' }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(3);

  // Edit it: the instruction returns the full updated plan (now 4 modules).
  await page.getByLabel('Edit patch').fill('add a tape echo after the reverb');
  await page.getByTestId('edit-submit').click();
  await expect(page.locator('.react-flow__node')).toHaveCount(4);
  await expect(page.locator('.react-flow__node').filter({ hasText: 'Echo' })).toHaveCount(1);

  // The edit is a single undo entry.
  await page.locator('.patch-workspace').focus();
  await page.keyboard.press('Meta+z');
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  await expect(page.locator('.react-flow__node').filter({ hasText: 'Echo' })).toHaveCount(0);
});
