const { test, expect } = require('@playwright/test');

test.describe('Three.js Blob Engine', () => {
  test('Seite lädt erfolgreich', async ({ page }) => {
    await page.goto('http://185.217.126.72/threejs-blob-engine/');
    await expect(page).toHaveTitle(/Three.js Blob/);
    console.log('✅ Seite lädt erfolgreich');
  });

  test('Canvas wird gerendert', async ({ page }) => {
    await page.goto('http://185.217.126.72/threejs-blob-engine/');
    await page.waitForTimeout(3000); // Warte auf Rendering
    const canvas = await page.$('canvas');
    expect(canvas).toBeTruthy();
    console.log('✅ Canvas wird gerendert');
  });

  test('Keine Console Errors', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    await page.goto('http://185.217.126.72/threejs-blob-engine/');
    await page.waitForTimeout(5000);
    expect(errors).toHaveLength(0);
    console.log('✅ Keine Console Errors');
  });

  test('Screenshot nach Laden', async ({ page }) => {
    await page.goto('http://185.217.126.72/threejs-blob-engine/');
    await page.waitForTimeout(5000);
    await page.screenshot({ 
      path: '/root/.openclaw/workspace/test-results/threejs-blob-engine/test-screenshot.png',
      fullPage: true 
    });
    console.log('✅ Screenshot erstellt');
  });
});
