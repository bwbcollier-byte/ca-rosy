// Deep-link / hash routing — hard refreshes on inner URLs must preserve
// the route. Covers SMOKE_TEST.md item #28 + the Stripe ?stripe=connected
// query-param sanitization (#91).
const { test, expect } = require('@playwright/test');
const { signInAsAdmin } = require('./fixtures/helpers');

test.describe('Deep-link routing', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test('#28 hard refresh on /#app/events stays on events page @smoke', async ({ page }) => {
    await page.goto('/#app/events');
    await expect(page).toHaveURL(/#app\/events/, { timeout: 10_000 });
    await page.reload();
    await page.waitForTimeout(3_000);
    await expect(page).toHaveURL(/#app\/events/);
  });

  test('#91 #app/dashboard?stripe=connected resolves to dashboard not 404 @smoke', async ({ page }) => {
    await page.goto('/#app/dashboard?stripe=connected');
    await page.waitForTimeout(3_000);
    // Page must NOT show "No <route> screen yet" empty state — that means the
    // router treated the query suffix as part of the route name.
    const noScreenEmpty = page.getByText(/no dashboard\?stripe.*screen yet/i);
    await expect(noScreenEmpty).toHaveCount(0);
    // Should be on the actual dashboard.
    await expect(page.getByText(/Good (Morning|Afternoon|Evening)/i)).toBeVisible({ timeout: 5_000 });
  });

  test('#28 hard refresh on /#app/notifications stays on notifications @smoke', async ({ page }) => {
    await page.goto('/#app/notifications');
    await page.waitForTimeout(2_000);
    await page.reload();
    await page.waitForTimeout(2_000);
    await expect(page).toHaveURL(/#app\/notifications/);
  });
});
