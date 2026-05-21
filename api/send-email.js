// Vercel serverless function — sends a templated transactional email via Postmark.
// DEMO SAFETY: every outbound message is force-routed to DEMO_REDIRECT_TO
// regardless of the recipient on the payload. The original intended recipient
// is prepended to the subject + body so you can see who would have received it.
//
// Body shape (POST JSON):
//   { templateSlug: 'welcome-vendor', to: 'someone@example.com', vars: { first_name: 'Theo', ... } }
//
// Templates are passed in from the client (they're maintained in admin/emails
// page). For now we treat the templateSlug as informational; the HTML body
// itself is built client-side or fetched from RosyStores. If `html` is passed
// directly we use it; otherwise we'll send a minimal fallback.

const DEMO_REDIRECT_TO = 'ben@pronocoders.com';
const FROM_DEFAULT = 'noreply@rosyrecruits.com'; // change once domain is verified in Postmark
const FROM_NAME = 'Rosy Recruits';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://oerfmtjpwrefxuitsphl.supabase.co';

// In-memory rate limit (per cold start instance — good enough to throttle abuse)
const RATE_BUCKET = new Map();
const RL_WINDOW_MS = 60_000;
const RL_MAX = 30;
function hitRateLimit(ip) {
  const now = Date.now();
  const arr = (RATE_BUCKET.get(ip) || []).filter(t => now - t < RL_WINDOW_MS);
  arr.push(now);
  RATE_BUCKET.set(ip, arr);
  return arr.length > RL_MAX;
}

// Verify the incoming Bearer token belongs to a real Supabase auth user.
// Returns { userId, role } or null if invalid. Optionally checks for admin role.
async function verifyAuth(req, { requireAdmin = false } = {}) {
  const auth = req.headers?.authorization || req.headers?.Authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    // /auth/v1/user validates the JWT (it's the user's session token from the browser)
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: process.env.SUPABASE_ANON_KEY || token },
    });
    if (!r.ok) return null;
    const user = await r.json();
    if (!user?.id) return null;
    if (requireAdmin) {
      const svc = process.env.SUPABASE_SERVICE_KEY;
      if (!svc) return null;
      const pr = await fetch(`${SUPABASE_URL}/rest/v1/rr_profiles?id=eq.${user.id}&select=role`, {
        headers: { apikey: svc, Authorization: `Bearer ${svc}` },
      });
      const rows = await pr.json();
      if (rows?.[0]?.role !== 'admin') return null;
      return { userId: user.id, role: 'admin' };
    }
    return { userId: user.id, role: 'user' };
  } catch (e) { return null; }
}

// Whitelist of trigger slugs allowed without admin auth (used by the
// browser when a real user action happens, e.g. signup, apply, etc.).
// Each one still requires a valid signed-in Supabase JWT.
const USER_TRIGGER_SLUGS = new Set([
  'welcome-vendor', 'welcome-worker', 'verified',
  'application-received', 'worker-confirmed', 'worker-paid',
  'worker-rejected', 'day-of-event',
  'invite-user', 'trust-report',
]);

const ALLOWED_ORIGINS = new Set([
  'https://rosy-demo.vercel.app',
  'https://rosy.rascals-co.com',
  'http://localhost:8765',
  'http://localhost:3000',
]);

module.exports = async (req, res) => {
  const origin = req.headers?.origin || '';
  const corsOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://rosy-demo.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit per source IP
  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().split(',')[0].trim();
  if (hitRateLimit(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  const token = process.env.POSTMARK_SERVER_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'POSTMARK_SERVER_TOKEN not configured.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: 'Invalid JSON' }); }
  }
  body = body || {};
  const { templateSlug, to: originalTo, subject, html, text, vars = {}, from } = body;

  if (!subject || (!html && !text)) {
    return res.status(400).json({ error: 'subject and one of html/text are required' });
  }

  // Auth: every request needs a valid Supabase session. User-trigger slugs (welcome,
  // application-received, etc.) accept any signed-in user; everything else requires admin.
  const needsAdmin = !templateSlug || !USER_TRIGGER_SLUGS.has(templateSlug);
  const session = await verifyAuth(req, { requireAdmin: needsAdmin });
  if (!session) {
    return res.status(401).json({ error: 'Unauthorised — sign in required' + (needsAdmin ? ' (admin only)' : '') });
  }

  // Hard caps on inputs to prevent abuse
  if (String(subject).length > 300) return res.status(400).json({ error: 'subject too long' });
  if (html && String(html).length > 200_000) return res.status(400).json({ error: 'html body too large' });

  // Variable substitution — replace {{var}} placeholders.
  const fill = (str) => {
    if (!str) return str;
    return String(str).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => {
      if (k in vars) return String(vars[k] ?? '');
      // Built-in safe defaults
      if (k === 'app_url') return 'https://rosy-demo.vercel.app';
      if (k === 'unsubscribe_url') return 'https://rosy-demo.vercel.app/#marketing';
      if (k === 'help_url') return 'https://rosy-demo.vercel.app/#help';
      if (k === 'effective_date') return new Date().toISOString().slice(0, 10);
      return '';
    });
  };

  const filledSubject = fill(subject);
  const filledHtml = fill(html);
  const filledText = fill(text);

  // Demo safety banner
  const demoBanner = `<div style="background:#FFF4D6;border:1px solid #E0C97A;padding:10px 14px;border-radius:8px;margin-bottom:14px;font-family:sans-serif;font-size:12.5px;color:#7A5800;">
    <strong>DEMO MODE</strong> · originally addressed to <strong>${originalTo || '(no recipient)'}</strong> · template <code>${templateSlug || '(adhoc)'}</code>
  </div>`;
  const demoSubjectPrefix = `[DEMO → ${originalTo || 'unknown'}] `;

  const payload = {
    From: from || `${FROM_NAME} <${FROM_DEFAULT}>`,
    To: DEMO_REDIRECT_TO,
    Subject: demoSubjectPrefix + filledSubject,
    HtmlBody: filledHtml ? demoBanner + filledHtml : undefined,
    TextBody: filledText ? `[DEMO → ${originalTo}]\n\n` + filledText : undefined,
    MessageStream: 'outbound',
    Tag: templateSlug || 'adhoc',
    Metadata: {
      template: templateSlug || 'adhoc',
      original_recipient: originalTo || '',
    },
  };

  try {
    const r = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': token,
      },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (!r.ok) {
      console.warn('Postmark error', r.status, data);
      return res.status(r.status).json({ error: 'Postmark rejected the message', details: data });
    }
    return res.status(200).json({ ok: true, postmark: data, demoRoutedTo: DEMO_REDIRECT_TO });
  } catch (e) {
    console.error('send-email handler crashed', e);
    return res.status(500).json({ error: String(e) });
  }
};
