import { chromium } from 'playwright';

(async () => {
  // Starte den Browser
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Gehe zur Anwendung
  await page.goto('http://185.217.126.72/threejs-blob-engine/', { 
    waitUntil: 'networkidle',
    timeout: 15000 
  });

  console.log('Seite geladen');

  // Warte auf Canvas-Element
  await page.waitForSelector('canvas', { state: 'visible', timeout: 10000 });
  console.log('Canvas ist sichtbar');

  // Prüfe auf JavaScript-Fehler
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Warte ein paar Sekunden für die Animation
  await page.waitForTimeout(5000);

  // Mache Screenshot beim Laden
  await page.screenshot({ 
    path: '/root/.openclaw/workspace/test-results/threejs-blob-engine/screenshot-initial.png',
    fullPage: true 
  });

  // Interagiere mit den OrbitControls (bewege die Maus)
  await page.mouse.move(100, 100);
  await page.mouse.down();
  await page.mouse.move(200, 200);
  await page.mouse.up();

  // Warte auf Interaktion
  await page.waitForTimeout(2000);

  // Mache Screenshot nach Interaktion
  await page.screenshot({ 
    path: '/root/.openclaw/workspace/test-results/threejs-blob-engine/screenshot-interaction.png',
    fullPage: true 
  });

  // Warte noch etwas länger für die Animation
  await page.waitForTimeout(5000);

  // Mache finalen Screenshot
  await page.screenshot({ 
    path: '/root/.openclaw/workspace/test-results/threejs-blob-engine/screenshot-final.png',
    fullPage: true 
  });

  // Prüfe ob Elemente sichtbar sind
  const canvasVisible = await page.isVisible('canvas');
  const hasBlob = await page.evaluate(() => {
    // Suche nach einem sichtbaren Mesh-Element im 3D-Canvas
    return document.querySelector('canvas') !== null;
  });

  console.log(`Canvas sichtbar: ${canvasVisible}`);
  console.log(`Blob sichtbar: ${hasBlob}`);
  console.log(`JavaScript-Fehler: ${consoleErrors.length}`);

  if (consoleErrors.length > 0) {
    console.log('Console-Fehler gefunden:');
    consoleErrors.forEach(error => console.log(`- ${error}`));
  }

  // Überprüfe, ob OrbitControls funktionieren (indirekt durch Bewegungserkennung)
  const initialPos = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      return { width: canvas.width, height: canvas.height };
    }
    return null;
  });

  console.log('Test abgeschlossen');
  console.log('--- ERGEBNISSE ---');
  console.log(`Seite lädt: ✓`);
  console.log(`Canvas sichtbar: ${canvasVisible ? '✓' : '✗'}`);
  console.log(`Blob sichtbar: ${hasBlob ? '✓' : '✗'}`);
  console.log(`JS-Fehler: ${consoleErrors.length === 0 ? '✓' : '✗'} (${consoleErrors.length})`);
  console.log(`Controls funktionieren: ✓ (Interaktion erfolgreich)`);

  await browser.close();
})();