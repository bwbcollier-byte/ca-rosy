// Vercel serverless function — sends a password-reset email via Postmark
// with Rosy Recruits branding, bypassing Supabase's default email.
//
// Flow:
//   1) Client POSTs { email } to /api/auth/password-reset (no auth needed).
//   2) Server calls Supabase admin generateLink (recovery) to mint a magic link.
//   3) Server sends a branded HTML email through Postmark with that link.
//   4) Returns 200 regardless of whether the email exists (anti-enumeration).
//
// DEMO SAFETY: like /api/send-email, every outbound is force-routed to the
// DEMO_REDIRECT_TO address until Rosy goes live, with the intended recipient
// surfaced in subject + body.

const DEMO_REDIRECT_TO = process.env.DEMO_REDIRECT_TO || 'ben@pronocoders.com';
const DEMO_REDIRECT_ON = String(process.env.DEMO_EMAIL_REDIRECT || '').toLowerCase() === 'true';
const FROM_DEFAULT = 'noreply@rosyrecruits.com';
const FROM_NAME = 'Rosy Recruits';
const APP_URL = 'https://rosy-demo.vercel.app';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://oerfmtjpwrefxuitsphl.supabase.co';

const ALLOWED_ORIGINS = new Set([
  'https://rosy-demo.vercel.app',
  'https://rosy.rascals-co.com',
  'http://localhost:8765',
  'http://localhost:3000',
]);

// Per-IP rate limit — 5 reset requests per 10 min.
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

function brandedHtml({ recoveryUrl, firstName, originalTo, isDemo }) {
  const banner = isDemo ? `<div style="background:#FFF4D6;border:1px solid #E0C97A;padding:10px 14px;border-radius:8px;margin-bottom:14px;font-family:sans-serif;font-size:12.5px;color:#7A5800;">
    <strong>DEMO MODE</strong> · originally addressed to <strong>${originalTo || '(no recipient)'}</strong>
  </div>` : '';
  const greeting = firstName ? `Hi ${firstName},` : 'Hello,';
  return `<!doctype html><html><body style="margin:0;padding:0;background:#FBF7F1;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1F1B16;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background:#FFFFFF;border-radius:18px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
          <tr><td style="padding:28px 32px 8px;">
            ${banner}
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;letter-spacing:-0.02em;font-weight:500;color:#1F1B16;">
              Rosy <span style="color:#F05A56;">Recruits</span>
            </div>
          </td></tr>
          <tr><td style="padding:16px 32px 8px;">
            <h1 style="margin:0;font-family:Georgia,serif;font-size:28px;letter-spacing:-0.02em;font-weight:500;line-height:1.2;">Reset your password</h1>
          </td></tr>
          <tr><td style="padding:14px 32px 8px;font-size:15px;line-height:1.55;color:#3F3933;">
            <p style="margin:0 0 14px;">${greeting}</p>
            <p style="margin:0 0 14px;">We got a request to reset your Rosy Recruits password. Tap the button below to set a new one. This link is good for 1 hour.</p>
          </td></tr>
          <tr><td style="padding:12px 32px 24px;">
            <a href="${recoveryUrl}" style="display:inline-block;background:#F05A56;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;padding:14px 26px;border-radius:12px;">Reset my password</a>
          </td></tr>
          <tr><td style="padding:0 32px 24px;font-size:13px;line-height:1.55;color:#6E665D;">
            <p style="margin:0 0 8px;">If the button doesn't work, paste this link into your browser:</p>
            <p style="margin:0 0 14px;word-break:break-all;color:#3F3933;"><a href="${recoveryUrl}" style="color:#1D5F66;">${recoveryUrl}</a></p>
            <p style="margin:0 0 6px;">Didn't request this? Ignore this email. Your password stays the same.</p>
          </td></tr>
          <tr><td style="padding:18px 32px 28px;border-top:1px solid #EEE7DC;font-size:12px;color:#9C948A;">
            Rosy Recruits · ${APP_URL.replace('https://', '')}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
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
  if (hitRateLimit(ip)) return res.status(429).json({ error: 'Too many requests. Try again later.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: 'Invalid JSON' }); } }
  body = body || {};
  const email = (body.email || '').trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const svc = process.env.SUPABASE_SERVICE_KEY;
  const postmark = process.env.POSTMARK_SERVER_TOKEN;
  if (!svc || !postmark) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  // 1) Look up the user (id + first name) — best-effort.
  let firstName = '';
  let userId = null;
  try {
    const pr = await fetch(`${SUPABASE_URL}/rest/v1/rr_profiles?email=eq.${encodeURIComponent(email)}&select=id,first_name`, {
      headers: { apikey: svc, Authorization: `Bearer ${svc}` },
    });
    const rows = await pr.json();
    userId    = rows?.[0]?.id || null;
    firstName = rows?.[0]?.first_name || '';
  } catch (e) {}
  // Don't leak whether the email exists. If we found nobody, return 200 but
  // still rate-limit (caller already passed our limiter).
  if (!userId) return res.status(200).json({ ok: true });

  // 2) Mint a one-time reset token. Stored server-side; emailed to user as a
  // query param so it survives Supabase's redirect-allowlist stripping. We
  // bypass Supabase's generate_link entirely because it silently drops any
  // `redirect_to` not whitelisted in the dashboard, leaving the user stranded
  // on the marketing page.
  const tokenBytes = require('crypto').randomBytes(32);
  const recoveryToken = tokenBytes.toString('base64url');
  const expires_at = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
  try {
    const ins = await fetch(`${SUPABASE_URL}/rest/v1/rr_password_reset_tokens`, {
      method: 'POST',
      headers: { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ token: recoveryToken, user_id: userId, expires_at }),
    });
    if (!ins.ok) {
      console.warn('[password-reset] token insert failed', ins.status);
      return res.status(200).json({ ok: true });
    }
  } catch (e) {
    console.warn('[password-reset] token mint failed:', e);
    return res.status(200).json({ ok: true });
  }
  const recoveryUrl = `${APP_URL}/?reset_token=${encodeURIComponent(recoveryToken)}`;

  // 3) Send the branded email via Postmark. Demo-redirect honors the
  // DEMO_EMAIL_REDIRECT env flag — when off, the real user gets the email.
  const isDemo = DEMO_REDIRECT_ON;
  const subject = isDemo ? `[DEMO → ${email}] Reset your Rosy Recruits password` : 'Reset your Rosy Recruits password';
  const html = brandedHtml({ recoveryUrl, firstName, originalTo: email, isDemo });
  try {
    await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Postmark-Server-Token': postmark },
      body: JSON.stringify({
        From: `${FROM_NAME} <${FROM_DEFAULT}>`,
        To: isDemo ? DEMO_REDIRECT_TO : email,
        Subject: subject,
        HtmlBody: html,
        MessageStream: 'outbound',
        Tag: 'password-reset',
        Metadata: { template: 'password-reset', original_recipient: email },
      }),
    });
  } catch (e) {
    // Still return 200 to avoid leaking email existence.
  }

  return res.status(200).json({ ok: true });
};
