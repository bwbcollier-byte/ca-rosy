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

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
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
