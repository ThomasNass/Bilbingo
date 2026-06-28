export default async function handler(req, res) {
  // Allow any origin (adjust if you want to restrict)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const GAS_URL = process.env.GAS_URL || 'https://script.google.com/macros/s/AKfycbw43i0MOHgQLfcShdq5HjbQauz6HJ2FOhmpMuLjfHoTnfE22gwm-092lWdVH92Zufg1cw/exec';

  try {
    const init = {
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
      },
      body: req.method === 'POST' ? JSON.stringify(req.body) : undefined,
    };

    const upstreamRes = await fetch(GAS_URL, init);
    const text = await upstreamRes.text();

    // Mirror status and content-type
    res.status(upstreamRes.status);
    const contentType = upstreamRes.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    return res.send(text);
  } catch (err) {
    return res.status(502).json({ success: false, error: err.message });
  }
}
