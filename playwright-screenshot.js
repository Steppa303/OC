const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--ignore-certificate-errors',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });
  
  const page = await browser.newPage();
  
  // Extra Bot-Detection Vermeidung
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    
    // Andere Bot-Indikatoren entfernen
    delete navigator.__proto__.webdriver;
  });
  
  // Setze einen realistischen User-Agent
  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  });
  
  try {
    // App öffnen
    console.log('Öffne Seite...');
    await page.goto('http://185.217.126.72/fishing-app/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    // Kurze Pause für JS-Initialisierung
    console.log('Warte auf JS-Initialisierung...');
    await page.waitForTimeout(5000);
    
    // Seite scrollen um alles zu laden
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    
    // Nochmal zurückscrollen
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    
    // Warte auf sichtbare Elemente
    console.log('Suche nach sichtbaren Elementen...');
    
    // Versuche verschiedene Selektoren für den Demo-Button
    const selectors = [
      'button:has-text("Demo")',
      'button:has-text("demo")',
      'button:has-text("DEMO")',
      '[data-testid="demo-button"]',
      '.demo-button',
      'button.demo',
      'button[type="button"]:has-text("Demo")',
      'button:visible:has-text("Demo")',
      'button:contains("Demo")',
      'text=Demo'
    ];
    
    let demoButtonFound = false;
    for (const selector of selectors) {
      try {
        console.log(`Versuche Selector: ${selector}`);
        const element = await page.locator(selector).first();
        if (await element.isVisible()) {
          console.log(`Demo Button gefunden mit: ${selector}`);
          await element.click();
          demoButtonFound = true;
          break;
        }
      } catch (e) {
        console.log(`Selector ${selector} nicht gefunden: ${e.message}`);
        continue;
      }
    }
    
    if (!demoButtonFound) {
      console.log('Kein Demo Button gefunden, versuche ohne Login...');
      
      // Versuche direkt zur Statistik zu navigieren
      const statsSelectors = [
        'a:has-text("Statistik")',
        'a:has-text("Statistics")',
        'a:has-text("Stats")',
        '[href*="stat"]',
        '.statistics',
        '.stats'
      ];
      
      for (const selector of statsSelectors) {
        try {
          console.log(`Versuche Stats Selector: ${selector}`);
          const element = await page.locator(selector).first();
          if (await element.isVisible()) {
            console.log(`Statistik Link gefunden mit: ${selector}`);
            await element.click();
            break;
          }
        } catch (e) {
          console.log(`Stats Selector ${selector} nicht gefunden: ${e.message}`);
          continue;
        }
      }
    }
    
    // Warte auf Ladezustand
    await page.waitForLoadState('networkidle');
    
    // Seite scrollen für volles Laden
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
      window.scrollTo(0, 0);
    });
    
    // Warte etwas länger für vollständiges Laden
    await page.waitForTimeout(3000);
    
    // Screenshot machen
    console.log('Mache Screenshot...');
    await page.screenshot({
      path: '/root/.openclaw/workspace/statistik-screenshot.png',
      fullPage: true
    });
    
    // Anzahl der Fänge auslesen
    const catchCount = await page.textContent('[data-testid="catch-count"], .StatCard, [class*="catch"], [class*="stat"], [class*="count"], text=/\\d+/')
      .then(text => {
        const match = text?.trim().match(/\d+/);
        return match ? match[0] : '0';
      })
      .catch(() => '0');
    
    console.log(`Screenshot gespeichert!`);
    console.log(`Angezeigte Fänge: ${catchCount}`);
    
  } catch (error) {
    console.error('Fehler:', error.message);
    // Trotz Fehler Screenshot machen falls Seite geladen wurde
    try {
      await page.screenshot({
        path: '/root/.openclaw/workspace/statistik-screenshot-error.png',
        fullPage: true
      });
      console.log('Fehler-Screenshot erstellt');
    } catch (screenshotErr) {
      console.error('Screenshot fehlgeschlagen:', screenshotErr.message);
    }
  }
  
  await browser.close();
})();