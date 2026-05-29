// RLS / privacy probes — verify the public view and base-table policies are
// doing what we think. These tests hit Supabase directly without UI, so they
// run in ~1 second and lock in the privacy hardening. Covers SMOKE_TEST.md
// items #113-117.
const { test, expect, request } = require('@playwright/test');

const SUPABASE_URL = 'https://vwweyepknzgruobadlwf.supabase.co';
const ANON_KEY = 'sb_publishable_ilFDBPmFOsPy9xswDmIIhQ_9R5IFPzm';

test.describe('RLS privacy', () => {
  // Supabase can cold-start; allow generous network timeouts before each call.
  const ctxOpts = { timeout: 25_000 };

  test('#113 anonymous SELECT on rr_profiles returns 0 rows @smoke', async () => {
    const ctx = await request.newContext({ extraHTTPHeaders: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } });
    const r = await ctx.get(`${SUPABASE_URL}/rest/v1/rr_profiles?select=id,email,stripe_account_id`, ctxOpts);
    expect(r.status(), `unexpected status: ${r.status()} - ${await r.text().catch(() => '?')}`).toBe(200);
    const body = await r.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(0);
  });

  test('#114 anonymous CANNOT request sensitive columns from rr_profiles_public view @smoke', async () => {
    // Postgrest returns 400 "column does not exist" when you SELECT a column
    // that isn't in the view's column list. We test each forbidden column
    // individually with limit=1 — fast, deterministic, no DB scan.
    const ctx = await request.newContext({ extraHTTPHeaders: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } });
    const forbidden = [
      'email', 'phone', 'geo_address',
      'stripe_account_id', 'stripe_customer_id',
      'w9_data',
    ];
    for (const col of forbidden) {
      const r = await ctx.get(`${SUPABASE_URL}/rest/v1/rr_profiles_public?select=${col}&limit=1`, ctxOpts);
      // 400 = column not in view's column list = correctly hidden.
      // 200 with data = column IS exposed = privacy hole.
      const status = r.status();
      const text = await r.text().catch(() => '');
      expect(status, `${col} should NOT be readable on public view (got status ${status}, body: ${text.slice(0, 120)})`).not.toBe(200);
    }
  });

  test('#114 safe columns ARE selectable on rr_profiles_public @smoke', async () => {
    const ctx = await request.newContext({ extraHTTPHeaders: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } });
    const r = await ctx.get(`${SUPABASE_URL}/rest/v1/rr_profiles_public?select=id,first_name,role&limit=3`, ctxOpts);
    expect(r.status()).toBe(200);
    const rows = await r.json();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty('id');
    expect(rows[0]).toHaveProperty('role');
  });
});
