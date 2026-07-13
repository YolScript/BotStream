const config = require('../config');
const streamers = require('../database/models/streamers');
const subscriptions = require('../database/models/subscriptions');
const twitch = require('./twitch');
const youtube = require('./youtube');
const tiktok = require('./tiktok');
const { sendLiveNotification, sendClipNotification, sendNewVideoNotification } = require('./notifier');
const roleSync = require('./roleSync');

async function pollTwitch(client) {
  if (!config.twitch.clientId || !config.twitch.clientSecret) return;

  const rows = streamers.listByPlatform('twitch');
  if (rows.length === 0) return;

  const logins = [...new Set(rows.map((r) => r.username))];
  const liveStreams = await twitch.getStreamsByLogins(logins);
  const liveByLogin = new Map(liveStreams.map((s) => [s.user_login.toLowerCase(), s]));

  for (const row of rows) {
    const stream = liveByLogin.get(row.username);
    const wasLive = !!row.is_live;

    if (stream) {
      streamers.setLiveState(row.id, true, stream.id, stream.user_id);
      if (!wasLive) {
        await sendLiveNotification(client, row, {
          title: stream.title,
          thumbnailUrl: stream.thumbnail_url.replace('{width}', '1280').replace('{height}', '720'),
        });
      }
    } else if (wasLive) {
      streamers.setLiveState(row.id, false, null);
    }
  }
}

async function pollYouTube(client) {
  if (!config.youtube.apiKey) return;

  const rows = streamers.listByPlatform('youtube');
  for (const row of rows) {
    try {
      const channelId = row.platform_channel_id || (await youtube.resolveChannelId(row.username));
      if (!channelId) continue;

      const info = await youtube.checkLive(channelId);
      const wasLive = !!row.is_live;

      if (info.live) {
        streamers.setLiveState(row.id, true, info.videoId, channelId);
        if (!wasLive) await sendLiveNotification(client, row, info);
      } else if (wasLive) {
        streamers.setLiveState(row.id, false, null, channelId);
      } else if (!row.platform_channel_id) {
        streamers.setLiveState(row.id, false, row.last_stream_key, channelId);
      }
    } catch (err) {
      console.error(`[scheduler] Erreur poll YouTube (${row.username}):`, err.message);
    }
  }
}

async function pollTikTok(client) {
  const rows = streamers.listByPlatform('tiktok');
  for (const row of rows) {
    try {
      const info = await tiktok.checkLive(row.username);
      const wasLive = !!row.is_live;

      if (info.live) {
        streamers.setLiveState(row.id, true, info.roomId);
        if (!wasLive) await sendLiveNotification(client, row, info);
      } else if (wasLive) {
        streamers.setLiveState(row.id, false, null);
      }
    } catch (err) {
      console.error(`[scheduler] Erreur poll TikTok (${row.username}):`, err.message);
    }
  }
}

async function pollTwitchClips(client) {
  if (!config.twitch.clientId || !config.twitch.clientSecret) return;

  const rows = streamers.listByPlatform('twitch');
  for (const row of rows) {
    try {
      let broadcasterId = row.platform_channel_id;
      if (!broadcasterId) {
        const users = await twitch.getUsersByLogin([row.username]);
        if (users.length === 0) continue;
        broadcasterId = users[0].id;
        streamers.setPlatformChannelId(row.id, broadcasterId);
      }

      if (!row.last_content_id) {
        // Baseline initiale : ne pas notifier les clips deja existants.
        streamers.setContentState(row.id, new Date().toISOString());
        continue;
      }

      const clips = await twitch.getClips(broadcasterId, row.last_content_id);
      const newClips = clips
        .filter((c) => c.created_at > row.last_content_id)
        .sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
      if (newClips.length === 0) continue;

      for (const clip of newClips) {
        await sendClipNotification(client, row, { title: clip.title, url: clip.url, thumbnailUrl: clip.thumbnail_url });
      }
      streamers.setContentState(row.id, newClips[newClips.length - 1].created_at);
    } catch (err) {
      console.error(`[scheduler] Erreur poll clips Twitch (${row.username}):`, err.message);
    }
  }
}

async function pollYouTubeVideos(client) {
  if (!config.youtube.apiKey) return;

  const rows = streamers.listByPlatform('youtube');
  for (const row of rows) {
    try {
      const channelId = row.platform_channel_id || (await youtube.resolveChannelId(row.username));
      if (!channelId) continue;

      const video = await youtube.getLatestVideo(channelId);
      if (!video) continue;

      if (!row.last_content_id) {
        // Baseline initiale : ne pas notifier les videos deja existantes.
        streamers.setContentState(row.id, video.videoId);
      } else if (video.videoId !== row.last_content_id) {
        await sendNewVideoNotification(client, row, video);
        streamers.setContentState(row.id, video.videoId);
      }
    } catch (err) {
      console.error(`[scheduler] Erreur poll videos YouTube (${row.username}):`, err.message);
    }
  }
}

async function pollTikTokVideos(client) {
  const rows = streamers.listByPlatform('tiktok');
  for (const row of rows) {
    try {
      const video = await tiktok.getLatestVideo(row.username);
      if (!video) continue;

      if (!row.last_content_id) {
        streamers.setContentState(row.id, video.videoId);
      } else if (video.videoId !== row.last_content_id) {
        await sendNewVideoNotification(client, row, video);
        streamers.setContentState(row.id, video.videoId);
      }
    } catch (err) {
      console.error(`[scheduler] Erreur poll videos TikTok (${row.username}):`, err.message);
    }
  }
}

async function checkExpiredSubscriptions(client) {
  const expired = subscriptions.listExpired();
  for (const sub of expired) {
    try {
      const guild = client.guilds.cache.get(sub.guild_id) || (await client.guilds.fetch(sub.guild_id).catch(() => null));
      const member = guild ? await guild.members.fetch(sub.user_id).catch(() => null) : null;
      if (member && member.roles.cache.has(sub.role_id)) {
        await member.roles.remove(sub.role_id).catch((err) => console.error('[scheduler] Echec retrait role:', err.message));
      }
      subscriptions.deactivate(sub.guild_id, sub.user_id, sub.role_id);
      console.log(`[scheduler] Abonnement expire retire: guild=${sub.guild_id} user=${sub.user_id} role=${sub.role_id}`);
    } catch (err) {
      console.error('[scheduler] Erreur traitement abonnement expire:', err.message);
    }
  }
}

// Boucle un appel async a intervalle fixe, sans chevauchement si l'appel precedent
// depasse la duree de l'intervalle (contrairement a setInterval brut).
function loopForever(fn, intervalMs) {
  let stopped = false;
  async function tick() {
    if (stopped) return;
    try {
      await fn();
    } catch (err) {
      console.error('[scheduler] Erreur non geree dans une boucle de polling:', err.message);
    }
    if (!stopped) setTimeout(tick, intervalMs);
  }
  tick();
  return () => {
    stopped = true;
  };
}

function start(client) {
  loopForever(() => pollTwitch(client), config.polling.twitchMs);
  loopForever(() => pollYouTube(client), config.polling.youtubeMs);
  loopForever(() => pollTikTok(client), config.polling.tiktokMs);
  loopForever(() => pollTwitchClips(client), config.polling.twitchClipsMs);
  loopForever(() => pollYouTubeVideos(client), config.polling.youtubeVideosMs);
  loopForever(() => pollTikTokVideos(client), config.polling.tiktokVideosMs);
  loopForever(() => checkExpiredSubscriptions(client), config.polling.subscriptionCheckMs);
  loopForever(() => roleSync.syncAllGuilds(client), config.polling.roleSyncMs);
}

module.exports = { start };
