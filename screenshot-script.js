const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--ignore-certificate-errors',
      '--ignore-certificate-errors-spki-list',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    ],
    ignoreHTTPSErrors: true,
    acceptInsecureCerts: true
  });
  
  const page = await browser.newPage();
  
  // Extra Bot-Detection Vermeidung
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  });
  
  // App öffnen
  await page.goto('http://185.217.126.72/fishing-app/', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });
  
  // Demo-Login klicken
  await page.click('button:has-text("Demo")');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  
  // Zur Statistik navigieren
  await page.click('a:has-text("Statistik"), a:has-text("Statistics")');
  await page.waitForSelector('.StatisticsDashboard', { timeout: 10000 });
  
  // Screenshot machen
  await page.screenshot({
    path: '/root/.openclaw/workspace/statistik-screenshot.png',
    fullPage: true
  });
  
  // Anzahl der Fänge auslesen
  const catchCount = await page.$eval('[data-testid="catch-count"], .StatCard', 
    el => el.textContent.match(/\d+/)?.[0] || '0');
  
  console.log(`Screenshot gespeichert!`);
  console.log(`Angezeigte Fänge: ${catchCount}`);
  
  await browser.close();
})();