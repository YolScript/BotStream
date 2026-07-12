const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('link')
    .setDescription('Lier ton compte Twitch ou YouTube pour recevoir automatiquement les roles associes')
    .addSubcommand((sub) => sub.setName('twitch').setDescription('Lier ton compte Twitch'))
    .addSubcommand((sub) => sub.setName('youtube').setDescription('Lier ton compte YouTube')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const path = sub === 'twitch' ? '/link/twitch' : '/link/google';
    await interaction.reply({
      content: `Clique ici pour lier ton compte ${sub === 'twitch' ? 'Twitch' : 'YouTube'} : ${config.web.publicUrl}${path}`,
      ephemeral: true,
    });
  },
};
