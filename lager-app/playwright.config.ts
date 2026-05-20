import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: false,
  retries: 1,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'https://gzpl.steppa.online',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
});
