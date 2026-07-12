const axios = require('axios');
const config = require('../config');

const REDIRECT_URI = `${config.web.publicUrl}/auth/twitch/callback`;

function getAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: config.twitch.clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: '',
    state,
  });
  return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
}

async function exchangeCode(code) {
  const res = await axios.post(
    'https://id.twitch.tv/oauth2/token',
    new URLSearchParams({
      client_id: config.twitch.clientId,
      client_secret: config.twitch.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return res.data.access_token;
}

async function fetchOwnUser(accessToken) {
  const res = await axios.get('https://api.twitch.tv/helix/users', {
    headers: {
      'Client-Id': config.twitch.clientId,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.data.data[0];
}

module.exports = { getAuthorizeUrl, exchangeCode, fetchOwnUser };
