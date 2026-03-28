import { test, expect } from '@playwright/test';

test.describe('Three.js Blob', () => {
  test('should load successfully', async ({ page }) => {
    await page.goto('http://185.217.126.72/threejs-blob-simple/');
    await expect(page).toHaveTitle(/Three.js Blob/);
  });

  test('canvas should be rendered', async ({ page }) => {
    await page.goto('http://185.217.126.72/threejs-blob-simple/');
    const canvas = await page.$('canvas');
    expect(canvas).toBeTruthy();
  });

  test('should not show loading spinner after 20 seconds', async ({ page }) => {
    test.slow();
    await page.goto('http://185.217.126.72/threejs-blob-simple/');
    await page.waitForTimeout(20000);
    const spinner = await page.$('.spinner') || await page.$('div[role="status"]') || await page.$('div:has-text("Loading")');
    expect(spinner).toBeFalsy();
  });

  test('should have no console errors', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    await page.goto('http://185.217.126.72/threejs-blob-simple/');
    await page.waitForTimeout(2000);
    expect(errors).toHaveLength(0);
  });

  test('canvas should remain visible after interaction', async ({ page }) => {
    await page.goto('http://185.217.126.72/threejs-blob-simple/');
    await page.waitForTimeout(3000);
    const canvas = await page.$('canvas');
    expect(canvas).toBeTruthy();
    const canvasVisible = await canvas.isVisible();
    expect(canvasVisible).toBeTruthy();
  });
});
