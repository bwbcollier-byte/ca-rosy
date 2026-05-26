// Notifications — bell dropdown, archive flow, preferences page.
// Covers SMOKE_TEST.md items #81-87.
const { test, expect } = require('@playwright/test');
const { signInAsAdmin } = require('./fixtures/helpers');

test.describe('Notifications', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test('#82 opening Notifications page clears the unread badge @smoke', async ({ page }) => {
    await page.goto('/#app/notifications');
    await page.waitForLoadState('networkidle').catch(() => {});
    // After ~1s the auto-mark-read should fire — Tab title shouldn't read "Unread (N)" with N>0.
    await page.waitForTimeout(2_000);
    // Look at the tabs row for Unread (N) — count should be 0.
    const unreadTab = page.locator('button', { hasText: /^Unread/i }).first();
    if (await unreadTab.isVisible()) {
      const text = await unreadTab.innerText();
      const match = text.match(/Unread \((\d+)\)/);
      if (match) {
        expect(Number(match[1])).toBe(0);
      }
    }
  });

  test('#85 "All" count matches visible rendered notifications @smoke', async ({ page }) => {
    await page.goto('/#app/notifications');
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2_000);
    const allTab = page.locator('button', { hasText: /^All \(\d+\)$/ }).first();
    if (!(await allTab.isVisible())) {
      test.skip(true, 'no notifications, nothing to verify');
      return;
    }
    const text = await allTab.innerText();
    const claimedCount = Number(text.match(/All \((\d+)\)/)?.[1] ?? 0);
    // Count visible notification rows (each has a title + a body — find by archive button).
    const rows = page.locator('button[aria-label="Archive notification"]');
    const renderedCount = await rows.count();
    expect(renderedCount).toBe(claimedCount);
  });
});
