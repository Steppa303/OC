import { test, expect } from '@playwright/test';

test.describe('Melodiegenerator', () => {
  test('should load successfully', async ({ page }) => {
    await page.goto('http://185.217.126.72/melodie-generator/');
    await expect(page).toHaveTitle(/MelodieGenerator/);
  });

  test('play button should work', async ({ page }) => {
    await page.goto('http://185.217.126.72/melodie-generator/');
    await page.click('button:has-text("Play")', { timeout: 5000 });
    await expect(page).toHaveTitle(/MelodieGenerator/);
  });

  test('stop button should work', async ({ page }) => {
    await page.goto('http://185.217.126.72/melodie-generator/');
    await page.click('button:has-text("Play")', { timeout: 5000 });
    await page.click('button:has-text("Stop")', { timeout: 5000 });
    await expect(page).toHaveTitle(/MelodieGenerator/);
  });

  test('BPM slider should change value', async ({ page }) => {
    await page.goto('http://185.217.126.72/melodie-generator/');
    const bpmInput = await page.$('input[type="range"][name*="bpm"]') || await page.$('input[type="range"]');
    if (bpmInput) {
      const valueBefore = await bpmInput.inputValue();
      await bpmInput.fill('150');
      const valueAfter = await bpmInput.inputValue();
      expect(valueAfter).not.toBe(valueBefore);
    }
  });

  test('Chaos slider should change value', async ({ page }) => {
    await page.goto('http://185.217.126.72/melodie-generator/');
    const chaosInput = await page.$('input[type="range"][name*="chaos"]') || await page.$('input[type="range"]');
    if (chaosInput) {
      const valueBefore = await chaosInput.inputValue();
      await chaosInput.fill('80');
      const valueAfter = await chaosInput.inputValue();
      expect(valueAfter).not.toBe(valueBefore);
    }
  });

  test('Tonart dropdown should work', async ({ page }) => {
    await page.goto('http://185.217.126.72/melodie-generator/');
    const tonartSelect = await page.$('select[name*="tonart"]') || await page.$('select');
    if (tonartSelect) {
      const options = await tonartSelect.$$eval('option', opts => opts.map(o => o.value));
      expect(options.length).toBeGreaterThan(0);
      await tonartSelect.selectOption({ index: 1 });
    }
  });

  test('Wellenform dropdown should work', async ({ page }) => {
    await page.goto('http://185.217.126.72/melodie-generator/');
    const wellenformSelect = await page.$('select[name*="wellenform"]') || await page.$('select');
    if (wellenformSelect) {
      const options = await wellenformSelect.$$eval('option', opts => opts.map(o => o.value));
      expect(options.length).toBeGreaterThan(0);
      await wellenformSelect.selectOption({ index: 1 });
    }
  });

  test('should have no console errors on load', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    await page.goto('http://185.217.126.72/melodie-generator/');
    expect(errors).toHaveLength(0);
  });
});
