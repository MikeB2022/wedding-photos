const https = require('https');

function googleToken(params) {
  const body = new URLSearchParams(params).toString();
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

exports.handler = async (event) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };

  const body = JSON.parse(event.body || '{}');

  try {
    // Handle refresh token grant
    if (body.grant_type === 'refresh_token') {
      if (!body.refresh_token) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Missing refresh_token' }) };
      const r = await googleToken({
        refresh_token: body.refresh_token,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        grant_type: 'refresh_token'
      });
      if (r.error) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: r.error_description || r.error }) };
      return { statusCode: 200, headers: cors, body: JSON.stringify({ access_token: r.access_token, expires_in: r.expires_in }) };
    }

    // Handle authorization code grant
    if (!body.code) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Missing code' }) };
    const r = await googleToken({
      code: body.code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: body.redirect_uri,
      grant_type: 'authorization_code'
    });
    if (r.error) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: r.error_description || r.error }) };
    return { statusCode: 200, headers: cors, body: JSON.stringify({ access_token: r.access_token, refresh_token: r.refresh_token, expires_in: r.expires_in }) };

  } catch (err) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: err.message }) };
  }
};
