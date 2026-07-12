// Twitch Helix attend des cles repetees (login=a&login=b), pas la notation login[]=a
// qu'axios utilise par defaut pour les tableaux. Serializer custom requis.
function repeatedKeysSerializer(params) {
  const parts = [];
  for (const [key, value] of Object.entries(params)) {
    const values = Array.isArray(value) ? value : [value];
    for (const v of values) parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
  }
  return parts.join('&');
}

module.exports = { repeatedKeysSerializer };
