const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'botstream.sqlite'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS guild_configs (
    guild_id TEXT PRIMARY KEY,
    twitch_channel_id TEXT,
    youtube_channel_id TEXT,
    tiktok_channel_id TEXT,
    ping_role_id TEXT
  );

  CREATE TABLE IF NOT EXISTS streamers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    platform TEXT NOT NULL CHECK(platform IN ('twitch','youtube','tiktok')),
    username TEXT NOT NULL,
    display_name TEXT,
    platform_channel_id TEXT,
    is_live INTEGER NOT NULL DEFAULT 0,
    last_stream_key TEXT,
    last_checked_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(guild_id, platform, username)
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    granted_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    UNIQUE(guild_id, user_id, role_id)
  );

  CREATE TABLE IF NOT EXISTS platform_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_user_id TEXT NOT NULL,
    platform TEXT NOT NULL CHECK(platform IN ('twitch','youtube')),
    platform_user_id TEXT NOT NULL,
    platform_username TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TEXT,
    linked_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(discord_user_id, platform)
  );

  CREATE TABLE IF NOT EXISTS role_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    streamer_id INTEGER NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
    rule_type TEXT NOT NULL CHECK(rule_type IN ('follow','sub_tier1','sub_tier2','sub_tier3','yt_subscriber','yt_member')),
    role_id TEXT NOT NULL,
    UNIQUE(streamer_id, rule_type)
  );

  CREATE INDEX IF NOT EXISTS idx_streamers_guild ON streamers(guild_id);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_guild ON subscriptions(guild_id);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_active_expiry ON subscriptions(active, expires_at);
  CREATE INDEX IF NOT EXISTS idx_role_rules_streamer ON role_rules(streamer_id);
`);

// Migration additive : colonnes ajoutees apres la creation initiale de la table streamers.
// SQLite n'a pas de ADD COLUMN IF NOT EXISTS, on verifie via pragma table_info.
const streamerColumns = new Set(db.prepare('PRAGMA table_info(streamers)').all().map((c) => c.name));
for (const [column, ddl] of [
  ['oauth_access_token', 'ALTER TABLE streamers ADD COLUMN oauth_access_token TEXT'],
  ['oauth_refresh_token', 'ALTER TABLE streamers ADD COLUMN oauth_refresh_token TEXT'],
  ['oauth_token_expires_at', 'ALTER TABLE streamers ADD COLUMN oauth_token_expires_at TEXT'],
]) {
  if (!streamerColumns.has(column)) db.exec(ddl);
}

module.exports = db;
