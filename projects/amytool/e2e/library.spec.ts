import { test, expect } from '@playwright/test';

// P5-01: the /library browser filters/searches, favorites persist, and a card
// inserts a module onto the canvas.
test('library browser: search, category filter, favorites, insert', async ({ page }) => {
  await page.goto('/library');

  // search narrows the grid
  await page.getByLabel('Search modules').fill('reverb');
  await expect(page.getByTestId('card-core.fx.reverb')).toBeVisible();
  await expect(page.getByTestId('card-core.vco')).toHaveCount(0);
  await page.getByLabel('Search modules').fill('');

  // category filter
  await page.getByRole('tab', { name: 'Filters' }).click();
  await expect(page.getByTestId('card-core.vcf')).toBeVisible();
  await expect(page.getByTestId('card-core.vco')).toHaveCount(0);

  // favorite a module → it survives a reload and shows under Favorites
  await page.getByRole('tab', { name: 'All' }).click();
  await page.getByTestId('card-core.vco').getByRole('button', { name: 'favorite' }).click();
  await page.reload();
  await page.getByRole('tab', { name: '★ Favorites' }).click();
  await expect(page.getByTestId('card-core.vco')).toBeVisible();
  await expect(page.getByTestId('card-core.vcf')).toHaveCount(0);

  // insert lands the module on the canvas
  await page.getByTestId('card-core.vco').getByRole('button', { name: 'Add to patch' }).click();
  await expect(page).toHaveURL(/\/patch$/);
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
});
