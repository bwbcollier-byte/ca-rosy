// Runs ONCE before the whole suite. Signs in as the e2e admin, saves the
// session to admin-storage.json so every test that needs admin auth can
// load it instead of doing a fresh UI login (which triggers Supabase
// rate-limits and burns 5-10 seconds per test).
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const ADMIN_EMAIL    = process.env.ROSY_ADMIN_EMAIL    || 'e2e-admin@rosyrecruits.com';
const ADMIN_PASSWORD = process.env.ROSY_ADMIN_PASSWORD || 'E2eTests1!';
const BASE_URL       = process.env.BASE_URL || 'https://rosy-demo.vercel.app';
const STORAGE_PATH   = path.join(__dirname, '.auth', 'admin.json');

module.exports = async () => {
  fs.mkdirSync(path.dirname(STORAGE_PATH), { recursive: true });
  // If a recent session is cached (<10 minutes old), reuse it. Supabase auth
  // rate-limits repeated logins for the same email, so re-using a fresh
  // token is cheaper than retrying. Set ROSY_FORCE_LOGIN=1 to override.
  if (!process.env.ROSY_FORCE_LOGIN && fs.existsSync(STORAGE_PATH)) {
    const age = Date.now() - fs.statSync(STORAGE_PATH).mtimeMs;
    if (age < 10 * 60 * 1000) {
      console.log(`[global-setup] reusing cached admin session (${Math.round(age/1000)}s old)`);
      return;
    }
  }
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE_URL}/#auth`, { timeout: 30_000 });
    await page.locator('input[type=email]').fill(ADMIN_EMAIL);
    await page.locator('input[type=password]').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /^Log in$/ }).click();
    await page.waitForURL(/#app\/dashboard/, { timeout: 25_000 });
    await ctx.storageState({ path: STORAGE_PATH });
    console.log(`[global-setup] admin session saved to ${STORAGE_PATH}`);
  } catch (e) {
    console.warn(`[global-setup] login failed — tests will fall back to UI login per-test. ${e.message}`);
  } finally {
    await browser.close();
  }
};
