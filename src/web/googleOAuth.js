const axios = require('axios');
const config = require('../config');
const { sqliteDatetimeInSeconds } = require('../services/timeUtil');

const REDIRECT_URI = `${config.web.publicUrl}/auth/google/callback`;
const READONLY_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';
// Scope necessaire pour qu'un streamer autorise BotStream a lister ses membres payants (paliers).
const MEMBERSHIP_SCOPE = 'https://www.googleapis.com/auth/youtube.channel-memberships.creator';

function getAuthorizeUrl(state, { scope = READONLY_SCOPE, accessType = 'online' } = {}) {
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope,
    access_type: accessType,
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function tokensFromResponse(data, fallbackRefreshToken = null) {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || fallbackRefreshToken,
    expiresAt: sqliteDatetimeInSeconds(data.expires_in),
  };
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
  return tokensFromResponse(res.data);
}

// Google ne renvoie pas toujours un nouveau refresh_token au refresh : on garde l'ancien.
async function refreshAccessToken(refreshToken) {
  const res = await axios.post(
    'https://oauth2.googleapis.com/token',
    new URLSearchParams({
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return tokensFromResponse(res.data, refreshToken);
}

async function fetchOwnChannel(accessToken) {
  const res = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
    params: { part: 'snippet', mine: true },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data.items && res.data.items[0];
}

// Utilise le token du MEMBRE (pas du streamer) pour verifier son propre abonnement gratuit.
async function isSubscribedToChannel(memberAccessToken, channelId) {
  const res = await axios.get('https://www.googleapis.com/youtube/v3/subscriptions', {
    params: { part: 'id', mine: true, forChannelId: channelId },
    headers: { Authorization: `Bearer ${memberAccessToken}` },
  });
  return (res.data.items || []).length > 0;
}

// Utilise le token du STREAMER (scope membership) pour lister tous ses membres payants actuels.
async function listChannelMembers(streamerAccessToken) {
  const members = [];
  let pageToken;
  do {
    const res = await axios.get('https://www.googleapis.com/youtube/v3/members', {
      params: { part: 'snippet', mode: 'all_current', maxResults: 1000, pageToken },
      headers: { Authorization: `Bearer ${streamerAccessToken}` },
    });
    members.push(...(res.data.items || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return members;
}

module.exports = {
  getAuthorizeUrl,
  exchangeCode,
  refreshAccessToken,
  fetchOwnChannel,
  isSubscribedToChannel,
  listChannelMembers,
  READONLY_SCOPE,
  MEMBERSHIP_SCOPE,
};
