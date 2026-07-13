const db = require('../db');

// Les identifiants YouTube (UCxxxx) sont sensibles a la casse, contrairement
// aux logins Twitch/TikTok : ne pas les passer en minuscules.
function add(guildId, platform, username, displayName = null, platformChannelId = null, oauthTokens = null) {
  const normalized = platform === 'youtube' ? username : username.toLowerCase();
  const stmt = db.prepare(`
    INSERT INTO streamers (guild_id, platform, username, display_name, platform_channel_id, oauth_access_token, oauth_refresh_token, oauth_token_expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(guild_id, platform, username) DO UPDATE SET
      display_name = excluded.display_name,
      platform_channel_id = COALESCE(excluded.platform_channel_id, streamers.platform_channel_id),
      oauth_access_token = COALESCE(excluded.oauth_access_token, streamers.oauth_access_token),
      oauth_refresh_token = COALESCE(excluded.oauth_refresh_token, streamers.oauth_refresh_token),
      oauth_token_expires_at = COALESCE(excluded.oauth_token_expires_at, streamers.oauth_token_expires_at)
  `);
  return stmt.run(
    guildId,
    platform,
    normalized,
    displayName,
    platformChannelId,
    oauthTokens?.accessToken || null,
    oauthTokens?.refreshToken || null,
    oauthTokens?.expiresAt || null
  );
}

function remove(guildId, platform, username) {
  return db
    .prepare('DELETE FROM streamers WHERE guild_id = ? AND platform = ? AND username = ?')
    .run(guildId, platform, username.toLowerCase());
}

function removeById(id, guildId) {
  return db.prepare('DELETE FROM streamers WHERE id = ? AND guild_id = ?').run(id, guildId);
}

function getById(id) {
  return db.prepare('SELECT * FROM streamers WHERE id = ?').get(id);
}

function listByGuild(guildId) {
  return db.prepare('SELECT * FROM streamers WHERE guild_id = ? ORDER BY platform, username').all(guildId);
}

function listByPlatform(platform) {
  return db.prepare('SELECT * FROM streamers WHERE platform = ?').all(platform);
}

function setLiveState(id, isLive, streamKey, platformChannelId = undefined) {
  if (platformChannelId !== undefined) {
    db.prepare(
      'UPDATE streamers SET is_live = ?, last_stream_key = ?, platform_channel_id = ?, last_checked_at = datetime(\'now\') WHERE id = ?'
    ).run(isLive ? 1 : 0, streamKey, platformChannelId, id);
  } else {
    db.prepare(
      'UPDATE streamers SET is_live = ?, last_stream_key = ?, last_checked_at = datetime(\'now\') WHERE id = ?'
    ).run(isLive ? 1 : 0, streamKey, id);
  }
}

function updateOAuthTokens(id, { accessToken, refreshToken, expiresAt }) {
  db.prepare(
    'UPDATE streamers SET oauth_access_token = ?, oauth_refresh_token = ?, oauth_token_expires_at = ? WHERE id = ?'
  ).run(accessToken, refreshToken, expiresAt, id);
}

// Marque le dernier clip/video vu, independamment de l'etat live (last_stream_key).
function setContentState(id, contentId) {
  db.prepare('UPDATE streamers SET last_content_id = ?, last_checked_at = datetime(\'now\') WHERE id = ?').run(
    contentId,
    id
  );
}

function setPlatformChannelId(id, platformChannelId) {
  db.prepare('UPDATE streamers SET platform_channel_id = ? WHERE id = ?').run(platformChannelId, id);
}

module.exports = {
  add,
  remove,
  removeById,
  getById,
  listByGuild,
  listByPlatform,
  setLiveState,
  updateOAuthTokens,
  setContentState,
  setPlatformChannelId,
};
