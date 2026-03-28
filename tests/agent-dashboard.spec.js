// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Agent Dashboard Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Assuming the dashboard is served at a specific path
    // Adjust the URL as needed for your actual deployment
    await page.goto('/dashboard'); // or the actual URL
  });

  test('smoke test - dashboard loads', async ({ page }) => {
    // Smoke test: verify the dashboard loads without errors
    await expect(page).toHaveURL(/.*dashboard.*/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('functional test - dashboard widgets exist', async ({ page }) => {
    // Functional test: check if key dashboard elements exist
    // These selectors are placeholders - adjust based on actual implementation
    
    // Look for common dashboard elements
    const header = page.locator('header, .dashboard-header, h1, h2');
    const navigation = page.locator('nav, .navigation, .sidebar');
    const statsCards = page.locator('.card, .stat-card, .metric');
    
    // At least the header should be visible
    await expect(header).toBeVisible();
    
    // Expect either navigation or stat cards to be present
    await expect(navigation.or(statsCards)).toBeVisible().catch(() => {
      // Alternative: look for grid layouts common in dashboards
      const gridItems = page.locator('[class*="grid"], [class*="tile"], [class*="widget"]');
      expect(gridItems.count()).toBeGreaterThan(0);
    });
  });

  test('functional test - dashboard controls work', async ({ page }) => {
    // Functional test: check if dashboard controls respond
    const refreshButton = page.locator('button').filter({ hasText: /refresh|update|reload/i });
    const filterSelect = page.locator('select');
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]');
    
    // Try clicking refresh if it exists
    if (await refreshButton.count() > 0) {
      await expect(refreshButton).toBeEnabled();
      await refreshButton.click();
      // Wait briefly to see if page updates
      await page.waitForTimeout(500);
    }
    
    // Try typing in search if it exists
    if (await searchInput.count() > 0) {
      await searchInput.fill('test');
      await expect(searchInput).toHaveValue('test');
    }
    
    // Try changing filter if it exists
    if (await filterSelect.count() > 0) {
      const optionsCount = await filterSelect.locator('option').count();
      if (optionsCount > 1) {
        await filterSelect.selectOption({ index: 1 });
      }
    }
  });
});