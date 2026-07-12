const axios = require('axios');
const config = require('../config');
const { sqliteDatetimeInSeconds } = require('../services/timeUtil');

const REDIRECT_URI = `${config.web.publicUrl}/auth/twitch/callback`;

// Scope nécessaire pour qu'un streamer autorise BotStream à lire ses follows/abonnés.
const STREAMER_SCOPE = 'channel:read:subscriptions moderator:read:followers';

function getAuthorizeUrl(state, scope = '') {
  const params = new URLSearchParams({
    client_id: config.twitch.clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope,
    state,
  });
  return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
}

function tokensFromResponse(data) {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: sqliteDatetimeInSeconds(data.expires_in),
  };
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
  return tokensFromResponse(res.data);
}

async function refreshAccessToken(refreshToken) {
  const res = await axios.post(
    'https://id.twitch.tv/oauth2/token',
    new URLSearchParams({
      client_id: config.twitch.clientId,
      client_secret: config.twitch.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return tokensFromResponse(res.data);
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

module.exports = { getAuthorizeUrl, exchangeCode, refreshAccessToken, fetchOwnUser, STREAMER_SCOPE };
