// Reader App - Playwright Full Test Suite
// Tests: Upload, Bookshelf, Reader, Navigation, TOC, Bookmarks, TTS, Theme, Responsive
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');

const BASE_URL = 'https://reader.steppa.online';
const TEST_EPUB1 = '/tmp/reader-test1.epub';
const TEST_EPUB2 = '/tmp/reader-test2.epub';

let passed = 0;
let failed = [];

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log('  \u2705 ' + msg);
  } else {
    failed.push(msg);
    console.log('  \u274c ' + msg);
  }
}

function createEpub(filePath, title, author, chapters) {
  const dir = '/tmp/epub-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  fs.mkdirSync(dir + '/META-INF', { recursive: true });
  fs.mkdirSync(dir + '/OEBPS', { recursive: true });

  fs.writeFileSync(dir + '/mimetype', 'application/epub+zip');
  fs.writeFileSync(dir + '/META-INF/container.xml',
    '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">' +
    '<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');

  const manifest = chapters.map((_, i) =>
    '<item id="chap' + i + '" href="chap' + i + '.xhtml" media-type="application/xhtml+xml"/>').join('');
  const spine = chapters.map((_, i) =>
    '<itemref idref="chap' + i + '"/>').join('');

  fs.writeFileSync(dir + '/OEBPS/content.opf',
    '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="bookid">' +
    '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">' +
    '<dc:title>' + title + '</dc:title><dc:creator>' + author + '</dc:creator>' +
    '<dc:identifier id="bookid">t' + Date.now() + '</dc:identifier></metadata>' +
    '<manifest>' + manifest + '</manifest><spine>' + spine + '</spine></package>');

  chapters.forEach((c, i) => {
    fs.writeFileSync(dir + '/OEBPS/chap' + i + '.xhtml',
      '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>' + c +
      '</title></head><body><h1>' + c + '</h1><p>' +
      Array(20).fill('Paragraph for ' + c + '.').join(' ') + '</p></body></html>');
  });

  execSync('cd "' + dir + '" && zip -0X /tmp/epub-temp.zip mimetype && zip -r /tmp/epub-temp.zip META-INF OEBPS', { stdio: 'pipe' });
  fs.renameSync('/tmp/epub-temp.zip', filePath);
  fs.rmSync(dir, { recursive: true });
  return fs.statSync(filePath).size;
}

async function run() {
  console.log('\n===========================================');
  console.log('  READER APP - PLAYWRIGHT TEST SUITE');
  console.log('===========================================\n');
  console.log('URL: ' + BASE_URL + '\n');

  // Create test EPUBs
  console.log('[Setup] Creating test EPUBs...');
  const size1 = createEpub(TEST_EPUB1, 'Test Buch', 'Max Mustermann', ['Kapitel 1', 'Kapitel 2', 'Kapitel 3']);
  const size2 = createEpub(TEST_EPUB2, 'Zweites Buch', 'Autor Zwei', ['Start', 'Mitte', 'Ende']);
  console.log('  EPUB 1: ' + size1 + ' bytes, 3 chapters');
  console.log('  EPUB 2: ' + size2 + ' bytes, 3 chapters\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));

  try {
    // === 1. Page Load ===
    console.log('1. PAGE LOAD');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    assert(await page.textContent('.logo'), 'Logo visible');
    assert(await page.$('.dropzone'), 'Dropzone visible');
    assert(await page.$('#theme-btn'), 'Theme button visible');
    assert(await page.$('.book-grid'), 'Book grid exists');

    // === 2. Theme Toggle ===
    console.log('\n2. THEME TOGGLE');
    await page.click('#theme-btn');
    await page.waitForTimeout(300);
    assert(await page.evaluate(() => document.documentElement.getAttribute('data-theme')) === 'light', 'Switches to light');
    await page.click('#theme-btn');
    await page.waitForTimeout(300);
    assert(await page.evaluate(() => document.documentElement.getAttribute('data-theme')) === 'dark', 'Switches back to dark');

    // === 3. Upload First EPUB ===
    console.log('\n3. UPLOAD EPUB');
    await page.setInputFiles('#file-input', TEST_EPUB1);
    await page.waitForFunction(() => {
      const el = document.querySelector('#upload-progress');
      return el && document.querySelector('#progress-text').textContent.includes('\u2705');
    }, { timeout: 20000 });
    assert(true, 'Upload completes successfully');
    await page.waitForTimeout(800);

    const cards = await page.$$('.book-card');
    assert(cards.length === 1, '1 book card appears');
    assert(await page.textContent('.book-title') === 'Test Buch', 'Correct book title');
    assert(await page.textContent('.book-author') === 'Max Mustermann', 'Correct book author');

    // === 4. Open Book / Reader View ===
    console.log('\n4. READER VIEW');
    await cards[0].click();
    await page.waitForTimeout(1000);
    assert(await page.$('#reader-view.active'), 'Reader view is active');
    assert(await page.textContent('#reader-title') === 'Test Buch', 'Reader title matches');
    assert((await page.textContent('.chapter-content')).includes('Kapitel 1'), 'Chapter 1 content visible');

    // === 5. TOC ===
    console.log('\n5. TABLE OF CONTENTS');
    await page.click('#toc-btn');
    await page.waitForTimeout(300);
    let tocItems = await page.$$('.toc-item');
    assert(tocItems.length === 3, 'TOC shows 3 chapters');
    await tocItems[2].click();
    await page.waitForTimeout(500);
    assert((await page.textContent('.chapter-content')).includes('Kapitel 3'), 'TOC navigates to chapter 3');

    // === 6. Chapter Navigation ===
    console.log('\n6. NAVIGATION');
    await page.click('#prev-btn');
    await page.waitForTimeout(300);
    assert((await page.textContent('.chapter-content')).includes('Kapitel 2'), 'Previous button works');
    await page.click('#next-btn');
    await page.waitForTimeout(300);
    assert((await page.textContent('.chapter-content')).includes('Kapitel 3'), 'Next button works');

    // === 7. Keyboard Navigation ===
    console.log('\n7. KEYBOARD');
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(300);
    assert((await page.textContent('.chapter-content')).includes('Kapitel 2'), 'ArrowLeft goes previous');

    // === 8. Bookmarks ===
    console.log('\n8. BOOKMARKS');
    await page.click('#bookmark-btn');
    await page.waitForTimeout(500);
    assert(await page.$('.toast.show'), 'Bookmark toast appears');
    assert((await page.textContent('.toast')).includes('Lesezeichen'), 'Toast message correct');
    await page.waitForTimeout(500);
    const icon = await page.$('#bookmark-icon');
    assert(icon && (await icon.getAttribute('class')).includes('bookmark'), 'Bookmark icon updated');

    // === 9. Back & Reopen ===
    console.log('\n9. RE-OPEN WITH BOOKMARK');
    await page.click('#back-btn');
    await page.waitForTimeout(600);
    assert(await page.$('#shelf-view.active'), 'Back to shelf');
    const cards2 = await page.$$('.book-card');
    assert(cards2.length >= 1, 'Books still in shelf');
    await cards2[0].click();
    await page.waitForTimeout(1000);
    assert(await page.$('#reader-view.active'), 'Reader re-opened');
    // Bookmark should restore chapter 2 (we left on chapter 2 after ArrowLeft)
    const chapHeading = await page.textContent('.chapter-content .chapter-heading');
    assert(chapHeading && chapHeading.includes('Kapitel 2'), 'Bookmark restored correct chapter: ' + chapHeading);

    // === 10. TTS Player ===
    console.log('\n10. TTS PLAYER UI');
    assert(await page.$('.player'), 'Player bar exists');
    assert(await page.$('#play-btn'), 'Play button exists');
    assert(await page.$('#speed-range'), 'Speed slider exists');
    assert(await page.$('#voice-select'), 'Voice select exists');
    assert(await page.$('#stop-btn'), 'Stop button exists');

    // Test speed slider
    await page.fill('#speed-range', '1.5');
    await page.waitForTimeout(200);
    assert((await page.textContent('#speed-label')).includes('1.5'), 'Speed label updates');

    // === 11. Upload Second Book ===
    console.log('\n11. SECOND BOOK UPLOAD');
    await page.click('#back-btn');
    await page.waitForTimeout(600);
    await page.setInputFiles('#file-input', TEST_EPUB2);
    await page.waitForFunction(() => {
      const el = document.querySelector('#upload-progress');
      return el && document.querySelector('#progress-text').textContent.includes('\u2705');
    }, { timeout: 20000 });
    assert(true, 'Second upload succeeds');
    await page.waitForTimeout(800);
    const cards3 = await page.$$('.book-card');
    assert(cards3.length === 2, '2 books in bookshelf');

    // === 12. Responsive (Mobile) ===
    console.log('\n12. RESPONSIVE (MOBILE)');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    assert(await page.$('.dropzone'), 'Dropzone visible on mobile');
    let mobileCards = await page.$$('.book-card');
    assert(mobileCards.length >= 1, 'Books visible on mobile');
    await mobileCards[0].click();
    await page.waitForTimeout(1000);
    assert(await page.$('#reader-view.active'), 'Reader opens on mobile');
    assert(await page.$('.reader-topbar'), 'Topbar visible on mobile');
    const mobContent = await page.textContent('.chapter-content');
    assert(mobContent && mobContent.length > 0, 'Content visible on mobile');

    // === 13. Console Errors ===
    console.log('\n13. CONSOLE ERRORS');
    if (errors.length > 0) {
      console.log('  Found ' + errors.length + ' error(s):');
      errors.slice(0, 3).forEach(e => console.log('    - ' + e.substring(0, 120)));
    }
    assert(errors.length === 0, 'No console errors (' + errors.length + ' found)');

  } catch (err) {
    console.log('\n\uD83D\uDCA5 TEST CRASHED');
    console.log('  ' + err.message);
    try {
      await page.screenshot({ path: '/tmp/reader-test-fail.png', fullPage: true });
      console.log('  Screenshot: /tmp/reader-test-fail.png');
    } catch {}
    failed.push('Test crash: ' + err.message);
  } finally {
    await browser.close();

    // Summary
    const total = passed + failed.length;
    console.log('\n' + '='.repeat(40));
    console.log('  RESULTS: ' + passed + '/' + total + ' passed');
    if (failed.length > 0) {
      console.log('  FAILED:');
      failed.forEach(f => console.log('    \u274c ' + f));
    }
    console.log('='.repeat(40) + '\n');

    // Cleanup test files
    try { fs.unlinkSync(TEST_EPUB1); } catch {}
    try { fs.unlinkSync(TEST_EPUB2); } catch {}

    process.exit(failed.length > 0 ? 1 : 0);
  }
}

run();