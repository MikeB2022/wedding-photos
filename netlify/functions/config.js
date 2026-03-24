const https = require('https');

// Uses Netlify Blobs via their REST API - no npm package needed
function blobRequest(method, data) {
  const siteId = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_API_TOKEN;

  // Fall back to using Netlify's built-in context if env vars aren't set
  // Netlify injects these automatically in Functions v2
  if (!siteId || !token) {
    throw new Error('Netlify Blobs not configured. SITE_ID and NETLIFY_API_TOKEN must be set.');
  }

  const path = `/api/v1/blobs/${siteId}/wedding-config/config`;
  const body = data ? JSON.stringify(data) : undefined;

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.netlify.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {})
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: d ? JSON.parse(d) : {} }); }
        catch { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };

  try {
    if (event.httpMethod === 'GET') {
      const res = await blobRequest('GET');
      if (res.status === 404) return { statusCode: 200, headers: cors, body: JSON.stringify({ config: {} }) };
      return { statusCode: 200, headers: cors, body: JSON.stringify({ config: res.data || {} }) };
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      // Never store tokens server-side
      ['accessToken', 'refreshToken', 'tokenExpiry', 'clientSecret'].forEach(k => delete body[k]);
      await blobRequest('PUT', body);
      return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: err.message }) };
  }
};