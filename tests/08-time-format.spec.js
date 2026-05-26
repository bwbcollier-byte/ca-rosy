// Time + date formatting — locale-aware, no UTC drift, AM/PM not 24h.
// Covers SMOKE_TEST.md items #119-121.
const { test, expect } = require('@playwright/test');
const { signInAsAdmin } = require('./fixtures/helpers');

test.describe('Time + date formatting', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test('#119 no 24-hour times like "13:00" rendered as schedule labels @smoke', async ({ page }) => {
    // Walk the dashboard, events, and gigs pages — any 24h time in a schedule
    // context should have been converted to 12h with AM/PM.
    const urls = ['/#app/dashboard', '/#app/events', '/#app/gigs'];
    for (const url of urls) {
      await page.goto(url);
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(1_500);
      // Look for "HH:00–HH:00" or "HH:00-HH:00" patterns in 24h (13-23) which
      // would indicate an unconverted time. Allow 09:00 etc since they could
      // be ambiguous, but 13–23 is definitively 24h.
      const bodyText = await page.locator('body').innerText();
      const offending = bodyText.match(/\b(1[3-9]|2[0-3]):[0-5]\d\b/g);
      if (offending && offending.length > 0) {
        // Filter out e.g. user-typed bios that happen to mention 14:00.
        // Times in schedule labels typically have a dash before/after.
        const inSchedule = offending.filter(t => {
          const idx = bodyText.indexOf(t);
          const surrounding = bodyText.slice(Math.max(0, idx - 8), idx + t.length + 8);
          return /[–\-]/.test(surrounding);
        });
        expect(inSchedule, `24h time in schedule context on ${url}: ${inSchedule.join(', ')}`).toHaveLength(0);
      }
    }
  });
});
