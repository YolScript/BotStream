const db = require('../db');

function add(guildId, platform, username, displayName = null) {
  const stmt = db.prepare(`
    INSERT INTO streamers (guild_id, platform, username, display_name)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(guild_id, platform, username) DO NOTHING
  `);
  return stmt.run(guildId, platform, username.toLowerCase(), displayName);
}

function remove(guildId, platform, username) {
  return db
    .prepare('DELETE FROM streamers WHERE guild_id = ? AND platform = ? AND username = ?')
    .run(guildId, platform, username.toLowerCase());
}

function removeById(id, guildId) {
  return db.prepare('DELETE FROM streamers WHERE id = ? AND guild_id = ?').run(id, guildId);
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

module.exports = { add, remove, removeById, listByGuild, listByPlatform, setLiveState };
