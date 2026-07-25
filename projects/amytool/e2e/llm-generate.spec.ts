import { test, expect } from '@playwright/test';

// P2-05: the verify→repair pipeline (mocked model) produces a valid PatchDoc that
// compiles and renders audibly through the live AMY engine. Uses the /dev/llm
// harness; RMS is read from the last rendered block (no headless Node render).
test('LLM pipeline generates a valid patch that renders non-silent audio', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/dev/llm');

  await page.getByTestId('run-pipeline').click();

  await expect(page.getByTestId('result-status')).toHaveText(/accepted in 1 attempt/, {
    timeout: 30000,
  });
  await expect(page.getByTestId('trace')).toContainText('accept ok');
  await expect(page.getByTestId('notes')).toContainText('saw lead');

  const rms = Number(await page.getByTestId('rms').getAttribute('data-rms'));
  expect(rms).toBeGreaterThan(0.0005);
});
