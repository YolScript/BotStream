const axios = require('axios');
const config = require('../config');

const SCOPES = 'identify guilds';
const REDIRECT_URI = `${config.web.publicUrl}/auth/discord/callback`;

function getAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: config.discord.clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    state,
  });
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

async function exchangeCode(code) {
  const res = await axios.post(
    'https://discord.com/api/oauth2/token',
    new URLSearchParams({
      client_id: config.discord.clientId,
      client_secret: config.discord.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return res.data.access_token;
}

async function fetchUser(accessToken) {
  const res = await axios.get('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

const MANAGE_GUILD = 0x20n;
const ADMINISTRATOR = 0x8n;

async function fetchManageableGuildIds(accessToken) {
  const res = await axios.get('https://discord.com/api/users/@me/guilds', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return res.data
    .filter((g) => g.owner || (BigInt(g.permissions) & (MANAGE_GUILD | ADMINISTRATOR)) !== 0n)
    .map((g) => ({ id: g.id, name: g.name, icon: g.icon }));
}

module.exports = { getAuthorizeUrl, exchangeCode, fetchUser, fetchManageableGuildIds };
