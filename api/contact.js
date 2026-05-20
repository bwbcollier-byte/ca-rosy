// Vercel serverless function — receives marketing contact-form submissions
// and forwards them to the Rosy team's inbox via Postmark. No auth required.

const DEMO_REDIRECT_TO = 'ben@pronocoders.com';
const FROM_DEFAULT = 'noreply@rosyrecruits.com';
const FROM_NAME = 'Rosy Recruits';
const TOPIC_TO = {
  sales:   'sales@rosyrecruits.com',
  support: 'help@rosyrecruits.com',
  press:   'press@rosyrecruits.com',
  careers: 'jobs@rosyrecruits.com',
};

const ALLOWED_ORIGINS = new Set([
  'https://rosy-demo.vercel.app',
  'https://rosy.rascals-co.com',
  'http://localhost:8765',
  'http://localhost:3000',
]);

// Per-IP rate limit — 5 submissions per 10 min to deter abuse.
const RATE_BUCKET = new Map();
const RL_WINDOW_MS = 10 * 60 * 1000;
const RL_MAX = 5;
function hitRateLimit(ip) {
  const now = Date.now();
  const arr = (RATE_BUCKET.get(ip) || []).filter(t => now - t < RL_WINDOW_MS);
  arr.push(now);
  RATE_BUCKET.set(ip, arr);
  return arr.length > RL_MAX;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
  if (hitRateLimit(ip)) return res.status(429).json({ error: 'Too many requests. Please try again shortly.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: 'Invalid JSON' }); } }
  body = body || {};
  const name  = (body.name  || '').trim().slice(0, 200);
  const email = (body.email || '').trim().toLowerCase().slice(0, 200);
  const topic = (body.topic || 'sales').toLowerCase();
  const text  = (body.body  || '').trim().slice(0, 5000);

  if (!name || !email || !text) return res.status(400).json({ error: 'name, email, body required' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Invalid email' });

  const postmark = process.env.POSTMARK_SERVER_TOKEN;
  if (!postmark) return res.status(500).json({ error: 'Server not configured' });

  const realTo = TOPIC_TO[topic] || TOPIC_TO.sales;
  const isDemo = true;
  const to = isDemo ? DEMO_REDIRECT_TO : realTo;
  const subject = isDemo ? `[DEMO → ${realTo}] Contact form: ${topic} from ${name}` : `Contact form: ${topic} from ${name}`;
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#FBF7F1;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1F1B16;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="padding:32px 16px;"><tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background:#FFFFFF;border-radius:18px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
        <tr><td style="padding:24px 28px 12px;">
          ${isDemo ? `<div style="background:#FFF4D6;border:1px solid #E0C97A;padding:10px 14px;border-radius:8px;margin-bottom:14px;font-size:12.5px;color:#7A5800;"><strong>DEMO MODE</strong> · originally addressed to <strong>${escapeHtml(realTo)}</strong></div>` : ''}
          <div style="font-family:Georgia,serif;font-size:22px;font-weight:500;color:#1F1B16;">New contact-form message</div>
        </td></tr>
        <tr><td style="padding:8px 28px 4px;">
          <table cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.55;">
            <tr><td style="padding:4px 14px 4px 0;color:#6E665D;">From</td><td>${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</td></tr>
            <tr><td style="padding:4px 14px 4px 0;color:#6E665D;">Topic</td><td>${escapeHtml(topic)}</td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:18px 28px 28px;">
          <div style="background:#FBF7F1;border-left:3px solid #F05A56;padding:14px 16px;border-radius:8px;font-size:14.5px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(text)}</div>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  try {
    const r = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Postmark-Server-Token': postmark },
      body: JSON.stringify({
        From: `${FROM_NAME} <${FROM_DEFAULT}>`,
        To: to,
        ReplyTo: `${name} <${email}>`,
        Subject: subject,
        HtmlBody: html,
        MessageStream: 'outbound',
        Tag: 'contact-form',
        Metadata: { topic, original_recipient: realTo },
      }),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      console.warn('Postmark error', r.status, data);
      return res.status(500).json({ error: 'Could not send' });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Network error' });
  }
};
