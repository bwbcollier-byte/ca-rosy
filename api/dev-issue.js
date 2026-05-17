// Vercel serverless function — proxies a dev-issue submission to the
// Airtable "Dev Issues" table in the RI Developer base.
// Reads AIRTABLE_API_KEY from Vercel env so the PAT never ships to the browser.

const AIRTABLE_BASE = 'app6biS7yjV6XzFVG';            // RI Developer
const AIRTABLE_TABLE = 'tblWTdcQhGVIGg5lC';           // Dev Issues

module.exports = async (req, res) => {
  // CORS preflight (browser may send if request becomes non-simple)
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

  const PAT = process.env.AIRTABLE_API_KEY;
  if (!PAT) {
    return res.status(500).json({ error: 'AIRTABLE_API_KEY not configured on the server.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: 'Invalid JSON' }); }
  }
  body = body || {};

  const {
    title, severity, description, screenshot,
    pageUrl, userAgent, viewport, reporter,
  } = body;

  if (!title || !description) {
    return res.status(400).json({ error: 'title and description are required' });
  }

  // Map severity → Airtable singleSelect choices (Low / Medium / High)
  const severityMap = { low: 'Low', medium: 'Medium', high: 'High' };
  const sev = severityMap[(severity || 'medium').toLowerCase()] || 'Medium';

  const fields = {
    Title: title.slice(0, 255),
    App: 'Rosy Recruits',
    Status: 'New',
    Severity: sev,
    Description: description,
    Reporter: reporter || 'anonymous',
  };
  if (pageUrl) fields['Page URL'] = pageUrl;
  if (userAgent) fields['User Agent'] = userAgent.slice(0, 255);
  if (viewport) fields['Viewport'] = viewport.slice(0, 64);
  if (screenshot && typeof screenshot === 'string' && screenshot.startsWith('data:image/')) {
    // Airtable accepts attachments via URL or via base64 data URL when posted directly.
    fields['Screenshot'] = [{ url: screenshot, filename: 'screenshot.png' }];
  }

  try {
    const r = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ records: [{ fields }], typecast: true }),
    });
    const data = await r.json();
    if (!r.ok) {
      console.warn('Airtable error', r.status, data);
      // Attachments via data URL sometimes fail (Airtable wants a public URL). Retry without screenshot.
      if (fields.Screenshot) {
        delete fields.Screenshot;
        const r2 = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ records: [{ fields }], typecast: true }),
        });
        const data2 = await r2.json();
        if (!r2.ok) return res.status(r2.status).json({ error: 'Airtable rejected the record', details: data2 });
        return res.status(200).json({ ok: true, id: data2.records?.[0]?.id, note: 'Screenshot dropped — Airtable needs a public URL.' });
      }
      return res.status(r.status).json({ error: 'Airtable rejected the record', details: data });
    }
    return res.status(200).json({ ok: true, id: data.records?.[0]?.id });
  } catch (e) {
    console.error('dev-issue handler crashed', e);
    return res.status(500).json({ error: String(e) });
  }
};
