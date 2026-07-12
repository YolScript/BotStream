const axios = require('axios');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

let warnedOnce = false;

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

  const match = res.data.match(/<script id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) {
    if (!warnedOnce) {
      console.warn('[tiktok] Structure SIGI_STATE introuvable, la page TikTok a peut-etre change.');
      warnedOnce = true;
    }
    return { live: false };
  }

  try {
    const data = JSON.parse(match[1]);
    const liveRoom = data?.LiveRoom?.liveRoomUserInfo?.liveRoom;
    const roomId = data?.LiveRoom?.liveRoomUserInfo?.user?.roomId;

    if (!liveRoom || liveRoom.status !== 2) return { live: false };

    return {
      live: true,
      roomId: roomId || String(liveRoom.startTime),
      title: liveRoom.title || `${username} est en live`,
      coverUrl: liveRoom.coverUrl,
    };
  } catch {
    return { live: false };
  }
}

module.exports = { checkLive };
