const { getStore } = require('@netlify/blobs');

const STORE = 'wedding-config';
const KEY = 'config';

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };

  const store = getStore({ name: STORE, consistency: 'strong' });

  try {
    if (event.httpMethod === 'GET') {
      const data = await store.get(KEY, { type: 'json' });
      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify({ config: data || {} })
      };
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      // Never store tokens in Blobs — those stay in localStorage only
      const safe = { ...body };
      delete safe.accessToken;
      delete safe.refreshToken;
      delete safe.tokenExpiry;
      delete safe.clientSecret;

      await store.setJSON(KEY, safe);
      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify({ ok: true })
      };
    }

    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: err.message })
    };
  }
};
