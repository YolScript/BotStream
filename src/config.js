require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.warn(`[config] Variable d'environnement manquante: ${name}`);
  }
  return value;
}

module.exports = {
  discord: {
    token: required('DISCORD_TOKEN'),
    clientId: required('DISCORD_CLIENT_ID'),
    clientSecret: required('DISCORD_CLIENT_SECRET'),
    // View Channel + Send Messages + Embed Links + Read Message History + Manage Roles
    invitePermissions: '268520448',
  },
  twitch: {
    clientId: process.env.TWITCH_CLIENT_ID,
    clientSecret: process.env.TWITCH_CLIENT_SECRET,
  },
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY,
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  },
  web: {
    publicUrl: process.env.PUBLIC_URL || 'http://localhost:3000',
    port: parseInt(process.env.PORT, 10) || 3000,
    sessionSecret: process.env.SESSION_SECRET || 'insecure-dev-secret',
    superAdminId: process.env.SUPER_ADMIN_DISCORD_ID || null,
  },
  polling: {
    twitchMs: parseInt(process.env.TWITCH_POLL_INTERVAL_MS, 10) || 60000,
    youtubeMs: parseInt(process.env.YOUTUBE_POLL_INTERVAL_MS, 10) || 90000,
    tiktokMs: parseInt(process.env.TIKTOK_POLL_INTERVAL_MS, 10) || 90000,
    subscriptionCheckMs: parseInt(process.env.SUBSCRIPTION_CHECK_INTERVAL_MS, 10) || 300000,
    roleSyncMs: parseInt(process.env.ROLE_SYNC_INTERVAL_MS, 10) || 600000,
  },
};
