// Shared helpers used by every spec. Keep these small + obvious.
const { expect } = require('@playwright/test');

// Dedicated e2e admin so tests don't share creds with real users.
// Overridable via env vars when running against a different env.
const ADMIN_EMAIL    = process.env.ROSY_ADMIN_EMAIL    || 'e2e-admin@rosyrecruits.com';
const ADMIN_PASSWORD = process.env.ROSY_ADMIN_PASSWORD || 'E2eTests1!';

// Generate a unique email for each signup test so we never hit "already exists".
function freshEmail(prefix = 'e2e') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@e2e.rosytests.com`;
}

// Sign in as admin. Loads the persisted session from global-setup if present
// (fast path — no UI), falls back to a UI login if not (first run / CI).
async function signInAsAdmin(page) {
  const fs = require('fs');
  const path = require('path');
  const storagePath = path.join(__dirname, '..', '.auth', 'admin.json');
  if (fs.existsSync(storagePath)) {
    const state = JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
    const context = page.context();
    await context.addCookies(state.cookies || []);
    // Origin storage (localStorage) for each saved origin
    for (const origin of state.origins || []) {
      await page.goto(origin.origin);
      for (const { name, value } of origin.localStorage || []) {
        await page.evaluate(([k, v]) => localStorage.setItem(k, v), [name, value]);
      }
    }
    await page.goto('/#app/dashboard');
    await expect(page).toHaveURL(/#app\/dashboard/, { timeout: 10_000 });
    return;
  }
  // Fallback UI login
  await page.goto('/#auth');
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  await page.locator('input[type=email]').fill(ADMIN_EMAIL);
  await page.locator('input[type=password]').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /^Log in$/ }).click();
  await expect(page).toHaveURL(/#app\/dashboard/, { timeout: 15_000 });
}

// Sign up a brand-new account through the UI. Returns the email used.
async function signUpFreshUser(page, { prefix = 'e2e', password = 'TestPass1!' } = {}) {
  const email = freshEmail(prefix);
  await page.goto('/#auth');
  // Toggle to signup mode via the bottom "Sign up" link
  const signupLink = page.getByRole('button', { name: /^Sign up$/i }).first();
  if (await signupLink.isVisible()) await signupLink.click();
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(password);
  // T&Cs agree label
  await page.getByText(/I agree to the/i).click();
  await page.locator('form.auth-form button[type=submit]').click();
  await expect(page).toHaveURL(/#onboarding/, { timeout: 10_000 });
  return { email, password };
}

// Quick logout helper for tests that need to switch users.
async function logout(page) {
  await page.evaluate(() => {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('sb-') || k.startsWith('rosy.auth') || k.startsWith('supabase.')) localStorage.removeItem(k);
    });
    Object.keys(sessionStorage).forEach(k => sessionStorage.removeItem(k));
  });
  await page.goto('/#marketing');
}

module.exports = {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  freshEmail,
  signInAsAdmin,
  signUpFreshUser,
  logout,
};
