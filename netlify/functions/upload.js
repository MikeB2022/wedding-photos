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

async function findOrCreateFolder(access_token, folderName) {
  const query = encodeURIComponent(`name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const searchRes = await driveRequest({
    hostname: 'www.googleapis.com',
    path: `/drive/v3/files?q=${query}&fields=files(id,name)`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${access_token}` }
  });
  if (searchRes.data.files && searchRes.data.files.length > 0) return searchRes.data.files[0].id;

  const meta = JSON.stringify({ name: folderName, mimeType: 'application/vnd.google-apps.folder' });
  const createRes = await driveRequest({
    hostname: 'www.googleapis.com',
    path: '/drive/v3/files?fields=id,name',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(meta) }
  }, meta);
  return createRes.data.id;
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const { access_token, folder_name, filename, mimetype, data: base64data, guest_name, table } = JSON.parse(event.body || '{}');
    if (!access_token || !base64data) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };

    const folderId = await findOrCreateFolder(access_token, folder_name || 'Wedding Photos');
    const safeFilename = filename || 'wedding-photo.jpg';
    const safeMime = mimetype || 'image/jpeg';
    const description = [guest_name ? `From: ${guest_name}` : 'Wedding guest', table ? `Table ${table}` : ''].filter(Boolean).join(' · ');

    const metadata = JSON.stringify({ name: safeFilename, description, parents: [folderId] });
    const boundary = 'wedding_boundary_x1';
    const body = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      metadata,
      `--${boundary}`,
      `Content-Type: ${safeMime}`,
      'Content-Transfer-Encoding: base64',
      '',
      base64data,
      `--${boundary}--`
    ].join('\r\n');

    const bodyBuffer = Buffer.from(body);
    const uploadRes = await driveRequest({
      hostname: 'www.googleapis.com',
      path: '/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': bodyBuffer.length
      }
    }, bodyBuffer);

    if (uploadRes.status !== 200) return { statusCode: uploadRes.status, headers, body: JSON.stringify({ error: 'Upload failed', detail: uploadRes.data }) };
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, file: uploadRes.data }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
