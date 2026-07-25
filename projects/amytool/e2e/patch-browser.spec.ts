import { test, expect, type Page } from '@playwright/test';

// P7-01: patch browser upgrades — tags, search, sort, thumbnails — and the
// first-run starter template gallery.

async function saveCurrentPatch(page: Page, name: string, tag: string) {
  await page.getByLabel('Patch name').fill(name);
  await page.getByLabel('Add tag').fill(tag);
  await page.getByLabel('Add tag').press('Enter');
  // wait out the 500 ms autosave debounce
  await page.waitForTimeout(800);
}

// First-run shows the onboarding tour ahead of the gallery (P7-03).
async function skipTour(page: Page) {
  await page.getByTestId('tour-skip').click();
}

test('starter gallery on first run: pick a template, never shown again', async ({ page }) => {
  await page.goto('/patch');
  await skipTour(page);

  const gallery = page.getByTestId('starter-gallery');
  await expect(gallery).toBeVisible();
  // template cards render with thumbnails
  await expect(gallery.locator('[data-testid="patch-thumb"]')).toHaveCount(3);

  await page.getByTestId('starter-starter.drums').click();
  await expect(gallery).toHaveCount(0);
  await expect(page.locator('.react-flow__node').filter({ hasText: 'Drum Grid' })).toHaveCount(1);
  await expect(page.getByLabel('Patch name')).toHaveValue('Drum Machine');

  // autosave, then reload: the gallery must not reappear
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.locator('.react-flow__node').filter({ hasText: 'Drum Grid' })).toHaveCount(1);
  await expect(page.getByTestId('starter-gallery')).toHaveCount(0);
});

test('"Start empty" dismisses the gallery for good', async ({ page }) => {
  await page.goto('/patch');
  await skipTour(page);
  await expect(page.getByTestId('starter-gallery')).toBeVisible();
  await page.getByTestId('starter-empty').click();
  await expect(page.getByTestId('starter-gallery')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('starter-gallery')).toHaveCount(0);
});

test('tags, search, sort and thumbnails in the patch browser', async ({ page }) => {
  await page.goto('/patch');
  await skipTour(page);
  await page.getByTestId('starter-empty').click();

  // Two saved patches with different names/tags (add a module so thumbs differ).
  await page.getByRole('button', { name: 'VCO', exact: true }).click();
  await saveCurrentPatch(page, 'Alpha Bass', 'bass');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('button', { name: 'VCF', exact: true }).click();
  await saveCurrentPatch(page, 'Zeta Lead', 'lead');

  // current-patch tag chips are editable
  await expect(page.getByTestId('patch-tags')).toContainText('lead');

  await page.getByRole('button', { name: 'Patches ▾' }).click();
  const browser = page.getByTestId('patch-browser');
  const entries = browser.locator('.patch-menu-entry');
  await expect(entries).toHaveCount(2);
  // thumbnails render per entry
  await expect(browser.locator('[data-testid="patch-thumb"]')).toHaveCount(2);
  // most recently modified first
  await expect(entries.first()).toContainText('Zeta Lead');

  // search by name
  await page.getByLabel('Search patches').fill('alpha');
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText('Alpha Bass');
  await page.getByLabel('Search patches').fill('');

  // filter by tag chip
  await browser.getByRole('button', { name: 'lead', exact: true }).click();
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText('Zeta Lead');
  await browser.getByRole('button', { name: 'lead', exact: true }).click();

  // sort by name puts Alpha first
  await page.getByLabel('Sort patches').selectOption('name');
  await expect(entries.first()).toContainText('Alpha Bass');

  // opening an entry loads the patch
  await entries.first().click();
  await expect(page.getByLabel('Patch name')).toHaveValue('Alpha Bass');
  await expect(page.locator('.react-flow__node').filter({ hasText: 'VCO' })).toHaveCount(1);

  // removing a tag updates the doc
  await page.getByRole('button', { name: 'Remove tag bass' }).click();
  await expect(page.getByTestId('patch-tags')).not.toContainText('bass');
});
