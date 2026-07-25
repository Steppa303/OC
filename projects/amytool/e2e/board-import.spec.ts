import { test, expect } from '@playwright/test';

// P3-04: importing a `zD` dump from the (mock) board reconstructs the module
// graph on the canvas via parseWireDump.
const SUBTRACTIVE_DUMP = 'S8192Z\nv0w2A5,1,100,0.7,200,0G1R0.7a,,,1f440,1F800Z';

test('imports a board dump and renders the reconstructed module graph', async ({ page }) => {
  await page.addInitScript((dump: string) => {
    const w = window as unknown as {
      __amyUseMockBoard?: boolean;
      __amyBoardResponder?: (payload: string) => string[];
    };
    w.__amyUseMockBoard = true;
    w.__amyBoardResponder = (payload) => {
      if (payload === 'zD Z') return ['AK', '0' + dump]; // single dump frame
      if (payload === 'zIZ') return ['OK'];
      if (payload.startsWith('zB')) return [];
      return ['AK'];
    };
  }, SUBTRACTIVE_DUMP);

  await page.goto('/patch');
  await expect(page.locator('.react-flow__node')).toHaveCount(0);

  await page.getByTestId('board-connect').click();
  await expect(page.getByTestId('board-status')).toHaveAttribute('data-state', 'connected');

  await page.getByTestId('board-import').click();

  // the subtractive dump → VCO, VCF, VCA, ENV, Output (5 modules)
  await expect(page.locator('.react-flow__node')).toHaveCount(5);
  await expect(page.locator('.react-flow__node').filter({ hasText: 'vco1' })).toHaveCount(1);
  await expect(page.locator('.react-flow__node').filter({ hasText: 'vcf1' })).toHaveCount(1);
  await expect(page.getByLabel('Patch name')).toHaveValue('Board Import');
});
