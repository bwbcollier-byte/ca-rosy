// Consumes a one-time password-reset token (minted by /api/auth/password-reset),
// validates it, and updates the user's password via the Supabase admin API.
//
// POST body: { token, password }
// Returns 200 { ok: true, email } on success — caller can sign in normally.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vwweyepknzgruobadlwf.supabase.co';

const ALLOWED_ORIGINS = new Set([
  'https://rosy-demo.vercel.app',
  'https://rosy.rascals-co.com',
  'http://localhost:8765',
  'http://localhost:3000',
]);

const RATE_BUCKET = new Map();
function hitRateLimit(ip) {
  const now = Date.now();
  const arr = (RATE_BUCKET.get(ip) || []).filter(t => now - t < 60_000);
  arr.push(now);
  RATE_BUCKET.set(ip, arr);
  return arr.length > 20;
}

module.exports = async (req, res) => {
  const origin = req.headers?.origin || '';
  const corsOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://rosy-demo.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().split(',')[0].trim();
  if (hitRateLimit(ip)) return res.status(429).json({ error: 'Too many attempts. Try again later.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: 'Invalid JSON' }); } }
  body = body || {};
  const token    = (body.token || '').toString();
  const password = (body.password || '').toString();
  if (!token || !password) return res.status(400).json({ error: 'token and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const svc = process.env.SUPABASE_SERVICE_KEY;
  if (!svc) return res.status(500).json({ error: 'Server not configured' });
  const headers = { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json' };

  // 1. Look up + validate the token.
  let tokenRow;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rr_password_reset_tokens?token=eq.${encodeURIComponent(token)}&select=token,user_id,expires_at,used_at`, { headers });
    const rows = await r.json();
    tokenRow = rows?.[0];
  } catch (e) {
    return res.status(500).json({ error: 'Token lookup failed' });
  }
  if (!tokenRow) return res.status(400).json({ error: 'Invalid or already-used reset link.' });
  if (tokenRow.used_at) return res.status(400).json({ error: 'This reset link has already been used. Request a new one.' });
  if (new Date(tokenRow.expires_at) < new Date()) {
    return res.status(400).json({ error: 'This reset link has expired. Request a new one.' });
  }

  // 2. Update the user's password via admin API.
  let userEmail = null;
  try {
    const upd = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${tokenRow.user_id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ password }),
    });
    if (!upd.ok) {
      const errBody = await upd.text().catch(() => '');
      console.warn('[reset-consume] password update failed', upd.status, errBody);
      return res.status(500).json({ error: 'Could not update password. Try again.' });
    }
    const u = await upd.json().catch(() => null);
    userEmail = u?.email || null;
  } catch (e) {
    console.warn('[reset-consume] update threw:', e);
    return res.status(500).json({ error: 'Could not update password. Try again.' });
  }

  // 3. Burn the token + any others belonging to this user.
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rr_password_reset_tokens?user_id=eq.${tokenRow.user_id}&used_at=is.null`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ used_at: new Date().toISOString() }),
    });
  } catch (e) { /* best-effort cleanup */ }

  return res.status(200).json({ ok: true, email: userEmail });
};
