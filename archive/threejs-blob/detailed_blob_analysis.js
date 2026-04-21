const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Set a larger viewport
  await page.setViewportSize({ width: 1920, height: 1080 });
  
  // Navigate to the site
  console.log('Navigating to the site...');
  await page.goto('http://185.217.126.72/threejs-blob-engine/', { waitUntil: 'networkidle' });
  
  // Wait for potential dynamic content
  await page.waitForTimeout(8000);
  
  // Get full page content as HTML for analysis
  const htmlContent = await page.content();
  
  // Take a full page screenshot
  await page.screenshot({ path: '/root/.openclaw/workspace/full_page_screenshot.png', fullPage: true });
  
  // Take a screenshot of just the viewport
  await page.screenshot({ path: '/root/.openclaw/workspace/viewport_screenshot.png' });
  
  // Analyze the DOM structure more thoroughly
  const detailedInfo = await page.evaluate(() => {
    // Get all elements that might be related to the 3D scene
    const canvasEl = document.querySelector('canvas');
    
    // Get dimensions and styles
    const canvasDetails = canvasEl ? {
      tagName: canvasEl.tagName,
      id: canvasEl.id,
      className: canvasEl.className,
      width: canvasEl.width,
      height: canvasEl.height,
      clientWidth: canvasEl.clientWidth,
      clientHeight: canvasEl.clientHeight,
      offsetWidth: canvasEl.offsetWidth,
      offsetHeight: canvasEl.offsetHeight,
      style: {
        width: window.getComputedStyle(canvasEl).width,
        height: window.getComputedStyle(canvasEl).height,
        display: window.getComputedStyle(canvasEl).display,
        visibility: window.getComputedStyle(canvasEl).visibility,
        opacity: window.getComputedStyle(canvasEl).opacity
      }
    } : null;
    
    // Find all elements with potentially relevant classes or IDs
    const relevantElements = Array.from(document.querySelectorAll('*'))
      .filter(el => {
        const id = (el.id || '').toLowerCase();
        const className = (el.className || '').toLowerCase();
        const tagName = el.tagName.toLowerCase();
        
        return (
          id.includes('blob') || 
          className.includes('blob') || 
          id.includes('pedestal') || 
          className.includes('pedestal') || 
          id.includes('scene') || 
          className.includes('scene') || 
          id.includes('object') || 
          className.includes('object') ||
          tagName === 'canvas' ||
          className.includes('three') ||
          className.includes('renderer')
        );
      })
      .map(el => ({
        tagName: el.tagName,
        id: el.id,
        className: el.className,
        rect: el.getBoundingClientRect(),
        computedStyle: {
          backgroundColor: window.getComputedStyle(el).backgroundColor,
          color: window.getComputedStyle(el).color,
          display: window.getComputedStyle(el).display,
          visibility: window.getComputedStyle(el).visibility
        }
      }));
    
    // Check if there's a container that might hold the 3D scene
    const containers = Array.from(document.querySelectorAll('div, section, main, article, aside'))
      .filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 100 && rect.height > 100; // Large elements
      })
      .map(el => ({
        tagName: el.tagName,
        id: el.id,
        className: el.className,
        rect: el.getBoundingClientRect(),
        computedStyle: {
          backgroundColor: window.getComputedStyle(el).backgroundColor,
          display: window.getComputedStyle(el).display
        }
      }));
    
    return {
      canvasDetails,
      relevantElements,
      containers,
      totalElements: document.querySelectorAll('*').length,
      bodyBgColor: window.getComputedStyle(document.body).backgroundColor,
      documentHeight: document.documentElement.scrollHeight,
      windowHeight: window.innerHeight
    };
  });
  
  console.log('Detailed info:', JSON.stringify(detailedInfo, null, 2));
  
  // Check for any console errors that might have occurred
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    });
  });
  
  // Wait briefly to capture any delayed messages
  await page.waitForTimeout(1000);
  
  // Write results
  const fs = require('fs');
  const results = {
    detailedInfo,
    consoleMessages,
    timestamp: new Date().toISOString()
  };
  
  fs.writeFileSync('/root/.openclaw/workspace/detailed_analysis.json', JSON.stringify(results, null, 2));
  
  await browser.close();
  
  console.log('Detailed analysis completed!');
})();