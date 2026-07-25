import { test, expect } from '@playwright/test';

// P6-01 spike: micropython-wasm runs a trivial sketch in a Worker with stubbed
// amy/amyboard modules, and the shim calls are captured on the host.
test('micropython-wasm runs a trivial sketch with amy/amyboard shims', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/dev/pysim');

  await page.getByTestId('pysim-run').click();

  await expect(page.getByTestId('pysim-status')).toContainText('done', { timeout: 40000 });
  await expect(page.getByTestId('pysim-stdout')).toContainText('sketch ran');
  await expect(page.getByTestId('pysim-calls')).toContainText('amy.send(0)');
  await expect(page.getByTestId('pysim-calls')).toHaveAttribute('data-count', '4');
});
