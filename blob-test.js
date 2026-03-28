const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Console errors loggen
  page.on('console', msg => {
    if (msg.type() === 'error') console.error('Console Error:', msg.text());
  });
  
  // Network requests loggen
  page.on('response', response => {
    console.log(`Network: ${response.status()} ${response.url()}`);
  });
  
  // Navigate
  await page.goto('http://185.217.126.72/threejs-blob-simple/');
  
  // Screenshots
  await page.screenshot({ path: 'screenshot-5s.png' });
  console.log('Screenshot after 0s saved');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'screenshot-10s.png' });
  console.log('Screenshot after 5s saved');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'screenshot-15s.png' });
  console.log('Screenshot after 10s saved');
  
  // Canvas prüfen
  const canvas = await page.$('canvas');
  const isVisible = canvas ? await canvas.isVisible() : false;
  console.log('Canvas visible:', isVisible);
  
  // Loading prüfen
  const loading = await page.$('#loading');
  const loadingVisible = loading ? await loading.isVisible() : true;
  console.log('Loading visible:', loadingVisible);
  
  await browser.close();
  
  // Ergebnis
  if (isVisible && !loadingVisible) {
    console.log('✅ SUCCESS: Blob App funktioniert!');
  } else {
    console.log('❌ FAILED: Blob App hat Probleme');
  }
})();