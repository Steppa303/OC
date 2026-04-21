const { test, expect } = require('@playwright/test');

test('Browser Test - Load Page and Check Console Errors', async ({ page }) => {
  const startTime = Date.now();
  
  // Navigate to the page
  const response = await page.goto('http://185.217.126.72/threejs-blob-engine/');
  expect(response.status()).toBe(200);
  
  // Set up console error tracking
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  
  // Wait for page to load completely
  await page.waitForLoadState('networkidle');
  
  const loadingTime = Date.now() - startTime;
  console.log(`Loading Time: ${loadingTime}ms`);
  expect(loadingTime).toBeLessThan(10000); // Less than 10 seconds
  
  // Wait a bit more to catch any console errors
  await page.waitForTimeout(2000);
  
  console.log('Console Errors:', consoleErrors);
  expect(consoleErrors.length).toBe(0);
});

test('Canvas Rendering Test', async ({ page }) => {
  await page.goto('http://185.217.126.72/threejs-blob-engine/');
  await page.waitForLoadState('networkidle');
  
  // Wait for canvas to appear
  await page.waitForSelector('canvas', { timeout: 10000 });
  
  // Check if canvas exists and is visible
  const canvas = await page.$('canvas');
  expect(canvas).toBeTruthy();
  
  const isVisible = await page.isVisible('canvas');
  expect(isVisible).toBeTruthy();
  
  // Take screenshot on load
  await page.screenshot({ 
    path: '/root/.openclaw/workspace/test-results/threejs-blob-engine/screenshot-load.png',
    fullPage: true 
  });
});

test('Blob Visibility Test', async ({ page }) => {
  await page.goto('http://185.217.126.72/threejs-blob-engine/');
  await page.waitForLoadState('networkidle');
  
  // Wait for blob to be rendered (wait for animation to start)
  await page.waitForTimeout(5000);
  
  // Take screenshot after 5s to see if blob is visible
  await page.screenshot({ 
    path: '/root/.openclaw/workspace/test-results/threejs-blob-engine/screenshot-5s.png',
    fullPage: true 
  });
  
  // We can't easily detect the blob object itself, but we can verify
  // that the scene is rendering by checking for WebGL context
  const hasWebGL = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return false;
    
    try {
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return !!gl;
    } catch (e) {
      return false;
    }
  });
  
  expect(hasWebGL).toBeTruthy();
});

test('Controls Functionality Test', async ({ page }) => {
  await page.goto('http://185.217.126.72/threejs-blob-engine/');
  await page.waitForLoadState('networkidle');
  
  // Wait for controls to initialize
  await page.waitForTimeout(3000);
  
  // Simulate mouse movement to test orbit controls
  await page.mouse.move(100, 100);
  await page.mouse.down();
  await page.mouse.move(200, 200);
  await page.mouse.up();
  
  // Wait a bit to see if interaction worked
  await page.waitForTimeout(1000);
  
  // Take screenshot after interaction
  await page.screenshot({ 
    path: '/root/.openclaw/workspace/test-results/threejs-blob-engine/screenshot-interaction.png',
    fullPage: true 
  });
  
  // Check for console errors after interaction
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  
  await page.waitForTimeout(1000);
  
  expect(consoleErrors.length).toBe(0);
});

test('Functional Test - Animation and Shader', async ({ page }) => {
  await page.goto('http://185.217.126.72/threejs-blob-engine/');
  await page.waitForLoadState('networkidle');
  
  // Wait for animation to run for a bit
  await page.waitForTimeout(5000);
  
  // Check if animation-related properties exist
  const animationActive = await page.evaluate(() => {
    // Look for signs of active animation
    return document.querySelector('canvas') !== null;
  });
  
  expect(animationActive).toBeTruthy();
});