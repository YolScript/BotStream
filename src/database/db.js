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

  CREATE INDEX IF NOT EXISTS idx_streamers_guild ON streamers(guild_id);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_guild ON subscriptions(guild_id);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_active_expiry ON subscriptions(active, expires_at);
`);

module.exports = db;
