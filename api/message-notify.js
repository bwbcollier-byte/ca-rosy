// Vercel serverless function — sends an email notification to the recipient
// of a new chat message, throttled so a single sender bursting 10 messages
// only fires ONE email until the recipient comes back and reads them.
//
// Throttle logic:
//   - rr_conversations.notifications_sent_at is a jsonb map keyed by recipient
//     user_id → ISO timestamp of the last email we sent them for this thread.
//   - rr_conversations.seen_by is a jsonb map keyed by user_id → ISO timestamp
//     of when the user last viewed the conversation.
//   - We send an email IFF the recipient's last-viewed time is *after* the
//     last-notification time (they've read the previous batch and are
//     genuinely "away" again) OR no notification has been sent yet.
//
// POST body: { conversationId, senderId, recipientId }
// Auth: requires a signed-in Supabase JWT (sender's session token).

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vwweyepknzgruobadlwf.supabase.co';
const APP_URL = process.env.APP_URL || 'https://rosy-demo.vercel.app';
const FROM_DEFAULT = 'noreply@rosyrecruits.com';
const FROM_NAME = 'Rosy Recruits';

const DEMO_REDIRECT_TO = process.env.DEMO_REDIRECT_TO || 'ben@pronocoders.com';
const DEMO_REDIRECT_ON = String(process.env.DEMO_EMAIL_REDIRECT || '').toLowerCase() === 'true';

async function verifyAuth(req) {
  const auth = req.headers?.authorization || req.headers?.Authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: process.env.SUPABASE_ANON_KEY || token },
    });
    if (!r.ok) return null;
    const user = await r.json();
    return user?.id ? user : null;
  } catch (e) { return null; }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: 'Auth required' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Bad JSON' }); } }
  const { conversationId, senderId, recipientId } = body || {};
  if (!conversationId || !senderId || !recipientId) {
    return res.status(400).json({ error: 'conversationId, senderId, recipientId required' });
  }
  if (user.id !== senderId) {
    return res.status(403).json({ error: 'Sender must match auth user' });
  }

  const svc = process.env.SUPABASE_SERVICE_KEY;
  if (!svc) return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY missing' });

  // 1. Load conversation state + recipient profile.
  const headers = { apikey: svc, Authorization: `Bearer ${svc}` };
  const [convR, recipR, senderR] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/rr_conversations?id=eq.${conversationId}&select=id,subject,participants,seen_by,notifications_sent_at`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/rr_profiles?id=eq.${recipientId}&select=id,email,first_name`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/rr_profiles?id=eq.${senderId}&select=id,first_name,last_name,email`, { headers }),
  ]);
  const conv = (await convR.json())?.[0];
  const recipient = (await recipR.json())?.[0];
  const sender = (await senderR.json())?.[0];
  if (!conv || !recipient?.email) return res.status(200).json({ ok: true, skipped: 'recipient or conversation missing' });

  // 2. Throttle check.
  const sentAt = (conv.notifications_sent_at || {})[recipientId] || null;
  const seenAt = (conv.seen_by || {})[recipientId] || null;
  const now = new Date();
  if (sentAt) {
    const sentDate = new Date(sentAt);
    const sentSeen = seenAt ? new Date(seenAt) : null;
    // If we've already emailed for this batch AND the recipient hasn't yet
    // come back to read (seenAt <= sentAt), suppress this one.
    if (!sentSeen || sentSeen <= sentDate) {
      return res.status(200).json({ ok: true, skipped: 'throttled' });
    }
  }

  // 3. Mark the throttle BEFORE sending to avoid double-send races.
  const nextSent = { ...(conv.notifications_sent_at || {}), [recipientId]: now.toISOString() };
  await fetch(`${SUPABASE_URL}/rest/v1/rr_conversations?id=eq.${conversationId}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ notifications_sent_at: nextSent }),
  });

  // 4. Send the email.
  const senderName = `${sender?.first_name || ''} ${sender?.last_name || ''}`.trim() || 'Someone';
  const recipFirst = recipient.first_name || 'there';
  const inboxUrl = `${APP_URL}/#app/inbox`;
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a;">
    <h2 style="margin:0 0 14px;font-size:20px;">${senderName} sent you a message</h2>
    <p style="margin:0 0 14px;font-size:14px;color:#555;">Hi ${recipFirst}, you have new messages on Rosy Recruits.</p>
    <p style="margin:24px 0;">
      <a href="${inboxUrl}" style="background:#F47C5D;color:#fff;text-decoration:none;padding:12px 22px;border-radius:9999px;font-weight:600;">Open inbox</a>
    </p>
    <p style="margin:24px 0 0;font-size:12px;color:#888;">You'll only get one email per conversation until you check back. No spam.</p>
  </div>`;
  const postmarkToken = process.env.POSTMARK_SERVER_TOKEN;
  if (!postmarkToken) return res.status(200).json({ ok: true, skipped: 'postmark not configured' });
  const toAddr = DEMO_REDIRECT_ON ? DEMO_REDIRECT_TO : recipient.email;
  const subject = (DEMO_REDIRECT_ON ? `[DEMO → ${recipient.email}] ` : '') + `${senderName} messaged you on Rosy Recruits`;
  const pmBody = DEMO_REDIRECT_ON
    ? `<div style="background:#FFF4D6;border:1px solid #E0C97A;padding:10px 14px;border-radius:8px;margin:0 0 14px;font-family:sans-serif;font-size:12.5px;color:#7A5800;"><strong>DEMO MODE</strong> · originally addressed to <strong>${recipient.email}</strong></div>` + html
    : html;
  try {
    const pr = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Postmark-Server-Token': postmarkToken },
      body: JSON.stringify({
        From: `${FROM_NAME} <${FROM_DEFAULT}>`,
        To: toAddr,
        Subject: subject,
        HtmlBody: pmBody,
        MessageStream: 'outbound',
        Tag: 'message-notify',
        Metadata: { conversation_id: conversationId, recipient: recipient.email },
      }),
    });
    const data = await pr.json().catch(() => ({}));
    if (!pr.ok) {
      console.warn('Postmark error', pr.status, data);
      return res.status(200).json({ ok: false, postmark: data });
    }
    return res.status(200).json({ ok: true, sentTo: toAddr });
  } catch (e) {
    console.warn('message-notify send failed:', e);
    return res.status(200).json({ ok: false, error: String(e) });
  }
};
