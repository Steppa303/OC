const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Console Errors loggen
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('CONSOLE ERROR:', msg.text());
    }
  });
  
  // Dashboard öffnen
  await page.goto('http://185.217.126.72/agent-dashboard/', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });
  
  // Screenshot
  await page.screenshot({
    path: '/root/.openclaw/workspace/dashboard-error-screenshot.png',
    fullPage: true
  });
  
  // Page Content prüfen
  const content = await page.content();
  console.log('Page loaded:', content.length > 0);
  
  // JavaScript Errors im Page Context
  const jsErrors = await page.evaluate(() => {
    return window.__dashboardErrors || [];
  });
  console.log('JS Errors:', jsErrors);
  
  await browser.close();
})();
