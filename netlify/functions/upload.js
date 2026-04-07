const https = require('https');

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks);
        try { resolve({ status: res.statusCode, data: JSON.parse(raw.toString()) }); }
        catch { resolve({ status: res.statusCode, data: raw.toString() }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getAccessToken() {
  const rt = process.env.GOOGLE_REFRESH_TOKEN;
  const cid = process.env.GOOGLE_CLIENT_ID;
  const cs = process.env.GOOGLE_CLIENT_SECRET;
  if (!rt || !cid || !cs) throw new Error('Missing GOOGLE_REFRESH_TOKEN, GOOGLE_CLIENT_ID, or GOOGLE_CLIENT_SECRET in environment variables');
  const body = `refresh_token=${encodeURIComponent(rt)}&client_id=${encodeURIComponent(cid)}&client_secret=${encodeURIComponent(cs)}&grant_type=refresh_token`;
  const res = await request({
    hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
  }, body);
  if (!res.data.access_token) throw new Error('Token refresh failed: ' + JSON.stringify(res.data));
  return res.data.access_token;
}

async function findOrCreateFolder(token, name) {
  const q = encodeURIComponent(`name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const r = await request({ hostname: 'www.googleapis.com', path: `/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`, method: 'GET', headers: { Authorization: `Bearer ${token}` } });
  if (r.data.files && r.data.files.length > 0) return r.data.files[0].id;
  const meta = JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder' });
  const cr = await request({ hostname: 'www.googleapis.com', path: '/drive/v3/files?fields=id', method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(meta) } }, meta);
  return cr.data.id;
}

exports.handler = async (event) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };

  try {
    const body = JSON.parse(event.body || '{}');
    const { folder_id, folder_name, filename, mimetype, data: b64, guest_name, table, message } = body;

    if (!b64) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'No image data received' }) };

    const token = await getAccessToken();

    // Use folder_id if provided, otherwise find/create by name
    let folderId = folder_id;
    if (!folderId) folderId = await findOrCreateFolder(token, folder_name || 'Wedding Photos');

    const imgBuffer = Buffer.from(b64, 'base64');
    const safeName = filename || `photo-${Date.now()}.jpg`;
    const safeMime = mimetype || 'image/jpeg';
    const descParts = [];
    if (guest_name) descParts.push(`From: ${guest_name}`);
    if (table && table !== 'guest-book') descParts.push(`Table ${table}`);
    if (table === 'guest-book') descParts.push('Guest Book');
    if (message) descParts.push(`Message: ${message}`);
    const desc = descParts.join(' | ') || 'Wedding guest';

    const meta = JSON.stringify({ name: safeName, description: desc || 'Wedding guest', parents: [folderId] });
    const boundary = 'wphoto_bound';
    const CRLF = '\r\n';

    // Build multipart body properly - metadata as text, image as raw binary
    const metaPart = Buffer.from(
      `--${boundary}${CRLF}Content-Type: application/json; charset=UTF-8${CRLF}${CRLF}${meta}${CRLF}`
    );
    const imgHeader = Buffer.from(
      `--${boundary}${CRLF}Content-Type: ${safeMime}${CRLF}${CRLF}`
    );
    const imgFooter = Buffer.from(`${CRLF}--${boundary}--`);
    const multipart = Buffer.concat([metaPart, imgHeader, imgBuffer, imgFooter]);

    const up = await request({
      hostname: 'www.googleapis.com',
      path: '/upload/drive/v3/files?uploadType=multipart&fields=id,name,thumbnailLink,webViewLink,webContentLink',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': multipart.length
      }
    }, multipart);

    if (up.status !== 200) return { statusCode: up.status, headers: cors, body: JSON.stringify({ error: 'Drive upload failed', detail: up.data }) };

    // Make file publicly viewable so thumbnail works
    await request({
      hostname: 'www.googleapis.com',
      path: `/drive/v3/files/${up.data.id}/permissions`,
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength('{"role":"reader","type":"anyone"}') }
    }, '{"role":"reader","type":"anyone"}');

    return { statusCode: 200, headers: cors, body: JSON.stringify({ success: true, file: up.data }) };

  } catch (err) {
    console.error('Upload error:', err.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: err.message }) };
  }
};
