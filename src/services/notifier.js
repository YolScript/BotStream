const { EmbedBuilder } = require('discord.js');
const guildConfigs = require('../database/models/guildConfigs');

const PLATFORM_META = {
  twitch: { color: 0x9146ff, label: 'Twitch', urlPrefix: 'https://twitch.tv/' },
  youtube: { color: 0xff0000, label: 'YouTube', urlPrefix: 'https://www.youtube.com/watch?v=' },
  tiktok: { color: 0x010101, label: 'TikTok', urlPrefix: 'https://www.tiktok.com/@' },
};

function buildUrl(platform, streamer, liveInfo) {
  if (platform === 'youtube') return `https://www.youtube.com/watch?v=${liveInfo.videoId}`;
  if (platform === 'tiktok') return `https://www.tiktok.com/@${streamer.username}/live`;
  return `https://twitch.tv/${streamer.username}`;
}

async function sendLiveNotification(client, streamer, liveInfo) {
  const cfg = guildConfigs.get(streamer.guild_id);
  const channelId = cfg[`${streamer.platform}_channel_id`];
  if (!channelId) return;

  const guild = client.guilds.cache.get(streamer.guild_id);
  if (!guild) return;

  const channel = guild.channels.cache.get(channelId);
  if (!channel || !channel.isTextBased()) return;

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

  const content = cfg.ping_role_id ? `<@&${cfg.ping_role_id}>` : undefined;

  await channel.send({ content, embeds: [embed] }).catch((err) => {
    console.error(`[notifier] Echec envoi notification (${streamer.platform}/${streamer.username}):`, err.message);
  });
}

module.exports = { sendLiveNotification };
