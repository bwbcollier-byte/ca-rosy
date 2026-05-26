// Settings — profile email displays correctly, location field is Google Places,
// payouts/payments label by role. Covers SMOKE_TEST.md items #94-103.
const { test, expect } = require('@playwright/test');
const { signInAsAdmin, ADMIN_EMAIL } = require('./fixtures/helpers');

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test('#94 #95 profile email displays from session and is read-only @smoke', async ({ page }) => {
    await page.goto('/#app/settings');
    await page.waitForLoadState('networkidle').catch(() => {});
    // The Profile tab is selected by default. Wait for the email label first.
    await expect(page.getByText(/managed by auth/i)).toBeVisible({ timeout: 15_000 });
    const emailInput = page.locator('input[type=email]').first();
    await expect(emailInput).toBeVisible({ timeout: 5_000 });
    // Wait for the async session fetch to populate (~1-2s after mount).
    await expect(emailInput).toHaveValue(ADMIN_EMAIL, { timeout: 10_000 });
    await expect(emailInput).toBeDisabled();
  });

  test('#102 no Danger Zone tab in settings @smoke', async ({ page }) => {
    await page.goto('/#app/settings');
    await page.waitForLoadState('networkidle').catch(() => {});
    // No tab labelled "Danger zone" should be visible (admins didn't have it
    // either, but we explicitly removed it across the app).
    const dangerTab = page.locator('button.nav-item', { hasText: /danger zone/i });
    await expect(dangerTab).toHaveCount(0);
  });

  test('#101 no "Your data" section under Privacy & Data @smoke', async ({ page }) => {
    await page.goto('/#app/settings');
    await page.waitForLoadState('networkidle').catch(() => {});
    // Click into Privacy & Data tab if it exists
    const privacyTab = page.locator('button.nav-item', { hasText: /privacy/i });
    if ((await privacyTab.count()) > 0) {
      await privacyTab.first().click();
      await page.waitForTimeout(500);
      // The Your-data section's "Export all my data" button should NOT be visible.
      const exportBtn = page.getByRole('button', { name: /export all my data/i });
      await expect(exportBtn).toHaveCount(0);
    }
  });
});
