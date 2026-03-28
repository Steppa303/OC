#!/usr/bin/env node

import puppeteer from 'puppeteer';

(async () => {
  // Launch Puppeteer with specific flags for WebGL support
  const browser = await puppeteer.launch({
    headless: 'new',  // Headless mode für WebGL
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--disable-gpu-sandbox',
      '--disable-extensions',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--enable-accelerated-2d-canvas',
      '--use-gl=egl'
    ]
  });
  
  const page = await browser.newPage();
  
  // Set viewport
  await page.setViewport({ width: 1280, height: 720 });
  
  // Navigate to the app
  console.log('Navigating to http://localhost:3004/threejs-blob-engine/');
  await page.goto('http://localhost:3004/threejs-blob-engine/', { 
    waitUntil: 'networkidle0',
    timeout: 60000 
  });
  
  console.log('Page loaded successfully');
  
  // Wait a bit more for the scene to initialize
  await new Promise(r => setTimeout(r, 8000));
  
  // Take screenshots - full page to capture canvas even if not visible
  await page.screenshot({ 
    path: '/root/.openclaw/workspace/test-results/threejs-blob-engine/puppeteer-initial.png',
    fullPage: true 
  });
  
  console.log('Initial screenshot taken');
  
  // Try to interact with the scene
  await page.mouse.move(500, 300);
  await page.mouse.down();
  await page.mouse.move(600, 350);
  await page.mouse.up();
  
  await new Promise(r => setTimeout(r, 2000));
  
  await page.screenshot({ 
    path: '/root/.openclaw/workspace/test-results/threejs-blob-engine/puppeteer-after-interaction.png',
    fullPage: true 
  });
  
  console.log('Interaction screenshot taken');
  
  // Final checks
  const finalStatus = await page.evaluate(() => {
    // Check if the app loaded without errors
    const rootDiv = document.getElementById('root');
    const hasChildren = rootDiv && rootDiv.children.length > 0;
    
    // Check for any error boundaries or error messages
    const errorElements = Array.from(document.querySelectorAll('*')).filter(el => 
      el.textContent && 
      (el.textContent.toLowerCase().includes('error') || 
       el.textContent.toLowerCase().includes('failed'))
    );
    
    return {
      appMounted: !!rootDiv && hasChildren,
      hasErrorMessages: errorElements.length > 0,
      errorElements: errorElements.map(el => el.textContent.substring(0, 100))
    };
  });
  
  console.log('Final status:', finalStatus);
  
  // Summary
  console.log('\n--- TEST SUMMARY ---');
  console.log(`Page loads: ✓`);
  console.log(`App mounted: ${finalStatus.appMounted ? '✓' : '✗'}`);
  console.log(`No error messages: ${!finalStatus.hasErrorMessages ? '✓' : '✗'}`);
  
  if (finalStatus.hasErrorMessages) {
    console.log('\nDOM Error Messages:');
    finalStatus.errorElements.forEach(msg => console.log(`- ${msg}`));
  }
  
  await browser.close();
  
  // Exit with appropriate code based on critical failures
  const criticalFailures = [
    !finalStatus.appMounted
  ].filter(Boolean).length;
  
  console.log(`\nCritical failures: ${criticalFailures}`);
  process.exit(criticalFailures > 0 ? 1 : 0);
})();
