// Data integrity — the two bug classes the user has flagged repeatedly:
//
//   (A) Popup fields changing unexpectedly after open
//   (B) Forms not pre-populating with the stored data
//
// These tests do NOT modify data. They open popups, read field values,
// wait, then re-read and compare. Read-only verification per ROSY_DEV.md.
const { test, expect } = require('@playwright/test');
const { signInAsAdmin } = require('./fixtures/helpers');

test.describe('Data integrity — popups + forms', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test('admin user modal: fields do NOT change in the 10s after opening @smoke', async ({ page }) => {
    await page.goto('/#app/users');
    await page.waitForLoadState('networkidle').catch(() => {});
    // Open the first user row.
    const row = page.locator('[role=button][aria-label^="Open "]').first();
    await row.waitFor({ state: 'visible', timeout: 10_000 });
    await row.click();
    const dialog = page.locator('[role=dialog]').first();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    // Wait for the async enrich fetch to settle (~2-3s).
    await page.waitForTimeout(3_000);
    // Snapshot the entire modal body text.
    const snapshot1 = await dialog.innerText();
    // Wait another 8 seconds without doing ANYTHING. Realtime listeners
    // shouldn't mutate the visible content unless the underlying row
    // actually changed in the DB (which it shouldn't have).
    await page.waitForTimeout(8_000);
    const snapshot2 = await dialog.innerText();
    expect(snapshot2, 'modal content changed during idle 8s wait').toBe(snapshot1);
  });

  test('settings profile form: pre-populates with admin data @smoke', async ({ page }) => {
    await page.goto('/#app/settings');
    await page.waitForLoadState('networkidle').catch(() => {});
    // The Profile tab is the default tab. Wait for the form to render.
    await expect(page.getByText(/managed by auth/i)).toBeVisible({ timeout: 15_000 });
    // Email input must have a value (any non-empty).
    const emailInput = page.locator('input[type=email]').first();
    await expect(emailInput).not.toHaveValue('', { timeout: 10_000 });
    // First name and last name — admin should have those set.
    // Use the label proximity selector — find the field-label "First name"
    // and grab the input within the same .field wrapper.
    const firstNameField = page.locator('.field', { has: page.getByText(/^First name$/i) }).first();
    const firstNameInput = firstNameField.locator('input').first();
    const firstNameValue = await firstNameInput.inputValue();
    expect(firstNameValue.length, 'First name field is blank').toBeGreaterThan(0);
  });

  test('settings profile form: values are stable across 5s of idle @smoke', async ({ page }) => {
    await page.goto('/#app/settings');
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByText(/managed by auth/i)).toBeVisible({ timeout: 15_000 });
    const emailInput = page.locator('input[type=email]').first();
    await expect(emailInput).not.toHaveValue('', { timeout: 10_000 });
    const initialEmail = await emailInput.inputValue();
    // Wait 5s without doing anything — a misbehaving useEffect would
    // re-init the form and clobber the value.
    await page.waitForTimeout(5_000);
    const afterEmail = await emailInput.inputValue();
    expect(afterEmail, 'email field changed during idle wait').toBe(initialEmail);
  });

  test('admin user modal: re-opening the same user shows same data @smoke', async ({ page }) => {
    await page.goto('/#app/users');
    await page.waitForLoadState('networkidle').catch(() => {});
    const row = page.locator('[role=button][aria-label^="Open "]').first();
    await row.click();
    const dialog = page.locator('[role=dialog]').first();
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(3_000);
    const firstSnapshot = await dialog.innerText();
    // Close
    await page.getByRole('button', { name: /^close$/i }).first().click();
    await page.waitForTimeout(1_000);
    // Re-open same row
    await row.click();
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(3_000);
    const secondSnapshot = await dialog.innerText();
    expect(secondSnapshot, 'modal data differs between consecutive opens').toBe(firstSnapshot);
  });
});
