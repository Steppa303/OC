// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Melodiegenerator Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Assuming the melodiegenerator is served at a specific path
    // Adjust the URL as needed for your actual deployment
    await page.goto('/melodiegenerator'); // or the actual URL
  });

  test('smoke test - page loads', async ({ page }) => {
    // Smoke test: verify the page loads without errors
    await expect(page).toHaveURL(/.*melodiegenerator.*/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('functional test - UI controls exist', async ({ page }) => {
    // Functional test: check if key UI elements exist
    // These selectors are placeholders - adjust based on actual implementation
    
    // Look for common UI elements in a music generator
    const playButton = page.locator('button').filter({ hasText: /play|start/i });
    const stopButton = page.locator('button').filter({ hasText: /stop|pause/i });
    
    // Check if at least one of these controls exists
    await expect(playButton.or(stopButton)).toBeVisible().catch(() => {
      // If specific buttons aren't found, look for common audio controls
      const audioControls = page.locator('button, input[type="range"], select');
      expect(audioControls.count()).toBeGreaterThan(0);
    });
  });

  test('functional test - generate melody button', async ({ page }) => {
    // Functional test: check if there's functionality to generate a melody
    const generateBtn = page.locator('button').filter({ hasText: /generate|create|new/i });
    const randomizeBtn = page.locator('button').filter({ hasText: /random|shuffle/i });
    
    // At least one of these should exist
    await expect(generateBtn.or(randomizeBtn)).toBeVisible().catch(() => {
      // Alternative selectors for generation controls
      const createControls = page.locator('button').filter({ hasText: /melody|music|sound/i });
      expect(createControls.count()).toBeGreaterThan(0);
    });
  });
});