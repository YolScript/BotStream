const config = require('./config');
const client = require('./discord/client');
const createServer = require('./web/server');
const scheduler = require('./services/scheduler');

client.once('ready', () => {
  scheduler.start(client);
});

client.login(config.discord.token).catch((err) => {
  console.error('[discord] Echec de connexion:', err.message);
  // Delai volontaire : forcer process.exit() immediatement apres l'echec du login
  // declenche une assertion native libuv sur Windows (handle en cours de fermeture
  // par le manager REST d'undici). Laisser passer un tick reel evite la course.
  setTimeout(() => process.exit(1), 1000);
});

const app = createServer(client);
app.listen(config.web.port, () => {
  console.log(`[web] Panel disponible sur http://localhost:${config.web.port}`);
});
