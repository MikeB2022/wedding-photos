const https = require('https');

exports.handler = async (event) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
  const { code, redirect_uri } = JSON.parse(event.body || '{}');
  if (!code) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Missing code' }) };
  const body = new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri, grant_type: 'authorization_code' }).toString();
  return new Promise(resolve => {
    const req = https.request({ hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const r = JSON.parse(d);
          if (r.error) resolve({ statusCode: 400, headers: cors, body: JSON.stringify({ error: r.error_description || r.error }) });
          else resolve({ statusCode: 200, headers: cors, body: JSON.stringify({ access_token: r.access_token, refresh_token: r.refresh_token, expires_in: r.expires_in }) });
        } catch { resolve({ statusCode: 500, headers: cors, body: JSON.stringify({ error: 'Parse error' }) }); }
      });
    });
    req.on('error', e => resolve({ statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) }));
    req.write(body); req.end();
  });
};
