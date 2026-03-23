const https = require('https');

function googleGet(path, access_token) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'photoslibrary.googleapis.com',
      path,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${access_token}` }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
    });
    req.on('error', reject);
    req.end();
  });
}

function googlePost(path, access_token, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const req = https.request({
      hostname: 'photoslibrary.googleapis.com',
      path,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const { access_token, action, album_title } = JSON.parse(event.body || '{}');

  if (!access_token) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Missing access token' }) };
  }

  try {
    if (action === 'list') {
      const data = await googleGet('/v1/albums?pageSize=50', access_token);
      return { statusCode: 200, headers, body: JSON.stringify({ albums: data.albums || [] }) };
    }

    if (action === 'create') {
      if (!album_title) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing album_title' }) };
      const data = await googlePost('/v1/albums', access_token, { album: { title: album_title } });
      return { statusCode: 200, headers, body: JSON.stringify({ album: data }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
