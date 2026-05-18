// Returns the current Stripe Connect status for a user.
// GET ?userId=xxx → { accountId, chargesEnabled, payoutsEnabled, detailsSubmitted }

const STRIPE_KEY = () => process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = () => process.env.SUPABASE_URL || 'https://oerfmtjpwrefxuitsphl.supabase.co';
const SUPABASE_SERVICE_KEY = () => process.env.SUPABASE_SERVICE_KEY;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userId = req.query?.userId || (req.url && new URL(req.url, 'http://x').searchParams.get('userId'));
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    const pr = await fetch(`${SUPABASE_URL()}/rest/v1/rr_profiles?id=eq.${userId}&select=stripe_account_id`, {
      headers: { apikey: SUPABASE_SERVICE_KEY(), Authorization: `Bearer ${SUPABASE_SERVICE_KEY()}` },
    });
    const rows = await pr.json();
    const acctId = rows?.[0]?.stripe_account_id;
    if (!acctId) return res.status(200).json({ accountId: null, chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false });

    const ar = await fetch(`https://api.stripe.com/v1/accounts/${acctId}`, {
      headers: { Authorization: `Bearer ${STRIPE_KEY()}` },
    });
    const a = await ar.json();
    if (!ar.ok) return res.status(ar.status).json({ error: a?.error?.message });
    return res.status(200).json({
      accountId: a.id,
      chargesEnabled: !!a.charges_enabled,
      payoutsEnabled: !!a.payouts_enabled,
      detailsSubmitted: !!a.details_submitted,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
};
