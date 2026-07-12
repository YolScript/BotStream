const axios = require('axios');
const config = require('../config');

const REDIRECT_URI = `${config.web.publicUrl}/auth/google/callback`;
const SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';

function getAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'online',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeCode(code) {
  const res = await axios.post(
    'https://oauth2.googleapis.com/token',
    new URLSearchParams({
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return res.data.access_token;
}

async function fetchOwnChannel(accessToken) {
  const res = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
    params: { part: 'snippet', mine: true },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data.items && res.data.items[0];
}

module.exports = { getAuthorizeUrl, exchangeCode, fetchOwnChannel };
