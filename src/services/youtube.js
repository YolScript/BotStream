const axios = require('axios');
const config = require('../config');

const BASE = 'https://www.googleapis.com/youtube/v3';

// Accepte un ID de chaine (UCxxxx) ou un handle (@nom). Retourne l'ID de chaine.
async function resolveChannelId(handleOrId) {
  if (/^UC[\w-]{22}$/.test(handleOrId)) return handleOrId;

  const handle = handleOrId.startsWith('@') ? handleOrId : `@${handleOrId}`;
  const res = await axios.get(`${BASE}/channels`, {
    params: { part: 'id', forHandle: handle, key: config.youtube.apiKey },
  });
  const item = res.data.items && res.data.items[0];
  if (!item) return null;
  return item.id;
}

// Retourne { live: bool, videoId, title, thumbnailUrl } pour une chaine donnee.
async function checkLive(channelId) {
  const res = await axios.get(`${BASE}/search`, {
    params: {
      part: 'snippet',
      channelId,
      eventType: 'live',
      type: 'video',
      key: config.youtube.apiKey,
    },
  });

  const item = res.data.items && res.data.items[0];
  if (!item) return { live: false };

  return {
    live: true,
    videoId: item.id.videoId,
    title: item.snippet.title,
    thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
    channelTitle: item.snippet.channelTitle,
  };
}

module.exports = { resolveChannelId, checkLive };
