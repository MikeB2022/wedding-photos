exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  // This endpoint just confirms the refresh token is stored
  // The actual token is saved via Netlify environment variables by the admin
  const stored = !!process.env.GOOGLE_REFRESH_TOKEN;
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ configured: stored })
  };
};
