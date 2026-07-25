import { test, expect } from '@playwright/test';

// P7-03: first-run onboarding tour, empty state, and error toasts.

test('onboarding tour steps through and is never shown again', async ({ page }) => {
  await page.goto('/patch');

  const tour = page.getByTestId('onboarding-tour');
  await expect(tour).toBeVisible();
  // the gallery is held back until the tour is done
  await expect(page.getByTestId('starter-gallery')).toHaveCount(0);

  await expect(tour).toContainText('Step 1 of 4');
  await page.getByTestId('tour-next').click();
  await expect(tour).toContainText('Step 2 of 4');
  await page.getByTestId('tour-next').click();
  await page.getByTestId('tour-next').click();
  await expect(tour).toContainText('Step 4 of 4');
  await page.getByTestId('tour-done').click();

  await expect(tour).toHaveCount(0);
  // now the starter gallery appears
  await expect(page.getByTestId('starter-gallery')).toBeVisible();

  // tour stays gone after reload
  await page.getByTestId('starter-empty').click();
  await page.reload();
  await expect(page.getByTestId('onboarding-tour')).toHaveCount(0);
});

test('empty rack shows a helpful hint', async ({ page }) => {
  await page.goto('/patch');
  await page.getByTestId('tour-skip').click();
  await page.getByTestId('starter-empty').click();
  await expect(page.locator('.patch-empty')).toContainText('Empty rack');
  await expect(page.locator('.patch-empty')).toContainText('generate');
});

test('a bad patch import surfaces an error toast', async ({ page }) => {
  await page.goto('/patch');
  await page.getByTestId('tour-skip').click();
  await page.getByTestId('starter-empty').click();

  // feed the hidden file input an invalid .amypatch
  await page.setInputFiles('input[type="file"]', {
    name: 'broken.amypatch',
    mimeType: 'application/json',
    buffer: Buffer.from('{ not valid json'),
  });

  const toaster = page.getByTestId('toaster');
  await expect(toaster).toBeVisible();
  await expect(toaster.locator('.toast-error')).toHaveCount(1);

  // clicking the toast dismisses it
  await toaster.locator('.toast-error').click();
  await expect(page.getByTestId('toaster')).toHaveCount(0);
});
