// Auth — login + logout + signup-to-onboarding redirect.
// Covers SMOKE_TEST.md items #1-3, #19.
const { test, expect } = require('@playwright/test');
const { ADMIN_EMAIL, ADMIN_PASSWORD, signInAsAdmin, logout, freshEmail } = require('./fixtures/helpers');

test.describe('Auth', () => {
  test('#3 existing admin signs in and lands on dashboard @smoke', async ({ page }) => {
    await page.goto('/#auth');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await page.locator('input[type=email]').fill(ADMIN_EMAIL);
    await page.locator('input[type=password]').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /^Log in$/ }).click();
    await expect(page).toHaveURL(/#app\/dashboard/, { timeout: 10_000 });
  });

  test('#1 fresh vendor signup redirects to onboarding within 15s @smoke', async ({ page }) => {
    const email = freshEmail('vendor');
    const start = Date.now();
    // Force signup mode via the marketing → signup CTA, which routes to /#auth?signup
    // The auth-form heading reads "Create your account." in signup mode.
    await page.goto('/#auth');
    // Click the "Sign up" toggle link at the bottom of the login form.
    await page.locator('.btn-link', { hasText: 'Sign up' }).click().catch(async () => {
      // Fallback: scroll-down toggle
      await page.getByText(/Need an account/i).getByRole('button').click();
    });
    await expect(page.getByRole('heading', { name: /Create your account/i })).toBeVisible({ timeout: 5_000 });
    await page.locator('input[type=email]').fill(email);
    await page.locator('input[type=password]').fill('TestPass1!');
    await page.getByText(/I agree to the/i).click();
    await page.locator('form.auth-form button[type=submit]').click();
    await expect(page).toHaveURL(/#onboarding/, { timeout: 15_000 });
    const ms = Date.now() - start;
    console.log(`signup → onboarding: ${ms}ms`);
    expect(ms).toBeLessThan(15_000);
  });

  test('#19 logout clears session — next page load does not auto-restore @smoke', async ({ page }) => {
    await signInAsAdmin(page);
    await logout(page);
    // After our logout helper clears localStorage, visiting /#app/dashboard
    // should NOT restore the session.
    await page.goto('/#app/dashboard');
    // Either lands on marketing (redirected because no session) OR
    // shows the loading splash briefly. Either way: no admin sidebar.
    await page.waitForTimeout(2500);
    const dashboardHeading = page.getByText(/Good (Morning|Afternoon|Evening)/i);
    await expect(dashboardHeading).toBeHidden();
  });
});
