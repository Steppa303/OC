import { test, expect } from '@playwright/test';

// P1-08: the current patch autosaves to IndexedDB and is restored on reload.
test('patch autosaves and is restored after reload', async ({ page }) => {
  await page.goto('/patch');

  await page.getByRole('button', { name: 'VCO', exact: true }).click();
  await page.getByRole('button', { name: 'VCF', exact: true }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(2);

  // Give the debounced autosave time to flush, then reload.
  await page.waitForTimeout(900);
  await page.reload();

  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  await expect(page.locator('.react-flow__node').first()).toBeVisible();
});

test('New clears the rack', async ({ page }) => {
  await page.goto('/patch');
  await page.getByRole('button', { name: 'VCO', exact: true }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await expect(page.getByText('Empty rack')).toBeVisible();
});
