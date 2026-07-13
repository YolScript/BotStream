const { EmbedBuilder } = require('discord.js');
const guildConfigs = require('../database/models/guildConfigs');

const PLATFORM_META = {
  twitch: { color: 0x9146ff, label: 'Twitch', urlPrefix: 'https://twitch.tv/' },
  youtube: { color: 0xff0000, label: 'YouTube', urlPrefix: 'https://www.youtube.com/watch?v=' },
  tiktok: { color: 0x010101, label: 'TikTok', urlPrefix: 'https://www.tiktok.com/@' },
};

const CONTENT_CHANNEL_COLUMN = {
  twitch: 'twitch_clips_channel_id',
  youtube: 'youtube_videos_channel_id',
  tiktok: 'tiktok_videos_channel_id',
};

function buildUrl(platform, streamer, liveInfo) {
  if (platform === 'youtube') return `https://www.youtube.com/watch?v=${liveInfo.videoId}`;
  if (platform === 'tiktok') return `https://www.tiktok.com/@${streamer.username}/live`;
  return `https://twitch.tv/${streamer.username}`;
}

async function sendEmbed(client, guildId, channelId, pingRoleId, embed) {
  if (!channelId) return;

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  const channel = guild.channels.cache.get(channelId);
  if (!channel || !channel.isTextBased()) return;

  const content = pingRoleId ? `<@&${pingRoleId}>` : undefined;

  await channel.send({ content, embeds: [embed] }).catch((err) => {
    console.error(`[notifier] Echec envoi notification (guild=${guildId}):`, err.message);
  });
}

async function sendLiveNotification(client, streamer, liveInfo) {
  const cfg = guildConfigs.get(streamer.guild_id);
  const channelId = cfg[`${streamer.platform}_channel_id`];
  if (!channelId) return;

  const meta = PLATFORM_META[streamer.platform];
  const displayName = streamer.display_name || streamer.username;

  const embed = new EmbedBuilder()
    .setColor(meta.color)
    .setTitle(liveInfo.title || `${displayName} est en live sur ${meta.label} !`)
    .setURL(buildUrl(streamer.platform, streamer, liveInfo))
    .setAuthor({ name: `${displayName} est en live sur ${meta.label}` })
    .setTimestamp();

  const thumbnail = liveInfo.thumbnailUrl || liveInfo.coverUrl;
  if (thumbnail) embed.setImage(thumbnail);

  await sendEmbed(client, streamer.guild_id, channelId, cfg.ping_role_id, embed);
}

// Salon dedie au contenu (clips/videos) s'il est configure, sinon repli sur le salon "live".
function resolveContentChannelId(cfg, platform) {
  return cfg[CONTENT_CHANNEL_COLUMN[platform]] || cfg[`${platform}_channel_id`];
}

async function sendClipNotification(client, streamer, clip) {
  const cfg = guildConfigs.get(streamer.guild_id);
  const channelId = resolveContentChannelId(cfg, 'twitch');
  if (!channelId) return;

  const displayName = streamer.display_name || streamer.username;

  const embed = new EmbedBuilder()
    .setColor(PLATFORM_META.twitch.color)
    .setTitle(clip.title || `Nouveau clip de ${displayName}`)
    .setURL(clip.url)
    .setAuthor({ name: `Nouveau clip Twitch de ${displayName}` })
    .setTimestamp();

  if (clip.thumbnailUrl) embed.setImage(clip.thumbnailUrl);

  await sendEmbed(client, streamer.guild_id, channelId, cfg.ping_role_id, embed);
}

async function sendNewVideoNotification(client, streamer, video) {
  const cfg = guildConfigs.get(streamer.guild_id);
  const channelId = resolveContentChannelId(cfg, streamer.platform);
  if (!channelId) return;

  const meta = PLATFORM_META[streamer.platform];
  const displayName = streamer.display_name || streamer.username;
  const url =
    streamer.platform === 'youtube'
      ? `https://www.youtube.com/watch?v=${video.videoId}`
      : `https://www.tiktok.com/@${streamer.username}/video/${video.videoId}`;

  const embed = new EmbedBuilder()
    .setColor(meta.color)
    .setTitle(video.title || `Nouvelle video de ${displayName}`)
    .setURL(url)
    .setAuthor({ name: `Nouvelle video ${meta.label} de ${displayName}` })
    .setTimestamp();

  const thumbnail = video.thumbnailUrl || video.coverUrl;
  if (thumbnail) embed.setImage(thumbnail);

  await sendEmbed(client, streamer.guild_id, channelId, cfg.ping_role_id, embed);
}

module.exports = { sendLiveNotification, sendClipNotification, sendNewVideoNotification };
