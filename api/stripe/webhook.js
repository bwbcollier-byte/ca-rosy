// Stripe webhook handler. Verifies the signature and reacts to Connect + Payment events.
// Events handled:
//   - account.updated → mirror chargesEnabled / payoutsEnabled to rr_profiles
//   - payment_intent.succeeded → mark linked transaction as Paid
//   - transfer.paid → mark transfer-side payout complete
//
// Add the webhook in Stripe Dashboard → Developers → Webhooks → URL:
//   https://rosy-demo.vercel.app/api/stripe/webhook
// Then copy the signing secret into env var STRIPE_WEBHOOK_SECRET.
//
// IMPORTANT: this function must read the RAW request body to verify the
// signature. We disable Vercel's default body parser via `export const config`.

const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vwweyepknzgruobadlwf.supabase.co';

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// Stripe signature verification (no SDK required).
function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return false;
  const parts = signatureHeader.split(',').reduce((acc, p) => {
    const [k, v] = p.split('=');
    if (k === 't') acc.t = v;
    if (k === 'v1') (acc.v1 = acc.v1 || []).push(v);
    return acc;
  }, {});
  if (!parts.t || !parts.v1) return false;
  const signedPayload = `${parts.t}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return parts.v1.some(sig => {
    if (sig.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  });
}

async function svcPatch(path, body) {
  const svc = process.env.SUPABASE_SERVICE_KEY;
  if (!svc) throw new Error('SUPABASE_SERVICE_KEY not set');
  const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: 'PATCH',
    headers: { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!r.ok) console.warn('[stripe webhook] svcPatch', path, r.status, await r.text());
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('[stripe webhook] STRIPE_WEBHOOK_SECRET not set — refusing event');
    return res.status(500).json({ error: 'webhook secret not configured' });
  }

  let rawBody;
  try { rawBody = await readRawBody(req); } catch (e) { return res.status(400).json({ error: 'failed to read body' }); }

  const sig = req.headers['stripe-signature'];
  if (!verifyStripeSignature(rawBody, sig, secret)) {
    console.warn('[stripe webhook] bad signature');
    return res.status(400).json({ error: 'invalid signature' });
  }

  let evt;
  try { evt = JSON.parse(rawBody); } catch (e) { return res.status(400).json({ error: 'invalid json' }); }
  console.log('[stripe webhook]', evt.type, evt.id);

  try {
    switch (evt.type) {
      case 'account.updated': {
        const acct = evt.data?.object;
        if (acct?.id) {
          await svcPatch(`/rr_profiles?stripe_account_id=eq.${acct.id}`, {
            stripe_charges_enabled: !!acct.charges_enabled,
            stripe_payouts_enabled: !!acct.payouts_enabled,
            stripe_details_submitted: !!acct.details_submitted,
          });
        }
        break;
      }
      case 'payment_intent.succeeded': {
        // Transactions are stored on rr_gig_applications (payment_status column).
        // metadata.application_id (preferred) or .transaction_id are accepted.
        const pi = evt.data?.object;
        const appId = pi?.metadata?.application_id || pi?.metadata?.transaction_id;
        if (appId) {
          await svcPatch(`/rr_gig_applications?id=eq.${appId}`, {
            payment_status: 'paid', paid_at: new Date().toISOString(),
            stripe_payment_intent_id: pi.id,
          });
        }
        break;
      }
      case 'transfer.paid':
      case 'payout.paid': {
        const obj = evt.data?.object;
        const appId = obj?.metadata?.application_id || obj?.metadata?.transaction_id;
        if (appId) await svcPatch(`/rr_gig_applications?id=eq.${appId}`, { payment_status: 'paid' });
        break;
      }
      default:
        // Acknowledged but no handler — fine.
        break;
    }
  } catch (e) {
    console.error('[stripe webhook] handler failed', evt.type, e);
    // Return 200 so Stripe doesn't retry forever for issues outside our control.
  }

  return res.status(200).json({ received: true });
};

module.exports.config = { api: { bodyParser: false } };
