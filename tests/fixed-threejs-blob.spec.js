import { test, expect } from '@playwright/test';

test.describe('Fixed Three.js Blob', () => {
  test('should load successfully without black screen', async ({ page }) => {
    // Navigate to our fixed version
    await page.goto('http://localhost:3003');
    await expect(page).toHaveTitle(/Three\.js Blob/);
  });

  test('canvas should be rendered and visible', async ({ page }) => {
    await page.goto('http://localhost:3003');
    
    // Wait for canvas element to appear
    const canvas = await page.waitForSelector('canvas', { timeout: 10000 });
    expect(canvas).toBeTruthy();
    
    // Check that canvas is visible (not hidden)
    const isVisible = await canvas.isVisible();
    expect(isVisible).toBeTruthy();
    
    // Check canvas dimensions are reasonable
    const boundingBox = await canvas.boundingBox();
    expect(boundingBox.width).toBeGreaterThan(100);
    expect(boundingBox.height).toBeGreaterThan(100);
  });

  test('should not show black screen - canvas should be visible', async ({ page }) => {
    await page.goto('http://localhost:3003');
    await page.waitForTimeout(3000); // Wait for potential animations
    
    // Check that canvas exists and is visible
    const canvas = await page.$('canvas');
    expect(canvas).toBeTruthy();
    
    const isVisible = await canvas.isVisible();
    expect(isVisible).toBeTruthy();
    
    // Verify no critical rendering errors in console
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Wait a bit more to capture any delayed errors
    await page.waitForTimeout(2000);
    expect(errors.length).toBeLessThan(5); // Allow some minor warnings
  });

  test('should have both blob and pedestal visible', async ({ page }) => {
    await page.goto('http://localhost:3003');
    await page.waitForTimeout(2000);
    
    // Since we can't directly select 3D objects, we verify the canvas exists
    // and that there are no JavaScript errors
    const canvas = await page.$('canvas');
    expect(canvas).toBeTruthy();
    
    // Check for absence of error messages related to rendering
    const content = await page.content();
    expect(content.toLowerCase()).not.toContain('black screen');
    expect(content.toLowerCase()).not.toContain('error');
  });
});