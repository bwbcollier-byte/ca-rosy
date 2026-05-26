// Vercel serverless function — generates draft form content via Gemini 2.5 Flash.
// Reads GEMINI_API_KEY from Vercel env so the key never ships to the browser.
// Replaces the in-browser window.claude.complete fallback (which only exists
// inside the Claude chat sandbox, not in production deploys).

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

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

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  }
  body = body || {};
  const { prompt } = body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt (string) required' });
  }

  try {
    const r = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.55,
          // Force JSON output so the client doesn't have to regex-extract.
          responseMimeType: 'application/json',
          // 1024 was getting truncated mid-string, breaking JSON parse and
          // forcing the client into the raw-text fallback path (showed broken
          // JSON in the desc field). 2048 leaves plenty of headroom for a
          // 4-sentence description + name + imageKey.
          maxOutputTokens: 2048,
        },
      }),
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      console.warn('[ai-write] upstream error', r.status, errText.slice(0, 300));
      return res.status(502).json({ error: 'Upstream model error', status: r.status });
    }
    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.status(200).json({ text });
  } catch (e) {
    console.warn('[ai-write] failed:', e);
    return res.status(500).json({ error: 'Generation failed' });
  }
};
