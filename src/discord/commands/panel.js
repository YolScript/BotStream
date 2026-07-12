const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Obtenir le lien du panel web de controle pour ce serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute(interaction) {
    const url = `${config.web.publicUrl}/dashboard/${interaction.guildId}`;
    await interaction.reply({ content: `Panel de controle : ${url}`, ephemeral: true });
  },
};
