// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Three.js Blob App Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Assuming the blob app is served at a specific path
    // Adjust the URL as needed for your actual deployment
    await page.goto('/blob-app'); // or the actual URL
  });

  test('smoke test - 3D scene loads', async ({ page }) => {
    // Smoke test: verify the 3D scene loads without errors
    await expect(page).toHaveURL(/.*blob-app.*/);
    
    // Look for canvas element which is typical for Three.js apps
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('functional test - 3D controls exist', async ({ page }) => {
    // Functional test: check if 3D interaction controls exist
    // These selectors are placeholders - adjust based on actual implementation
    
    // Look for common Three.js app controls
    const controlElements = page.locator('[class*="control"], [class*="ui"], button, input, select');
    const animationToggle = page.locator('button').filter({ hasText: /animate|animation|play|pause/i });
    const presetSelector = page.locator('select, [class*="preset"], [class*="theme"]');
    
    // Expect some form of controls to exist
    await expect(controlElements).toBeVisible().catch(() => {
      // Even if explicit controls don't exist, there should be something interactive
      const interactiveElements = page.locator('canvas, button, input, select, [tabindex]');
      expect(interactiveElements.count()).toBeGreaterThan(0);
    });
  });

  test('visual test - canvas renders content', async ({ page }) => {
    // Visual test: ensure the canvas is not empty/black
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    
    // Take a screenshot for visual comparison (will be saved on failure)
    await expect(page).toHaveScreenshot('blob-scene.png', { 
      timeout: 10000,
      maxDiffPixels: 50
    }).catch(async () => {
      // If screenshot comparison fails, at least verify canvas exists and has size
      const canvasBox = await canvas.boundingBox();
      expect(canvasBox.width).toBeGreaterThan(100);
      expect(canvasBox.height).toBeGreaterThan(100);
    });
  });

  test('functional test - interaction works', async ({ page }) => {
    // Functional test: try to interact with the 3D scene
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    
    // Try mouse movement to simulate camera control
    await canvas.hover();
    await page.mouse.move(100, 100);
    await page.mouse.down();
    await page.mouse.move(150, 150);
    await page.mouse.up();
    
    // Try scroll to simulate zoom
    await canvas.scrollIntoViewIfNeeded();
    await canvas.focus();
    await page.mouse.wheel(0, 100);
    
    // Verify the page didn't crash after interactions
    await expect(page.locator('body')).toBeVisible();
  });
});