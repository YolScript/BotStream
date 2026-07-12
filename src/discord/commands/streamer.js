const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const streamers = require('../../database/models/streamers');
const twitch = require('../../services/twitch');
const youtube = require('../../services/youtube');

const PLATFORM_CHOICES = [
  { name: 'Twitch', value: 'twitch' },
  { name: 'YouTube', value: 'youtube' },
  { name: 'TikTok', value: 'tiktok' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('streamer')
    .setDescription('Gerer les streamers suivis pour les notifications de live')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Ajouter un streamer a suivre')
        .addStringOption((opt) =>
          opt.setName('plateforme').setDescription('Plateforme').setRequired(true).addChoices(...PLATFORM_CHOICES)
        )
        .addStringOption((opt) =>
          opt
            .setName('nom')
            .setDescription('Login Twitch / handle ou ID YouTube / nom d\'utilisateur TikTok')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Retirer un streamer suivi')
        .addStringOption((opt) =>
          opt.setName('plateforme').setDescription('Plateforme').setRequired(true).addChoices(...PLATFORM_CHOICES)
        )
        .addStringOption((opt) => opt.setName('nom').setDescription('Nom du streamer a retirer').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('Lister les streamers suivis sur ce serveur')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'add') {
      await interaction.deferReply({ ephemeral: true });
      const platform = interaction.options.getString('plateforme', true);
      const nom = interaction.options.getString('nom', true).trim();

      let displayName = null;

      if (platform === 'twitch') {
        try {
          const users = await twitch.getUsersByLogin([nom.toLowerCase()]);
          if (users.length === 0) {
            await interaction.editReply(`Aucun utilisateur Twitch trouve pour \`${nom}\`.`);
            return;
          }
          displayName = users[0].display_name;
        } catch (err) {
          await interaction.editReply(
            'Impossible de verifier ce compte Twitch (identifiants API manquants ou erreur reseau). Le streamer sera tout de meme ajoute.'
          );
        }
      } else if (platform === 'youtube') {
        try {
          const channelId = await youtube.resolveChannelId(nom);
          if (!channelId) {
            await interaction.editReply(`Aucune chaine YouTube trouvee pour \`${nom}\`.`);
            return;
          }
        } catch {
          // cle API manquante ou erreur reseau : on ajoute quand meme, la resolution sera retentee au prochain poll
        }
      }

      streamers.add(guildId, platform, nom, displayName);
      await interaction.editReply(`Streamer **${displayName || nom}** (${platform}) ajoute au suivi.`);
      return;
    }

    if (sub === 'remove') {
      const platform = interaction.options.getString('plateforme', true);
      const nom = interaction.options.getString('nom', true).trim();
      const result = streamers.remove(guildId, platform, nom);
      const message = result.changes > 0 ? `Streamer **${nom}** (${platform}) retire du suivi.` : `Aucun streamer \`${nom}\` (${platform}) trouve.`;
      await interaction.reply({ content: message, ephemeral: true });
      return;
    }

    if (sub === 'list') {
      const rows = streamers.listByGuild(guildId);
      if (rows.length === 0) {
        await interaction.reply({ content: 'Aucun streamer suivi sur ce serveur.', ephemeral: true });
        return;
      }
      const embed = new EmbedBuilder()
        .setTitle('Streamers suivis')
        .setColor(0x5865f2)
        .setDescription(
          rows
            .map((r) => `${r.is_live ? '🔴' : '⚪'} **${r.platform}** — ${r.display_name || r.username}`)
            .join('\n')
        );
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
