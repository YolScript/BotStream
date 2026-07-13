const axios = require('axios');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

let warnedOnce = false;
let warnedOnceVideos = false;

function extractSigiState(html) {
  const match = html.match(/<script id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

// TikTok n'expose aucune API publique de live. On scrape la page /@user/live et on lit
// l'etat embarque dans le script SIGI_STATE. Fragile par nature: si TikTok change son
// balisage, cette fonction se degrade silencieusement vers { live: false }.
async function checkLive(username) {
  const res = await axios.get(`https://www.tiktok.com/@${username}/live`, {
    headers: { 'User-Agent': USER_AGENT },
    timeout: 10000,
    validateStatus: () => true,
  });

  if (res.status !== 200) return { live: false };

  const data = extractSigiState(res.data);
  if (!data) {
    if (!warnedOnce) {
      console.warn('[tiktok] Structure SIGI_STATE introuvable, la page TikTok a peut-etre change.');
      warnedOnce = true;
    }
    return { live: false };
  }

  const liveRoom = data?.LiveRoom?.liveRoomUserInfo?.liveRoom;
  const roomId = data?.LiveRoom?.liveRoomUserInfo?.user?.roomId;

  if (!liveRoom || liveRoom.status !== 2) return { live: false };

  return {
    live: true,
    roomId: roomId || String(liveRoom.startTime),
    title: liveRoom.title || `${username} est en live`,
    coverUrl: liveRoom.coverUrl,
  };
}

// Meme approche fragile que checkLive : scrape la page profil et lit ItemModule dans SIGI_STATE.
// Retourne { videoId, title, coverUrl, createTime } pour la derniere video postee, ou null.
async function getLatestVideo(username) {
  const res = await axios.get(`https://www.tiktok.com/@${username}`, {
    headers: { 'User-Agent': USER_AGENT },
    timeout: 10000,
    validateStatus: () => true,
  });

  if (res.status !== 200) return null;

  const data = extractSigiState(res.data);
  if (!data) {
    if (!warnedOnceVideos) {
      console.warn('[tiktok] Structure SIGI_STATE introuvable (videos), la page TikTok a peut-etre change.');
      warnedOnceVideos = true;
    }
    return null;
  }

  const items = Object.values(data?.ItemModule || {});
  if (items.length === 0) return null;

  const latest = items.reduce((a, b) => (Number(b.createTime) > Number(a.createTime) ? b : a));

  return {
    videoId: latest.id,
    title: latest.desc || `Nouvelle video de ${username}`,
    coverUrl: latest.video?.cover || latest.video?.originCover,
    createTime: Number(latest.createTime),
  };
}

module.exports = { checkLive, getLatestVideo };
