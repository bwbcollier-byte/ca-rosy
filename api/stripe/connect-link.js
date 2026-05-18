// Creates a Stripe Connect Express account (if one doesn't exist yet for this
// user) + an account onboarding link they can be redirected to. Saves the
// resulting acct_xxx ID into rr_profiles.stripe_account_id so the next call
// reuses it.
//
// POST body: { userId, email, returnUrl, refreshUrl }
// Response:  { url: 'https://connect.stripe.com/...' }
//
// Uses STRIPE_SECRET_KEY (sk_test_…) from Vercel env.

const STRIPE_KEY = () => process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = () => process.env.SUPABASE_URL || 'https://oerfmtjpwrefxuitsphl.supabase.co';
const SUPABASE_SERVICE_KEY = () => process.env.SUPABASE_SERVICE_KEY; // service role for server-side writes

// Tiny urlencoded helper for Stripe form-encoded bodies
const enc = (obj) => Object.entries(obj)
  .filter(([, v]) => v !== undefined && v !== null && v !== '')
  .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
  .join('&');

async function stripeFetch(path, params, method = 'POST') {
  const r = await fetch('https://api.stripe.com/v1' + path, {
    method,
    headers: {
      Authorization: `Bearer ${STRIPE_KEY()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: method === 'POST' ? enc(params || {}) : undefined,
  });
  const data = await r.json();
  if (!r.ok) {
    const err = new Error(data?.error?.message || `Stripe ${r.status}`);
    err.status = r.status;
    err.details = data;
    throw err;
  }
  return data;
}

async function supabaseGetProfile(userId) {
  const r = await fetch(`${SUPABASE_URL()}/rest/v1/rr_profiles?id=eq.${userId}&select=id,email,stripe_account_id,role`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY(),
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY()}`,
    },
  });
  if (!r.ok) return null;
  const rows = await r.json();
  return rows[0] || null;
}

async function supabaseSaveAccount(userId, acctId) {
  await fetch(`${SUPABASE_URL()}/rest/v1/rr_profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_SERVICE_KEY(),
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY()}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ stripe_account_id: acctId }),
  });
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!STRIPE_KEY()) return res.status(500).json({ error: 'STRIPE_SECRET_KEY not set' });
  if (!SUPABASE_SERVICE_KEY()) return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY not set' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: 'Invalid JSON' }); } }
  const { userId, email, returnUrl, refreshUrl } = body || {};
  if (!userId || !email) return res.status(400).json({ error: 'userId and email required' });

  try {
    // Look up existing account
    const profile = await supabaseGetProfile(userId);
    let acctId = profile?.stripe_account_id || null;

    if (!acctId) {
      const acct = await stripeFetch('/accounts', {
        type: 'express',
        country: 'US',
        email,
        capabilities: { 'card_payments[requested]': 'true', 'transfers[requested]': 'true' },
        business_type: 'individual',
        'metadata[role]': profile?.role || 'unknown',
        'metadata[rr_user_id]': userId,
      });
      acctId = acct.id;
      await supabaseSaveAccount(userId, acctId);
    }

    const linkOrigin = (returnUrl && returnUrl.replace(/\/$/, '')) || 'https://rosy-demo.vercel.app';
    const link = await stripeFetch('/account_links', {
      account: acctId,
      refresh_url: refreshUrl || `${linkOrigin}/#app/settings?stripe=refresh`,
      return_url:  returnUrl  || `${linkOrigin}/#app/dashboard?stripe=connected`,
      type: 'account_onboarding',
    });

    return res.status(200).json({ url: link.url, accountId: acctId });
  } catch (e) {
    console.error('connect-link failed', e);
    return res.status(e.status || 500).json({ error: e.message, details: e.details });
  }
};
