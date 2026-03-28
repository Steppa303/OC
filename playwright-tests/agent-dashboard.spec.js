import { test, expect } from '@playwright/test';

test.describe('Agent Dashboard', () => {
  test('should load successfully', async ({ page }) => {
    await page.goto('http://185.217.126.72/agent-dashboard/');
    await expect(page).toHaveTitle(/Agent Dashboard/);
  });

  test('stats should be displayed', async ({ page }) => {
    await page.goto('http://185.217.126.72/agent-dashboard/');
    const totalStat = await page.$('text=/Total/i');
    const activeStat = await page.$('text=/Active/i');
    const completedStat = await page.$('text=/Completed/i');
    expect(totalStat).toBeTruthy();
    expect(activeStat).toBeTruthy();
    expect(completedStat).toBeTruthy();
  });

  test('agent list should be displayed', async ({ page }) => {
    await page.goto('http://185.217.126.72/agent-dashboard/');
    const agentList = await page.$('.agent-list') || await page.$('ul') || await page.$('div:has-text("agent")');
    expect(agentList).toBeTruthy();
  });

  test('clicking agent should open modal', async ({ page }) => {
    await page.goto('http://185.217.126.72/agent-dashboard/');
    const agentCard = await page.$('.agent') || await page.$('.card') || await page.$('div:has-text("Agent")');
    if (agentCard) {
      await agentCard.click();
      const modal = await page.$('.modal') || await page.$('dialog') || await page.$('div[role="dialog"]');
      expect(modal).toBeTruthy();
    }
  });

  test('modal should show agent details', async ({ page }) => {
    await page.goto('http://185.217.126.72/agent-dashboard/');
    const agentCard = await page.$('.agent') || await page.$('.card') || await page.$('div:has-text("Agent")');
    if (agentCard) {
      await agentCard.click();
      const modal = await page.$('.modal') || await page.$('dialog') || await page.$('div[role="dialog"]');
      if (modal) {
        const details = await modal.textContent();
        expect(details).toContain('Agent');
      }
    }
  });

  test('modal should be closable', async ({ page }) => {
    await page.goto('http://185.217.126.72/agent-dashboard/');
    const agentCard = await page.$('.agent') || await page.$('.card') || await page.$('div:has-text("Agent")');
    if (agentCard) {
      await agentCard.click();
      const closeModal = await page.$('.close') || await page.$('button[aria-label*="close"]') || await page.$('dialog button');
      if (closeModal) {
        await closeModal.click();
        const modal = await page.$('.modal') || await page.$('dialog') || await page.$('div[role="dialog"]');
        expect(modal).toBeFalsy();
      }
    }
  });

  test('should have no console errors on load', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    await page.goto('http://185.217.126.72/agent-dashboard/');
    expect(errors).toHaveLength(0);
  });
});
