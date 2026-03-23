const https = require('https');

function driveGet(path, token) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: 'www.googleapis.com', path, method: 'GET', headers: { Authorization: `Bearer ${token}` } }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    });
    req.on('error', reject); req.end();
  });
}

function drivePost(path, token, body) {
  const b = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: 'www.googleapis.com', path, method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) } }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    });
    req.on('error', reject); req.write(b); req.end();
  });
}

async function getAccessToken(refresh_token) {
  const rt = refresh_token || process.env.GOOGLE_REFRESH_TOKEN;
  const body = `refresh_token=${encodeURIComponent(rt)}&client_id=${encodeURIComponent(process.env.GOOGLE_CLIENT_ID)}&client_secret=${encodeURIComponent(process.env.GOOGLE_CLIENT_SECRET)}&grant_type=refresh_token`;
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    });
    req.on('error', reject); req.write(body); req.end();
  });
}

exports.handler = async (event) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };

  const { action, access_token, refresh_token, folder_title, folder_id } = JSON.parse(event.body || '{}');
  const token = access_token || (await getAccessToken(refresh_token)).access_token;
  if (!token) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'No access token' }) };

  try {
    if (action === 'list_folders') {
      const q = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and trashed=false`);
      const r = await driveGet(`/drive/v3/files?q=${q}&fields=files(id%2Cname)&orderBy=name&pageSize=50`, token);
      return { statusCode: 200, headers: cors, body: JSON.stringify({ folders: r.files || [] }) };
    }

    if (action === 'create_folder') {
      if (!folder_title) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Missing folder_title' }) };
      const r = await drivePost('/drive/v3/files?fields=id,name', token, { name: folder_title, mimeType: 'application/vnd.google-apps.folder' });
      if (!r.id) return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'Failed to create folder', detail: r }) };
      return { statusCode: 200, headers: cors, body: JSON.stringify({ folder: { id: r.id, name: r.name } }) };
    }

    if (action === 'list_photos') {
      if (!folder_id) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Missing folder_id' }) };
      const q = encodeURIComponent(`'${folder_id}' in parents and trashed=false and (mimeType contains 'image/' or mimeType contains 'video/')`);
      const fields = 'files(id%2Cname%2Cdescription%2CthumbnailLink%2CwebViewLink%2CmimeType%2CcreatedTime)';
      const r = await driveGet(`/drive/v3/files?q=${q}&fields=${fields}&orderBy=createdTime+desc&pageSize=100`, token);
      return { statusCode: 200, headers: cors, body: JSON.stringify({ photos: r.files || [] }) };
    }

    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Unknown action' }) };
  } catch (err) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: err.message }) };
  }
};
