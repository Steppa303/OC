import { test, expect } from '@playwright/test';

// P5-06 (Milestone M5 pt.2): generate a module from a prompt (mocked model),
// preview it, and add it to the library.
const MOCK_MODULE = JSON.stringify({
  manifestVersion: 1,
  id: 'user.bitcrush',
  name: 'Bit Crush',
  category: 'fx',
  hp: 6,
  description: 'A gritty bit crusher with a rate knob.',
  role: 'custom',
  params: [{ id: 'rate', label: 'Rate', control: 'knob', default: 8, min: 1, max: 16 }],
  jacks: [
    { id: 'in', kind: 'audio', dir: 'in' },
    { id: 'out', kind: 'audio', dir: 'out' },
  ],
  behavior: null,
});

test('generate a module and add it to the library', async ({ page }) => {
  await page.addInitScript((mod: string) => {
    (window as unknown as { __amyChat?: () => Promise<string> }).__amyChat = () => Promise.resolve(mod);
  }, MOCK_MODULE);

  await page.goto('/library');
  await page.getByTestId('new-module-open').click();

  await page.getByLabel('Module prompt').fill('a bit crusher with a rate knob');
  await page.getByTestId('module-generate').click();

  // preview appears with the generated manifest
  await expect(page.getByTestId('module-preview')).toContainText('Bit Crush');

  // add it → it lands in the library grid
  await page.getByTestId('module-add').click();
  await expect(page.getByTestId('module-add')).toContainText('Added');
  await expect(page.getByTestId('card-user.bitcrush')).toBeVisible();
});
