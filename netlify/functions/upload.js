const https = require('https');

function googleRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks);
        const text = raw.toString();
        try { resolve({ status: res.statusCode, data: JSON.parse(text) }); }
        catch { resolve({ status: res.statusCode, data: text }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
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

  try {
    const { access_token, album_id, filename, mimetype, data: base64data, guest_name, table } = JSON.parse(event.body || '{}');

    if (!access_token || !base64data) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    // Step 1: Upload raw bytes to get an upload token
    const imageBuffer = Buffer.from(base64data, 'base64');
    const uploadRes = await googleRequest({
      hostname: 'photoslibrary.googleapis.com',
      path: '/v1/uploads',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/octet-stream',
        'Content-Length': imageBuffer.length,
        'X-Goog-Upload-Protocol': 'raw',
        'X-Goog-Upload-File-Name': filename || 'wedding-photo.jpg'
      }
    }, imageBuffer);

    const uploadToken = typeof uploadRes.data === 'string' ? uploadRes.data : uploadRes.data?.uploadToken;

    if (!uploadToken) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to get upload token', detail: uploadRes.data }) };
    }

    // Step 2: Create media item in the album
    const description = [
      guest_name ? `From: ${guest_name}` : 'Wedding guest',
      table ? `Table ${table}` : ''
    ].filter(Boolean).join(' · ');

    const createBody = {
      newMediaItems: [{
        description,
        simpleMediaItem: { uploadToken, fileName: filename || 'wedding-photo.jpg' }
      }]
    };

    if (album_id) createBody.albumId = album_id;

    const bodyStr = JSON.stringify(createBody);
    const createRes = await googleRequest({
      hostname: 'photoslibrary.googleapis.com',
      path: '/v1/mediaItems:batchCreate',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    }, bodyStr);

    if (createRes.status !== 200) {
      return { statusCode: createRes.status, headers, body: JSON.stringify({ error: 'Failed to create media item', detail: createRes.data }) };
    }

    const item = createRes.data?.newMediaItemResults?.[0];
    if (item?.status?.message && item.status.message !== 'Success') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: item.status.message }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, mediaItem: item?.mediaItem })
    };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
