const db = require('../db');

function upsert(discordUserId, platform, { platformUserId, platformUsername, accessToken, refreshToken, expiresAt }) {
  db.prepare(`
    INSERT INTO platform_links (discord_user_id, platform, platform_user_id, platform_username, access_token, refresh_token, token_expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(discord_user_id, platform) DO UPDATE SET
      platform_user_id = excluded.platform_user_id,
      platform_username = excluded.platform_username,
      access_token = COALESCE(excluded.access_token, platform_links.access_token),
      refresh_token = COALESCE(excluded.refresh_token, platform_links.refresh_token),
      token_expires_at = COALESCE(excluded.token_expires_at, platform_links.token_expires_at),
      linked_at = datetime('now')
  `).run(
    discordUserId,
    platform,
    platformUserId,
    platformUsername || null,
    accessToken || null,
    refreshToken || null,
    expiresAt || null
  );
}

function get(discordUserId, platform) {
  return db.prepare('SELECT * FROM platform_links WHERE discord_user_id = ? AND platform = ?').get(discordUserId, platform);
}

function listByPlatform(platform) {
  return db.prepare('SELECT * FROM platform_links WHERE platform = ?').all(platform);
}

function updateTokens(discordUserId, platform, { accessToken, refreshToken, expiresAt }) {
  db.prepare(
    'UPDATE platform_links SET access_token = ?, refresh_token = ?, token_expires_at = ? WHERE discord_user_id = ? AND platform = ?'
  ).run(accessToken, refreshToken, expiresAt, discordUserId, platform);
}

module.exports = { upsert, get, listByPlatform, updateTokens };
