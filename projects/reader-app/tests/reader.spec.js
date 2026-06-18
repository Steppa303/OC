// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { execSync } = require('child_process');

const BASE = 'http://localhost:3003';
const EPUB1 = '/tmp/reader-e2e-m.epub';

function mkEpub(fp, title, author, chs) {
  const d = '/tmp/ep_' + Date.now();
  fs.mkdirSync(d + '/META-INF', { recursive: true });
  fs.mkdirSync(d + '/OEBPS', { recursive: true });
  fs.writeFileSync(d + '/mimetype', 'application/epub+zip');
  fs.writeFileSync(d + '/META-INF/container.xml',
    `<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
  const mi = chs.map((_, i) => `<item id="c${i}" href="c${i}.xhtml" media-type="application/xhtml+xml"/>`).join('');
  const sp = chs.map((_, i) => `<itemref idref="c${i}"/>`).join('');
  fs.writeFileSync(d + '/OEBPS/content.opf',
    `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="bid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${title}</dc:title><dc:creator>${author}</dc:creator><dc:identifier id="bid">t${Date.now()}</dc:identifier></metadata><manifest>${mi}</manifest><spine>${sp}</spine></package>`);
  chs.forEach((c, i) => {
    fs.writeFileSync(d + '/OEBPS/c' + i + '.xhtml',
      `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${c}</title></head><body><h1>${c}</h1><p>${Array(20).fill('Text ' + c + '.').join(' ')}</p></body></html>`);
  });
  execSync(`cd "${d}" && zip -0X /tmp/z.zip mimetype && zip -r /tmp/z.zip META-INF OEBPS`, { stdio: 'pipe' });
  fs.renameSync('/tmp/z.zip', fp);
  fs.rmSync(d, { recursive: true });
}

function clearDb() {
  const raw = execSync(`curl -s ${BASE}/api/books`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  try {
    for (const b of JSON.parse(raw)) {
      execSync(`curl -s -X DELETE ${BASE}/api/books/${b.id}`, { stdio: 'pipe' });
    }
  } catch {}
}

function uploadViaCurl() {
  clearDb();
  const out = execSync(`curl -s -X POST ${BASE}/api/upload -F "epub=@${EPUB1}"`, { encoding: 'utf8' });
  return JSON.parse(out);
}

test.beforeAll(() => mkEpub(EPUB1, 'Testbuch', 'Autor', ['Kapitel 1', 'Kapitel 2', 'Kapitel 3']));
test.afterAll(() => { try { fs.unlinkSync(EPUB1); } catch {} });

// ─── UI Tests ───────────────────────────────────────────────────────────────────

test('Page loads with all UI elements', async ({ page }) => {
  await page.goto(BASE);
  await expect(page.locator('.logo')).toBeVisible();
  await expect(page.locator('#dropzone')).toBeVisible();
  await expect(page.locator('#theme-btn')).toBeVisible();
});

test('Theme toggle switches dark/light', async ({ page }) => {
  await page.goto(BASE);
  await page.locator('#theme-btn').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.locator('#theme-btn').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('Upload EPUB → book card in shelf', async ({ page }) => {
  clearDb();
  await page.goto(BASE);
  await page.setInputFiles('#file-input', EPUB1);
  await expect(page.locator('#progress-text')).toContainText('✅', { timeout: 20000 });
  await page.waitForTimeout(600);
  await expect(page.locator('.book-card').first()).toBeVisible();
  await expect(page.locator('.book-card .book-title')).toContainText('Testbuch');
});

test('Open reader view with chapter content', async ({ page }) => {
  clearDb();
  await page.goto(BASE);
  await page.setInputFiles('#file-input', EPUB1);
  await expect(page.locator('#progress-text')).toContainText('✅', { timeout: 20000 });
  await page.waitForTimeout(600);
  await page.locator('.book-card').first().click();
  await page.waitForTimeout(1000);
  await expect(page.locator('#reader-view')).toBeVisible();
  await expect(page.locator('#reader-title')).toContainText('Testbuch');
  await expect(page.locator('.chapter-content')).toContainText('Kapitel 1');
});

test('Player sticky at bottom — visible without scroll and after scroll', async ({ page }) => {
  clearDb();
  await page.goto(BASE);
  await page.setInputFiles('#file-input', EPUB1);
  await expect(page.locator('#progress-text')).toContainText('✅', { timeout: 20000 });
  await page.waitForTimeout(600);
  await page.locator('.book-card').first().click();
  await page.waitForTimeout(1000);
  await expect(page.locator('#reader-view')).toBeVisible();

  await expect(page.locator('.player')).toBeVisible();
  let box = await page.locator('.player').boundingBox();
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize().height + 10);

  await page.locator('.content-area').evaluate(el => el.scrollTop = el.scrollHeight);
  await page.waitForTimeout(500);
  await expect(page.locator('.player')).toBeVisible();
  box = await page.locator('.player').boundingBox();
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize().height + 10);
});

test('Player controls exist (play, prev, next, speed, voice)', async ({ page }) => {
  clearDb();
  await page.goto(BASE);
  await page.setInputFiles('#file-input', EPUB1);
  await expect(page.locator('#progress-text')).toContainText('✅', { timeout: 20000 });
  await page.waitForSelector('.book-card', { timeout: 5000 });
  await page.locator('.book-card').first().click();
  await page.waitForSelector('#reader-view.active', { timeout: 5000 });
  await expect(page.locator('#reader-view')).toBeVisible();

  await expect(page.locator('#play-btn')).toBeVisible();
  await expect(page.locator('#prev-btn')).toBeVisible();
  await expect(page.locator('#next-btn')).toBeVisible();
  await expect(page.locator('#stop-btn')).toBeVisible();
  await expect(page.locator('#speed-range')).toBeVisible();
  await expect(page.locator('#voice-select')).toBeVisible();
  await expect(page.locator('#time-current')).toBeVisible();
  await expect(page.locator('#time-total')).toBeVisible();
});

test('Chapter navigation (prev/next buttons + keyboard)', async ({ page }) => {
  clearDb();
  await page.goto(BASE);
  await page.setInputFiles('#file-input', EPUB1);
  await expect(page.locator('#progress-text')).toContainText('✅', { timeout: 20000 });
  await page.waitForSelector('.book-card', { timeout: 5000 });
  await page.locator('.book-card').first().click();
  await page.waitForSelector('#reader-view.active', { timeout: 5000 });
  await expect(page.locator('#reader-view')).toBeVisible();

  await page.locator('#next-btn').click();
  await page.waitForTimeout(400);
  await expect(page.locator('.chapter-content')).toContainText('Kapitel 2');

  await page.locator('#next-btn').click();
  await page.waitForTimeout(400);
  await expect(page.locator('.chapter-content')).toContainText('Kapitel 3');

  await page.locator('#prev-btn').click();
  await page.waitForTimeout(400);
  await expect(page.locator('.chapter-content')).toContainText('Kapitel 2');

  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(400);
  await expect(page.locator('.chapter-content')).toContainText('Kapitel 1');

  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(400);
  await expect(page.locator('.chapter-content')).toContainText('Kapitel 2');
});

test('TOC panel shows chapters and navigates', async ({ page }) => {
  clearDb();
  await page.goto(BASE);
  await page.setInputFiles('#file-input', EPUB1);
  await expect(page.locator('#progress-text')).toContainText('✅', { timeout: 20000 });
  await page.waitForTimeout(600);
  await page.locator('.book-card').first().click();
  await page.waitForTimeout(1000);
  await expect(page.locator('#reader-view')).toBeVisible();

  await page.locator('#toc-btn').click();
  await page.waitForTimeout(300);
  await expect(page.locator('.toc-item')).toHaveCount(3);
  await page.locator('.toc-item').nth(2).click();
  await page.waitForTimeout(500);
  await expect(page.locator('.chapter-content')).toContainText('Kapitel 3');
});

test('Bookmarks save and restore on reopen', async ({ page }) => {
  clearDb();
  await page.goto(BASE);
  await page.setInputFiles('#file-input', EPUB1);
  await expect(page.locator('#progress-text')).toContainText('✅', { timeout: 20000 });
  await page.waitForTimeout(600);
  await page.locator('.book-card').first().click();
  await page.waitForTimeout(1000);
  await expect(page.locator('#reader-view')).toBeVisible();

  await page.locator('#next-btn').click();
  await page.waitForTimeout(400);
  await expect(page.locator('.chapter-content')).toContainText('Kapitel 2');

  await page.locator('#bookmark-btn').click();
  await expect(page.locator('.toast')).toContainText('Lesezeichen', { timeout: 3000 });
  await page.waitForTimeout(800);

  await page.locator('#back-btn').click();
  await page.waitForTimeout(600);
  await page.locator('.book-card').first().click();
  await page.waitForTimeout(1000);
  await expect(page.locator('.chapter-content')).toContainText('Kapitel 2');
});

test('Back button returns to shelf', async ({ page }) => {
  clearDb();
  await page.goto(BASE);
  await page.setInputFiles('#file-input', EPUB1);
  await expect(page.locator('#progress-text')).toContainText('✅', { timeout: 20000 });
  await page.waitForTimeout(600);
  await page.locator('.book-card').first().click();
  await page.waitForTimeout(1000);
  await expect(page.locator('#reader-view')).toBeVisible();

  await page.locator('#back-btn').click();
  await page.waitForTimeout(600);
  await expect(page.locator('#shelf-view')).toBeVisible();
});

test('Responsive mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(BASE);
  await expect(page.locator('.logo')).toBeVisible();
  await expect(page.locator('#dropzone')).toBeVisible();
});

// ─── API Tests ──────────────────────────────────────────────────────────────────

test('API: Upload, list and get book content', async () => {
  const book = uploadViaCurl();
  expect(book.id).toBeDefined();
  expect(book.book.title).toBe('Testbuch');

  const listRaw = execSync(`curl -s ${BASE}/api/books`, { encoding: 'utf8' });
  const books = JSON.parse(listRaw);
  expect(books.length).toBeGreaterThan(0);

  const contentRaw = execSync(`curl -s ${BASE}/api/books/${book.id}/content`, { encoding: 'utf8' });
  const content = JSON.parse(contentRaw);
  expect(content.chapters.length).toBe(3);
  expect(content.chapters[0].title).toBe('Kapitel 1');
  expect(content.chapters[0].text.length).toBeGreaterThan(10);
});

test('API: TTS returns audio for chapter with text', async () => {
  const book = uploadViaCurl();

  const result = execSync(
    `curl -s -o /tmp/tts-e2e-test.mp3 -w "HTTP:%{http_code}|CT:%{content_type}" ` +
    `-X POST ${BASE}/api/books/${book.id}/tts ` +
    `-H "Content-Type: application/json" ` +
    `-d '{"chapterIndex":0,"voiceId":"EXAVITQu4vr4xnSDxMaL"}'`,
    { encoding: 'utf8' }
  );
  expect(result).toContain('HTTP:200');
  expect(result).toContain('audio');
  const size = parseInt(execSync('stat -c%s /tmp/tts-e2e-test.mp3', { encoding: 'utf8' }).trim());
  expect(size).toBeGreaterThan(100);
});

test('API: TTS returns 404 for nonexistent chapter', async () => {
  const book = uploadViaCurl();

  const result = execSync(
    `curl -s -w "HTTP:%{http_code}" ` +
    `-X POST ${BASE}/api/books/${book.id}/tts ` +
    `-H "Content-Type: application/json" ` +
    `-d '{"chapterIndex":999}'`,
    { encoding: 'utf8' }
  );
  expect(result).toContain('HTTP:404');
});

test('API: Bookmarks save and retrieve', async () => {
  const book = uploadViaCurl();

  const svRaw = execSync(
    `curl -s -X POST ${BASE}/api/bookmarks/${book.id} ` +
    `-H "Content-Type: application/json" ` +
    `-d '{"chapterIndex":2,"progress":0.75}'`,
    { encoding: 'utf8' }
  );
  expect(JSON.parse(svRaw).message).toContain('saved');

  const getRaw = execSync(`curl -s ${BASE}/api/bookmarks/${book.id}`, { encoding: 'utf8' });
  expect(JSON.parse(getRaw).chapter_index).toBe(2);
});

test('API: Health endpoint', async () => {
  expect(execSync(`curl -s ${BASE}/health`, { encoding: 'utf8' })).toBe('OK');
});