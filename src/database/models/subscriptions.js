const db = require('../db');

// Format identique a celui retourne par SQLite datetime('now') (UTC, sans 'T' ni ms)
// afin que les comparaisons textuelles expires_at <= datetime('now') restent correctes.
function expiresAtFromDays(days) {
  if (!days) return null;
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function add(guildId, userId, roleId, expiresAt = null) {
  db.prepare(`
    INSERT INTO subscriptions (guild_id, user_id, role_id, expires_at, active)
    VALUES (?, ?, ?, ?, 1)
    ON CONFLICT(guild_id, user_id, role_id)
    DO UPDATE SET expires_at = excluded.expires_at, active = 1, granted_at = datetime('now')
  `).run(guildId, userId, roleId, expiresAt);
}

function deactivate(guildId, userId, roleId) {
  db.prepare(
    'UPDATE subscriptions SET active = 0 WHERE guild_id = ? AND user_id = ? AND role_id = ?'
  ).run(guildId, userId, roleId);
}

function listByGuild(guildId) {
  return db
    .prepare('SELECT * FROM subscriptions WHERE guild_id = ? AND active = 1 ORDER BY expires_at IS NULL, expires_at')
    .all(guildId);
}

function listExpired() {
  return db
    .prepare("SELECT * FROM subscriptions WHERE active = 1 AND expires_at IS NOT NULL AND expires_at <= datetime('now')")
    .all();
}

module.exports = { add, deactivate, listByGuild, listExpired, expiresAtFromDays };
