// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Example Tests', () => {
  test('has title', async ({ page }) => {
    // This is an example test that navigates to a sample page
    // Since we don't have a specific app running yet, we'll test with a placeholder
    await page.goto('https://example.com');
    
    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/Example Domain/);
  });

  test('page content visible', async ({ page }) => {
    await page.goto('https://example.com');
    
    // Check that main content is visible instead of specific link that might not exist
    const heading = page.locator('h1');
    const bodyText = page.locator('p').first(); // Use first() to avoid strict mode error
    
    await expect(heading).toBeVisible();
    await expect(bodyText).toBeVisible();
  });
});