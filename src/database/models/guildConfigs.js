const db = require('../db');

function ensure(guildId) {
  db.prepare('INSERT OR IGNORE INTO guild_configs (guild_id) VALUES (?)').run(guildId);
}

function get(guildId) {
  ensure(guildId);
  return db.prepare('SELECT * FROM guild_configs WHERE guild_id = ?').get(guildId);
}

const VALID_PLATFORMS = new Set(['twitch', 'youtube', 'tiktok']);

function setChannel(guildId, platform, channelId) {
  if (!VALID_PLATFORMS.has(platform)) throw new Error(`Plateforme invalide: ${platform}`);
  ensure(guildId);
  const column = `${platform}_channel_id`;
  db.prepare(`UPDATE guild_configs SET ${column} = ? WHERE guild_id = ?`).run(channelId, guildId);
}

function setPingRole(guildId, roleId) {
  ensure(guildId);
  db.prepare('UPDATE guild_configs SET ping_role_id = ? WHERE guild_id = ?').run(roleId, guildId);
}

module.exports = { get, setChannel, setPingRole };
