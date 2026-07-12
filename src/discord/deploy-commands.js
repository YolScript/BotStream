const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const config = require('../config');

const commands = [];
const commandsDir = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsDir).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(commandsDir, file));
  commands.push(command.data.toJSON());
}

const rest = new REST().setToken(config.discord.token);

(async () => {
  try {
    const devGuildId = process.env.DEV_GUILD_ID;

    if (devGuildId) {
      await rest.put(Routes.applicationGuildCommands(config.discord.clientId, devGuildId), { body: commands });
      console.log(`[deploy] ${commands.length} commande(s) deployee(s) sur le serveur de dev ${devGuildId}.`);
    } else {
      await rest.put(Routes.applicationCommands(config.discord.clientId), { body: commands });
      console.log(`[deploy] ${commands.length} commande(s) deployee(s) globalement (propagation ~1h).`);
    }
  } catch (err) {
    console.error('[deploy] Echec du deploiement des commandes:', err);
    process.exit(1);
  }
})();
