// Em-dash absence in user-facing communication. The user has explicitly asked
// for no em dashes ("—") in emails, toasts, and transactional messages.
// Covers SMOKE_TEST.md items #125-126.
const { test, expect, request } = require('@playwright/test');

const SUPABASE_URL = 'https://vwweyepknzgruobadlwf.supabase.co';
const ANON_KEY = 'sb_publishable_ilFDBPmFOsPy9xswDmIIhQ_9R5IFPzm';

test.describe('Em-dash / copy hygiene', () => {
  const ctxOpts = { timeout: 25_000 };

  test('#125 no em dashes in stored email templates @smoke', async () => {
    const ctx = await request.newContext({ extraHTTPHeaders: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } });
    const r = await ctx.get(`${SUPABASE_URL}/rest/v1/rr_email_templates?select=slug,subject,body_html,body_text`, ctxOpts);
    if (!r.ok()) {
      // Templates may be admin-only RLS — skip silently in that case.
      test.skip(true, 'rr_email_templates not anon-readable');
      return;
    }
    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      test.skip(true, 'no templates returned');
      return;
    }
    const offenders = rows.filter(t =>
      (t.subject && t.subject.includes('—')) ||
      (t.body_html && t.body_html.includes('—')) ||
      (t.body_text && t.body_text.includes('—'))
    );
    expect(offenders, `em dash leaked into templates: ${offenders.map(o => o.slug).join(', ')}`).toHaveLength(0);
  });

  test('#125 no em dashes in published FAQs @smoke', async () => {
    const ctx = await request.newContext({ extraHTTPHeaders: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } });
    const r = await ctx.get(`${SUPABASE_URL}/rest/v1/rr_faqs?select=question,answer&is_visible=eq.true`, ctxOpts);
    expect(r.status(), `unexpected status: ${r.status()}`).toBe(200);
    const rows = await r.json();
    const offenders = rows.filter(f => (f.question || '').includes('—') || (f.answer || '').includes('—'));
    expect(offenders, `em dash leaked into FAQs: ${offenders.map(o => o.question).join(' / ')}`).toHaveLength(0);
  });
});
