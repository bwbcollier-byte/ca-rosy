// Marketing site — anonymous and signed-in routing.
// Covers SMOKE_TEST.md items #25-32.
const { test, expect } = require('@playwright/test');
const { signInAsAdmin } = require('./fixtures/helpers');

test.describe('Marketing site', () => {
  test('#25 anonymous visitor lands on /#marketing without bounce @smoke', async ({ page }) => {
    await page.goto('/#marketing');
    // Hero / nav should render. No auth shell, no app shell.
    await expect(page).toHaveURL(/#marketing/);
    await expect(page.getByRole('button', { name: /Get started/i }).first()).toBeVisible();
  });

  test('#27 hard refresh on /#marketing/faq stays on FAQ page @smoke', async ({ page }) => {
    await page.goto('/#marketing/faq');
    await expect(page).toHaveURL(/#marketing\/faq/);
    await expect(page.getByText('Answers, before you ask.')).toBeVisible();
    // Reload — must NOT bounce to dashboard or marketing home.
    await page.reload();
    await expect(page).toHaveURL(/#marketing\/faq/);
    await expect(page.getByText('Answers, before you ask.')).toBeVisible();
  });

  test('#29 vendor-only FAQs do NOT appear on marketing FAQ page @smoke', async ({ page }) => {
    await page.goto('/#marketing/faq');
    // Give the on-mount fetch + initial hydration time to populate.
    await page.waitForTimeout(2000);
    const vendorOnly = page.locator('button, summary').filter({ hasText: /vendor only/i });
    await expect(vendorOnly).toHaveCount(0);
  });

  test('#30 marketing home "Common questions" excludes vendor-only @smoke', async ({ page }) => {
    await page.goto('/#marketing');
    await page.waitForTimeout(2000);
    const heading = page.getByRole('heading', { name: /common questions/i });
    if (await heading.isVisible()) {
      const vendorOnly = page.locator('button, summary').filter({ hasText: /vendor only/i });
      await expect(vendorOnly).toHaveCount(0);
    }
  });

  test('#26 signed-in user can view /#marketing without auto-redirect @smoke', async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto('/#marketing');
    await expect(page).toHaveURL(/#marketing/);
    // Should NOT bounce to /#app/dashboard
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/#marketing/);
  });
});
