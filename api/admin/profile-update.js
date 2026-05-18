// Admin-only profile update — used by the admin Users page to flip verified/role/status.
// Required because client-side updates are blocked by the rr_profiles_block_elevation trigger.
//
// POST body: { userId, fields: { verified?, role?, status? } }
// Auth: must be a signed-in admin (JWT in Authorization header).

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://oerfmtjpwrefxuitsphl.supabase.co';
const ALLOWED_FIELDS = new Set(['verified', 'role', 'status', 'onboarding_complete']);

async function verifyAdmin(req) {
  const auth = req.headers?.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: process.env.SUPABASE_ANON_KEY || token },
    });
    if (!r.ok) return null;
    const user = await r.json();
    if (!user?.id) return null;
    const svc = process.env.SUPABASE_SERVICE_KEY;
    const pr = await fetch(`${SUPABASE_URL}/rest/v1/rr_profiles?id=eq.${user.id}&select=role`, {
      headers: { apikey: svc, Authorization: `Bearer ${svc}` },
    });
    const rows = await pr.json();
    return rows?.[0]?.role === 'admin' ? user.id : null;
  } catch (e) { return null; }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const adminId = await verifyAdmin(req);
  if (!adminId) return res.status(401).json({ error: 'Admin auth required' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: 'Invalid JSON' }); } }
  const { userId, fields } = body || {};
  if (!userId || !fields || typeof fields !== 'object') return res.status(400).json({ error: 'userId and fields required' });

  const safe = {};
  for (const [k, v] of Object.entries(fields)) {
    if (ALLOWED_FIELDS.has(k)) safe[k] = v;
  }
  if (Object.keys(safe).length === 0) return res.status(400).json({ error: 'no permitted fields in payload' });

  const svc = process.env.SUPABASE_SERVICE_KEY;
  if (!svc) return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY not set' });

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rr_profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        apikey: svc, Authorization: `Bearer ${svc}`,
        'Content-Type': 'application/json', Prefer: 'return=representation',
      },
      body: JSON.stringify(safe),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: 'Update failed', details: data });
    return res.status(200).json({ ok: true, row: data?.[0] });
  } catch (e) {
    console.error('profile-update crashed', e);
    return res.status(500).json({ error: String(e) });
  }
};
