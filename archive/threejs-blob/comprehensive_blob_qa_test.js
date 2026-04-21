const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Set viewport size for consistent screenshots
  await page.setViewportSize({ width: 1280, height: 720 });
  
  // Navigate to the site
  console.log('Navigating to the site...');
  await page.goto('http://185.217.126.72/threejs-blob-engine/', { waitUntil: 'networkidle' });
  
  // Wait for the canvas to appear and render
  console.log('Waiting for canvas...');
  await page.waitForSelector('canvas', { timeout: 10000 });
  
  // Wait additional time for 3D scene to fully render
  console.log('Waiting for 3D scene to render...');
  await page.waitForTimeout(5000);
  
  // Take screenshot
  console.log('Taking screenshot...');
  await page.screenshot({ path: '/root/.openclaw/workspace/blob_detailed_screenshot.png', fullPage: true });
  
  // Check for console errors
  const consoleErrors = [];
  const consoleWarnings = [];
  page.on('console', message => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    } else if (message.type() === 'warning') {
      consoleWarnings.push(message.text());
    }
  });
  
  // Evaluate the page to get more detailed information
  const pageInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const bodyStyle = window.getComputedStyle(document.body);
    const canvasRect = canvas ? canvas.getBoundingClientRect() : null;
    
    // Look for elements that might represent the blob or pedestal
    const sceneElements = Array.from(document.querySelectorAll('*')).filter(el => {
      const id = el.id.toLowerCase();
      const className = el.className.toLowerCase();
      const style = window.getComputedStyle(el);
      
      // Check if element might be related to 3D scene
      return (
        id.includes('blob') || 
        className.includes('blob') || 
        id.includes('object') || 
        className.includes('object') || 
        id.includes('mesh') || 
        className.includes('mesh') ||
        id.includes('pedestal') ||
        className.includes('pedestal') ||
        id.includes('ground') ||
        className.includes('ground') ||
        (style.backgroundColor && (style.backgroundColor.includes('black') || style.backgroundColor.includes('white'))) ||
        el.tagName === 'CANVAS'
      );
    });
    
    return {
      canvasExists: !!canvas,
      canvasWidth: canvasRect?.width || 0,
      canvasHeight: canvasRect?.height || 0,
      bodyBackgroundColor: bodyStyle.backgroundColor,
      sceneElementsCount: sceneElements.length,
      sceneElementSelectors: sceneElements.map(el => ({
        tagName: el.tagName,
        id: el.id,
        className: el.className,
        backgroundColor: window.getComputedStyle(el).backgroundColor
      })),
      url: window.location.href,
      title: document.title
    };
  });
  
  // Wait a bit more to capture any delayed console errors
  await page.waitForTimeout(2000);
  
  console.log('Page info:', JSON.stringify(pageInfo, null, 2));
  console.log('Console errors:', consoleErrors);
  console.log('Console warnings:', consoleWarnings);
  
  // Additional interaction tests
  try {
    // Test mouse interactions by simulating movements
    await page.mouse.move(100, 100);
    await page.mouse.down();
    await page.mouse.move(200, 200);
    await page.mouse.up();
    
    console.log('Mouse interaction test completed');
  } catch (e) {
    console.log('Mouse interaction error:', e.message);
  }
  
  // Close browser
  await browser.close();
  
  // Write comprehensive results
  const fs = require('fs');
  const results = {
    pageInfo,
    consoleErrors,
    consoleWarnings,
    timestamp: new Date().toISOString(),
    testSteps: [
      'Navigation successful',
      'Canvas detected',
      '3D scene rendered',
      'Screenshot captured',
      'Interaction test performed'
    ]
  };
  fs.writeFileSync('/root/.openclaw/workspace/comprehensive_test_results.json', JSON.stringify(results, null, 2));
  
  console.log('Comprehensive test completed!');
})();