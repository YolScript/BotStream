const db = require('../db');

const VALID_RULE_TYPES = new Set(['follow', 'sub_tier1', 'sub_tier2', 'sub_tier3', 'yt_subscriber', 'yt_member']);

function set(streamerId, ruleType, roleId) {
  if (!VALID_RULE_TYPES.has(ruleType)) throw new Error(`Type de regle invalide: ${ruleType}`);
  if (!roleId) {
    db.prepare('DELETE FROM role_rules WHERE streamer_id = ? AND rule_type = ?').run(streamerId, ruleType);
    return;
  }
  db.prepare(`
    INSERT INTO role_rules (streamer_id, rule_type, role_id)
    VALUES (?, ?, ?)
    ON CONFLICT(streamer_id, rule_type) DO UPDATE SET role_id = excluded.role_id
  `).run(streamerId, ruleType, roleId);
}

function listByStreamer(streamerId) {
  return db.prepare('SELECT * FROM role_rules WHERE streamer_id = ?').all(streamerId);
}

function listByStreamerIds(streamerIds) {
  if (streamerIds.length === 0) return [];
  const placeholders = streamerIds.map(() => '?').join(',');
  return db.prepare(`SELECT * FROM role_rules WHERE streamer_id IN (${placeholders})`).all(...streamerIds);
}

module.exports = { set, listByStreamer, listByStreamerIds };
