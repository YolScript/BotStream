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

module.exports = { getAppAccessToken, getUsersByLogin, getStreamsByLogins };
