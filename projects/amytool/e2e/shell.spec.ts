import { test, expect } from '@playwright/test';

test('shell loads dark and tabs navigate', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/patch$/);
  await expect(page.getByText('AmyPatch Studio')).toBeVisible();

  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(14, 15, 18)'); // --bg-app

  await page.getByRole('link', { name: 'Library' }).click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByTestId('library-grid')).toBeVisible();
});
