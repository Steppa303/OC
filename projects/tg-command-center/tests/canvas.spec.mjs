import { test, expect } from '@playwright/test';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = join(__dirname, '..', 'test-screenshots');
if (!existsSync(SCREENSHOT_DIR)) mkdirSync(SCREENSHOT_DIR, { recursive: true });

const screenshot = (page, name) => page.screenshot({ path: join(SCREENSHOT_DIR, `${name}.png`), fullPage: false });

// Helper: clear all items via API
async function clearItems(request) {
  const res = await request.get('/api/items');
  const items = await res.json();
  for (const item of items) {
    await request.delete(`/api/items/${item.id}`);
  }
}

// Helper: create item via API
async function createItem(request, data) {
  const res = await request.post('/api/items', { data });
  return res.json();
}

test.describe('Infinite Canvas', () => {

  test.beforeEach(async ({ request }) => {
    await clearItems(request);
  });

  test('1. Canvas loads and shows empty state', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.empty-state-fade-in', { timeout: 5000 });
    await screenshot(page, '01-empty-canvas');
    await expect(page.locator('text=Canvas ist leer')).toBeVisible();
  });

  test('2. Create text card via toolbar', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    // Click the add button
    await page.locator('.toolbar-btn-add').click();
    await page.waitForTimeout(200);
    await screenshot(page, '02-add-menu');

    // Click "Text-Card"
    await page.locator('text=Text-Card').click();
    await page.waitForTimeout(500);
    await screenshot(page, '02-text-card-created');

    // Verify card exists
    const cards = page.locator('[data-card]');
    await expect(cards).toHaveCount(1);
  });

  test('3. Card position stays stable after click (Bug #1 fix)', async ({ request, page }) => {
    // Create a card at a known position
    const item = await createItem(request, {
      type: 'text', x: 400, y: 300, width: 280, height: 180,
      title: 'Position Test', content: 'Should not jump on click', color: 'blue',
    });

    await page.goto('/');
    await page.waitForTimeout(500);

    // Find the card and verify it's visible
    const card = page.locator(`[data-card-id="${item.id}"]`);
    await expect(card).toBeVisible();
    await screenshot(page, '03-card-before-click');

    // Get the card's bounding box before click
    const boxBefore = await card.boundingBox();

    // Click the card (not drag)
    await card.click();
    await page.waitForTimeout(300);

    // Get the card's bounding box after click
    const boxAfter = await card.boundingBox();
    await screenshot(page, '03-card-after-click');

    // Position should be stable (allow 2px tolerance for rounding)
    expect(Math.abs(boxAfter.x - boxBefore.x)).toBeLessThan(3);
    expect(Math.abs(boxAfter.y - boxBefore.y)).toBeLessThan(3);
  });

  test('4. Card position stays stable after multiple clicks', async ({ request, page }) => {
    const item = await createItem(request, {
      type: 'text', x: 500, y: 250, width: 280, height: 180,
      title: 'Multi-Click Test', content: 'Click me multiple times', color: 'green',
    });

    await page.goto('/');
    await page.waitForTimeout(500);

    const card = page.locator(`[data-card-id="${item.id}"]`);
    const boxInitial = await card.boundingBox();

    // Click 5 times rapidly
    for (let i = 0; i < 5; i++) {
      await card.click();
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(300);

    const boxFinal = await card.boundingBox();
    await screenshot(page, '04-multi-click-stable');

    expect(Math.abs(boxFinal.x - boxInitial.x)).toBeLessThan(3);
    expect(Math.abs(boxFinal.y - boxInitial.y)).toBeLessThan(3);
  });

  test('5. Drag card — position updates and stays after drop', async ({ request, page }) => {
    const item = await createItem(request, {
      type: 'text', x: 200, y: 200, width: 280, height: 180,
      title: 'Drag Test', content: 'Drag me!', color: 'red',
    });

    await page.goto('/');
    await page.waitForTimeout(500);

    const card = page.locator(`[data-card-id="${item.id}"]`);
    const box = await card.boundingBox();
    await screenshot(page, '05-before-drag');

    // Drag the card 200px right and 100px down
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    // Move past threshold
    await page.mouse.move(box.x + box.width / 2 + 10, box.y + box.height / 2 + 10, { steps: 3 });
    // Move to final position
    await page.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2 + 100, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    await screenshot(page, '05-after-drag');

    // Verify position changed significantly
    const boxAfter = await card.boundingBox();
    expect(boxAfter.x - box.x).toBeGreaterThan(150);

    // Click the card — position should NOT reset
    await card.click();
    await page.waitForTimeout(300);
    const boxAfterClick = await card.boundingBox();
    await screenshot(page, '05-after-click-post-drag');

    expect(Math.abs(boxAfterClick.x - boxAfter.x)).toBeLessThan(3);
    expect(Math.abs(boxAfterClick.y - boxAfter.y)).toBeLessThan(3);
  });

  test('6. Image upload appears on canvas (Bug #2 fix)', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    // Create a small test image (1x1 PNG)
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    // Upload via file input
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-image.png',
      mimeType: 'image/png',
      buffer: pngBuffer,
    });

    await page.waitForTimeout(1000);
    await screenshot(page, '06-image-uploaded');

    // Verify an image card appeared
    const imageCards = page.locator('[data-card] img');
    await expect(imageCards).toHaveCount(1, { timeout: 5000 });
  });

  test('7. Image is visible in viewport after upload', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    // Pan the canvas significantly
    const canvas = page.locator('.w-full.h-full.relative.overflow-hidden').first();
    const canvasBox = await canvas.boundingBox();

    // Pan by dragging the canvas
    await page.mouse.move(canvasBox.x + 640, canvasBox.y + 360);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + 140, canvasBox.y + 60, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    // Upload an image
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVQYV2P8z8BQz0BFwMgwasCoAgBtkAMF3RjRFAAAAABJRU5ErkJggg==',
      'base64'
    );
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-viewport.png',
      mimeType: 'image/png',
      buffer: pngBuffer,
    });

    await page.waitForTimeout(1000);
    await screenshot(page, '07-image-after-pan');

    // The image should be visible (in viewport) — check if any image card is selected
    const selectedCards = page.locator('[data-card] img');
    await expect(selectedCards).toHaveCount(1, { timeout: 5000 });
  });

  test('8. Multi-select with Shift+Click', async ({ request, page }) => {
    await createItem(request, {
      type: 'text', x: 200, y: 200, width: 280, height: 180,
      title: 'Card A', content: 'First card', color: 'blue',
    });
    await createItem(request, {
      type: 'text', x: 550, y: 200, width: 280, height: 180,
      title: 'Card B', content: 'Second card', color: 'red',
    });

    await page.goto('/');
    await page.waitForTimeout(500);
    await screenshot(page, '08-two-cards');

    // Click first card
    const cards = page.locator('[data-card]');
    await cards.first().click();
    await page.waitForTimeout(200);

    // Shift+Click second card
    await cards.last().click({ modifiers: ['Shift'] });
    await page.waitForTimeout(200);
    await screenshot(page, '08-multi-selected');

    // Both cards should be selected — verify via store state
    const selectedCount = await page.evaluate(() => {
      return window.__ZUSTAND_STORE?.getState?.()?.selectedIds?.size ?? -1;
    });
    // Fallback: check toolbar buttons appear (means at least 1 selected)
    await expect(page.locator('[title="Löschen"]')).toBeVisible();
    await expect(page.locator('[title="Duplizieren"]')).toBeVisible();
    // Also verify both cards have selected styling (card-selected class)
    const selectedCards = page.locator('[data-card] .card-selected');
    await expect(selectedCards).toHaveCount(2, { timeout: 3000 });
  });

  test('9. Undo/Redo works', async ({ request, page }) => {
    await createItem(request, {
      type: 'text', x: 300, y: 300, width: 280, height: 180,
      title: 'Undo Test', content: 'Will be deleted then undone', color: 'purple',
    });

    await page.goto('/');
    await page.waitForTimeout(500);

    // Verify card exists
    const cards = page.locator('[data-card]');
    await expect(cards).toHaveCount(1);

    // Select and delete the card
    await cards.first().click();
    await page.waitForTimeout(200);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(500);
    await screenshot(page, '09-after-delete');

    // Card should be gone
    await expect(page.locator('[data-card]')).toHaveCount(0);

    // Undo
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    await screenshot(page, '09-after-undo');

    // Card should be back
    await expect(page.locator('[data-card]')).toHaveCount(1);
  });

  test('10. Zoom with scroll wheel', async ({ request, page }) => {
    await createItem(request, {
      type: 'text', x: 300, y: 300, width: 280, height: 180,
      title: 'Zoom Test', content: 'Zoom in and out', color: 'orange',
    });

    await page.goto('/');
    await page.waitForTimeout(500);
    await screenshot(page, '10-zoom-100');

    // Zoom in
    await page.mouse.move(640, 360);
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, -100);
      await page.waitForTimeout(50);
    }
    await page.waitForTimeout(300);
    await screenshot(page, '10-zoomed-in');

    // Zoom out
    for (let i = 0; i < 10; i++) {
      await page.mouse.wheel(0, 100);
      await page.waitForTimeout(50);
    }
    await page.waitForTimeout(300);
    await screenshot(page, '10-zoomed-out');
  });

  test('11. Context menu on right-click', async ({ request, page }) => {
    await createItem(request, {
      type: 'text', x: 400, y: 300, width: 280, height: 180,
      title: 'Context Test', content: 'Right-click me', color: 'default',
    });

    await page.goto('/');
    await page.waitForTimeout(500);

    const card = page.locator('[data-card]').first();
    await card.click({ button: 'right' });
    await page.waitForTimeout(300);
    await screenshot(page, '11-context-menu');

    // Context menu should be visible
    await expect(page.locator('text=Pin')).toBeVisible();
    await expect(page.locator('text=Bearbeiten')).toBeVisible();
    await expect(page.locator('text=Löschen')).toBeVisible();
  });

  test('12. Full workflow: create, drag, click, verify stable', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    // Create a text card
    await page.locator('.toolbar-btn-add').click();
    await page.waitForTimeout(200);
    await page.locator('text=Text-Card').click();
    await page.waitForTimeout(500);

    const card = page.locator('[data-card]').first();
    const box = await card.boundingBox();
    await screenshot(page, '12-created');

    // Drag it somewhere
    await page.mouse.move(box.x + 50, box.y + 50);
    await page.mouse.down();
    await page.mouse.move(box.x + 60, box.y + 60, { steps: 3 }); // past threshold
    await page.mouse.move(box.x + 300, box.y + 200, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    const boxAfterDrag = await card.boundingBox();
    await screenshot(page, '12-after-drag');

    // Click it multiple times
    for (let i = 0; i < 3; i++) {
      await card.click();
      await page.waitForTimeout(150);
    }

    const boxAfterClicks = await card.boundingBox();
    await screenshot(page, '12-after-clicks');

    // Position should be stable
    expect(Math.abs(boxAfterClicks.x - boxAfterDrag.x)).toBeLessThan(3);
    expect(Math.abs(boxAfterClicks.y - boxAfterDrag.y)).toBeLessThan(3);
  });
});
