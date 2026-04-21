const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Navigate to the site
  await page.goto('http://185.217.126.72/threejs-blob-engine/');
  
  // Wait for the canvas to appear
  await page.waitForSelector('canvas', { timeout: 10000 });
  
  // Take screenshot
  await page.screenshot({ path: '/root/.openclaw/workspace/blob_screenshot.png', fullPage: true });
  
  // Check for console errors
  const consoleErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  
  // Wait a bit to capture any console errors
  await page.waitForTimeout(2000);
  
  // Get page title and basic info
  const title = await page.title();
  const url = page.url();
  
  // Check if canvas element exists
  const canvasExists = await page.$('canvas');
  
  // Check for blob/pedestal elements if they have specific selectors
  const hasBlob = await page.$eval('*', el => {
    // Try to find elements that might represent the blob or pedestal
    return document.querySelector('[id*="blob" i], [class*="blob" i], [id*="object" i], [class*="object" i], [id*="pedestal" i], [class*="pedestal" i]');
  }).catch(() => null);
  
  console.log('Title:', title);
  console.log('URL:', url);
  console.log('Canvas exists:', !!canvasExists);
  console.log('Has potential blob element:', !!hasBlob);
  console.log('Console errors:', consoleErrors);
  
  await browser.close();
  
  // Write results to file for further processing
  const fs = require('fs');
  const results = {
    title,
    url,
    canvasExists: !!canvasExists,
    hasBlob: !!hasBlob,
    consoleErrors,
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync('/root/.openclaw/workspace/test_results.json', JSON.stringify(results, null, 2));
})();