import { test, expect, type Page } from '@playwright/test';

async function addModule(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).click();
}

async function dragConnect(page: Page, fromSel: string, toSel: string) {
  const from = (await page.locator(fromSel).boundingBox())!;
  const to = (await page.locator(toSel).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
}

test('draw a legal cable, refuse an illegal one, then disconnect', async ({ page }) => {
  await page.goto('/patch');
  await addModule(page, 'VCO');
  await addModule(page, 'VCF');

  const vcoOut = '[data-nodeid="vco1"][data-handleid="out"]';
  const vcfIn = '[data-nodeid="vcf1"][data-handleid="in"]';
  const vcfCutoffCv = '[data-nodeid="vcf1"][data-handleid="cutoff_cv"]';

  // Legal: VCO audio out -> VCF audio in.
  await dragConnect(page, vcoOut, vcfIn);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);

  // Illegal: audio out -> cv input. No edge; a reason is shown.
  await dragConnect(page, vcoOut, vcfCutoffCv);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await expect(page.getByRole('alert')).toContainText(/audio output to a cv input/);

  // Disconnect: select the cable and delete it. The edge path is a zero-height
  // horizontal line (degenerate bbox for Playwright's hit test), so dispatch the
  // click straight to the element — React Flow's delegated handler still selects it.
  await page.locator('.react-flow__edge').first().dispatchEvent('click');
  await page.keyboard.press('Delete');
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
});
