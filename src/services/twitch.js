const axios = require('axios');
const config = require('../config');
const { repeatedKeysSerializer } = require('./httpParams');

let cachedToken = null;
let cachedTokenExpiry = 0;

async function getAppAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiry - 30000) return cachedToken;

  const res = await axios.post('https://id.twitch.tv/oauth2/token', null, {
    params: {
      client_id: config.twitch.clientId,
      client_secret: config.twitch.clientSecret,
      grant_type: 'client_credentials',
    },
  });

  cachedToken = res.data.access_token;
  cachedTokenExpiry = Date.now() + res.data.expires_in * 1000;
  return cachedToken;
}

async function helixGet(endpoint, params) {
  const token = await getAppAccessToken();
  const res = await axios.get(`https://api.twitch.tv/helix/${endpoint}`, {
    headers: {
      'Client-Id': config.twitch.clientId,
      Authorization: `Bearer ${token}`,
    },
    params,
    paramsSerializer: repeatedKeysSerializer,
  });
  return res.data.data;
}

// logins: tableau de user logins (max 100 par appel Helix)
async function getUsersByLogin(logins) {
  if (logins.length === 0) return [];
  return helixGet('users', { login: logins });
}

// logins: tableau de user logins (max 100 par appel Helix)
async function getStreamsByLogins(logins) {
  if (logins.length === 0) return [];
  return helixGet('streams', { user_login: logins });
}

// Retourne les clips crees depuis `startedAt` (ISO 8601) sur la chaine, du plus recent au plus ancien.
async function getClips(broadcasterId, startedAt) {
  return helixGet('clips', { broadcaster_id: broadcasterId, started_at: startedAt, first: 20 });
}

// Necessite le token du STREAMER (scope moderator:read:followers, broadcaster_id = son propre ID).
async function isFollowing(streamerAccessToken, broadcasterId, userId) {
  const res = await axios.get('https://api.twitch.tv/helix/channels/followers', {
    headers: { 'Client-Id': config.twitch.clientId, Authorization: `Bearer ${streamerAccessToken}` },
    params: { broadcaster_id: broadcasterId, user_id: userId },
  });
  return res.data.data.length > 0;
}

// Necessite le token du STREAMER (scope channel:read:subscriptions, broadcaster_id = son propre ID).
// Retourne le tier (1, 2 ou 3) ou null si non abonne.
async function getSubscriptionTier(streamerAccessToken, broadcasterId, userId) {
  try {
    const res = await axios.get('https://api.twitch.tv/helix/subscriptions', {
      headers: { 'Client-Id': config.twitch.clientId, Authorization: `Bearer ${streamerAccessToken}` },
      params: { broadcaster_id: broadcasterId, user_id: userId },
    });
    const sub = res.data.data[0];
    if (!sub) return null;
    return Math.round(parseInt(sub.tier, 10) / 1000);
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

module.exports = { getAppAccessToken, getUsersByLogin, getStreamsByLogins, isFollowing, getSubscriptionTier };
