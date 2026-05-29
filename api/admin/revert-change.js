// Admin-only: revert a recorded change in rr_change_log.
//
// POST body: { changeId }
// Auth: must be a signed-in admin (JWT in Authorization header).
//
// Behavior:
//  - 'update'  -> PATCH the row with before_data (whitelist: strip id/created_at/updated_at)
//  - 'insert'  -> DELETE the row (revert of an insert)
//  - 'delete'  -> re-INSERT the row from before_data
// Then stamps the change_log row with reverted_at + reverted_by.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vwweyepknzgruobadlwf.supabase.co';

// Tables we're willing to revert against — must match the audited table set.
const ALLOWED_TABLES = new Set([
  'rr_profiles', 'rr_events', 'rr_gigs', 'rr_venues',
  'rr_vendor_profiles', 'rr_worker_profiles',
  'rr_site_content', 'rr_admin_invites', 'rr_email_templates',
]);

const STRIPPED_FIELDS = new Set(['id', 'created_at', 'updated_at']);

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

function stripImmutable(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!STRIPPED_FIELDS.has(k)) out[k] = v;
  }
  return out;
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
  const { changeId } = body || {};
  if (!changeId) return res.status(400).json({ error: 'changeId required' });

  const svc = process.env.SUPABASE_SERVICE_KEY;
  if (!svc) return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY not set' });
  const svcHeaders = { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json' };

  try {
    // 1. Load the change_log row
    const lr = await fetch(`${SUPABASE_URL}/rest/v1/rr_change_log?id=eq.${changeId}&select=*`, { headers: svcHeaders });
    const logs = await lr.json();
    if (!lr.ok || !logs?.[0]) return res.status(404).json({ error: 'Change log entry not found' });
    const log = logs[0];
    if (log.reverted_at) return res.status(409).json({ error: 'Change already reverted', reverted_at: log.reverted_at });
    if (!ALLOWED_TABLES.has(log.table_name)) return res.status(400).json({ error: `Reverting ${log.table_name} not supported` });

    let opResult;

    if (log.action === 'update') {
      if (!log.before_data) return res.status(400).json({ error: 'No before_data on update log entry' });
      const patch = stripImmutable(log.before_data);
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${log.table_name}?id=eq.${encodeURIComponent(log.record_id)}`, {
        method: 'PATCH',
        headers: { ...svcHeaders, Prefer: 'return=representation' },
        body: JSON.stringify(patch),
      });
      opResult = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: 'Revert update failed', details: opResult });
    } else if (log.action === 'insert') {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${log.table_name}?id=eq.${encodeURIComponent(log.record_id)}`, {
        method: 'DELETE',
        headers: svcHeaders,
      });
      if (!r.ok) {
        const details = await r.text();
        return res.status(r.status).json({ error: 'Revert insert failed', details });
      }
      opResult = { deleted: true };
    } else if (log.action === 'delete') {
      if (!log.before_data) return res.status(400).json({ error: 'No before_data on delete log entry' });
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${log.table_name}`, {
        method: 'POST',
        headers: { ...svcHeaders, Prefer: 'return=representation' },
        body: JSON.stringify(log.before_data),
      });
      opResult = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: 'Revert delete failed', details: opResult });
    } else {
      return res.status(400).json({ error: `Unknown action: ${log.action}` });
    }

    // 2. Stamp the log entry so it can't be re-reverted
    await fetch(`${SUPABASE_URL}/rest/v1/rr_change_log?id=eq.${changeId}`, {
      method: 'PATCH',
      headers: svcHeaders,
      body: JSON.stringify({ reverted_at: new Date().toISOString(), reverted_by: adminId }),
    });

    return res.status(200).json({ ok: true, action: log.action, result: opResult });
  } catch (e) {
    console.error('revert-change crashed', e);
    return res.status(500).json({ error: String(e) });
  }
};
