const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('test-dm')
    .setDescription("Tester l'envoi de messages prives (MP toi-meme pour verifier que le bot peut t'ecrire)"),

  async execute(interaction) {
    try {
      await interaction.user.send(
        "Test reussi : BotStream peut bien t'envoyer des messages prives depuis ce serveur."
      );
      await interaction.reply({ content: 'MP envoye, verifie tes messages prives.', ephemeral: true });
    } catch (err) {
      await interaction.reply({
        content:
          "Impossible de t'envoyer un MP. Verifie que tes messages prives sont ouverts pour les membres de ce serveur (Parametres de confidentialite Discord).",
        ephemeral: true,
      });
    }
  },
};
