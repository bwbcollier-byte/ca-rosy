// Admin user detail modal — make sure the heavily-regressed display issues
// stay fixed. Covers SMOKE_TEST.md items #33-41.
const { test, expect } = require('@playwright/test');
const { signInAsAdmin } = require('./fixtures/helpers');

test.describe('Admin user-detail modal', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  // Helper to open the first user row in a list page.
  async function openFirstUser(page, listUrl) {
    await page.goto(listUrl);
    await page.waitForLoadState('networkidle').catch(() => {});
    // The list renders rows with an "Open X" aria-label; click the first.
    const row = page.locator('[role=button][aria-label^="Open "]').first();
    await row.waitFor({ state: 'visible', timeout: 10_000 });
    await row.click();
  }

  test('#33 #41 opens a user, closes cleanly with no orphan second modal @smoke', async ({ page }) => {
    await openFirstUser(page, '/#app/users');
    // A modal should be visible — looks for the modal root by its display heading.
    const closeBtn = page.getByRole('button', { name: /^close$/i }).first();
    await expect(closeBtn).toBeVisible({ timeout: 5_000 });
    await closeBtn.click();
    // 800ms grace then assert no modal is visible.
    await page.waitForTimeout(800);
    // Modal headers use h2 with role=dialog wrapper; look for the role=dialog count.
    const dialogs = page.locator('[role=dialog]');
    const visibleCount = await dialogs.evaluateAll(els => els.filter(e => e.offsetParent !== null).length);
    expect(visibleCount).toBe(0);
  });

  test('#34 #35 admin opening a vendor sees email + phone populated @smoke', async ({ page }) => {
    await openFirstUser(page, '/#app/vendors');
    // Wait for the async enrich fetch (~500ms after modal mount).
    await page.waitForTimeout(2000);
    // The modal body has KV pairs — find any text containing @ (an email).
    const dialogBody = page.locator('[role=dialog]').first();
    const text = await dialogBody.innerText();
    expect(text).toMatch(/@/);
    // Phone field also populated (10 digits in some format)
    expect(text).toMatch(/\d{3}.*\d{3}.*\d{4}/);
  });
});
