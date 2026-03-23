const https = require('https');

function driveRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, data: raw }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const { access_token, action, folder_title } = JSON.parse(event.body || '{}');
  if (!access_token) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Missing access token' }) };

  try {
    if (action === 'list') {
      const query = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and trashed=false`);
      const res = await driveRequest({
        hostname: 'www.googleapis.com',
        path: `/drive/v3/files?q=${query}&fields=files(id,name)&orderBy=createdTime desc&pageSize=20`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${access_token}` }
      });
      const folders = (res.data.files || []).map(f => ({ id: f.id, title: f.name }));
      return { statusCode: 200, headers, body: JSON.stringify({ albums: folders }) };
    }

    if (action === 'create') {
      if (!folder_title) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing folder_title' }) };
      const meta = JSON.stringify({ name: folder_title, mimeType: 'application/vnd.google-apps.folder' });
      const res = await driveRequest({
        hostname: 'www.googleapis.com',
        path: '/drive/v3/files?fields=id,name',
        method: 'POST',
        headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(meta) }
      }, meta);
      if (!res.data.id) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to create folder', detail: res.data }) };
      return { statusCode: 200, headers, body: JSON.stringify({ album: { id: res.data.id, title: res.data.name } }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
