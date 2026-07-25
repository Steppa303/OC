import { test, expect } from '@playwright/test';

const MODELS = {
  data: [
    { id: 'anthropic/claude', name: 'Claude', context_length: 200000, pricing: { prompt: '0.000003', completion: '0.000015' } },
    { id: 'deepseek/v4-flash', name: 'DeepSeek V4 Flash', context_length: 64000, pricing: { prompt: '0', completion: '0' } },
  ],
};

test('set key, pick a model, and persist across reload', async ({ page }) => {
  await page.route('**/openrouter.ai/api/v1/models', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MODELS) }),
  );

  await page.goto('/settings');

  // Models load and render.
  await expect(page.getByRole('radio', { name: /Claude/ })).toBeVisible();
  await expect(page.getByRole('radio', { name: /DeepSeek V4 Flash/ })).toBeVisible();

  // Enter an API key (stored locally).
  await page.getByLabel('OpenRouter API key').fill('sk-or-test');

  // Pick the cheap model as default.
  await page.getByRole('radio', { name: /DeepSeek V4 Flash/ }).check();

  // Override module generation to Claude.
  await page.locator('#override-module').selectOption({ label: 'Claude' });

  // Reload → settings persisted from localStorage.
  await page.reload();
  await expect(page.getByLabel('OpenRouter API key')).toHaveValue('sk-or-test');
  await expect(page.getByRole('radio', { name: /DeepSeek V4 Flash/ })).toBeChecked();
  await expect(page.locator('#override-module')).toHaveValue('anthropic/claude');
});
