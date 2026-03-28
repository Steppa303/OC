const { chromium } = require('playwright');

(async () => {
  console.log('🔍 Starte Browser-Test mit Playwright...');
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Console errors loggen
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('❌ Console Error:', msg.text());
    }
  });
  
  console.log('📱 Öffne Three.js Blob Engine...');
  await page.goto('http://185.217.126.72/threejs-blob-engine/', { 
    waitUntil: 'networkidle',
    timeout: 30000 
  });
  
  console.log('⏳ Warte auf Rendering (5s)...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Canvas prüfen
  const canvasExists = await page.$('canvas');
  if (canvasExists) {
    console.log('✅ Canvas existiert');
  } else {
    console.error('❌ Canvas NICHT gefunden!');
  }
  
  // Screenshot machen
  console.log('📸 Mache Screenshot...');
  await page.screenshot({ 
    path: '/root/.openclaw/workspace/test-results/threejs-blob-engine/PLAYWRIGHT-VERIFIED-screenshot.png',
    fullPage: true 
  });
  
  console.log('✅ Screenshot gespeichert!');
  
  // Seite auswerten
  const title = await page.title();
  console.log(`📄 Titel: ${title}`);
  
  await browser.close();
  
  console.log('\n=================================');
  console.log('✅ TEST FERTIG!');
  console.log('Screenshot: /root/.openclaw/workspace/test-results/threejs-blob-engine/PLAYWRIGHT-VERIFIED-screenshot.png');
  console.log('=================================');
})();
