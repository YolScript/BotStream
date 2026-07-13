const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const guildConfigs = require('../../database/models/guildConfigs');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configurer les notifications de live pour ce serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('channel')
        .setDescription('Definir le salon de notification pour une plateforme')
        .addStringOption((opt) =>
          opt
            .setName('plateforme')
            .setDescription('Plateforme concernee')
            .setRequired(true)
            .addChoices(
              { name: 'Twitch', value: 'twitch' },
              { name: 'YouTube', value: 'youtube' },
              { name: 'TikTok', value: 'tiktok' }
            )
        )
        .addChannelOption((opt) =>
          opt
            .setName('salon')
            .setDescription('Salon ou envoyer les notifications')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('content')
        .setDescription('Definir le salon pour les clips Twitch / nouvelles videos YouTube et TikTok')
        .addStringOption((opt) =>
          opt
            .setName('plateforme')
            .setDescription('Plateforme concernee')
            .setRequired(true)
            .addChoices(
              { name: 'Twitch (clips)', value: 'twitch' },
              { name: 'YouTube (videos)', value: 'youtube' },
              { name: 'TikTok (videos)', value: 'tiktok' }
            )
        )
        .addChannelOption((opt) =>
          opt
            .setName('salon')
            .setDescription('Salon ou envoyer les notifications de contenu')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('role')
        .setDescription('Definir le role a mentionner lors des notifications de live')
        .addRoleOption((opt) => opt.setName('role').setDescription('Role a mentionner').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('show').setDescription('Afficher la configuration actuelle')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'channel') {
      const platform = interaction.options.getString('plateforme', true);
      const channel = interaction.options.getChannel('salon', true);
      guildConfigs.setChannel(guildId, platform, channel.id);
      await interaction.reply({ content: `Salon de notification **${platform}** defini sur ${channel}.`, ephemeral: true });
      return;
    }

    if (sub === 'content') {
      const platform = interaction.options.getString('plateforme', true);
      const channel = interaction.options.getChannel('salon', true);
      guildConfigs.setContentChannel(guildId, platform, channel.id);
      await interaction.reply({ content: `Salon de contenu **${platform}** defini sur ${channel}.`, ephemeral: true });
      return;
    }

    if (sub === 'role') {
      const role = interaction.options.getRole('role', true);
      guildConfigs.setPingRole(guildId, role.id);
      await interaction.reply({ content: `Role de mention defini sur ${role}.`, ephemeral: true });
      return;
    }

    if (sub === 'show') {
      const cfg = guildConfigs.get(guildId);
      const embed = new EmbedBuilder()
        .setTitle('Configuration BotStream')
        .setColor(0x5865f2)
        .addFields(
          { name: 'Twitch', value: cfg.twitch_channel_id ? `<#${cfg.twitch_channel_id}>` : 'Non configure', inline: true },
          { name: 'YouTube', value: cfg.youtube_channel_id ? `<#${cfg.youtube_channel_id}>` : 'Non configure', inline: true },
          { name: 'TikTok', value: cfg.tiktok_channel_id ? `<#${cfg.tiktok_channel_id}>` : 'Non configure', inline: true },
          {
            name: 'Clips Twitch',
            value: cfg.twitch_clips_channel_id ? `<#${cfg.twitch_clips_channel_id}>` : 'Non configure',
            inline: true,
          },
          {
            name: 'Videos YouTube',
            value: cfg.youtube_videos_channel_id ? `<#${cfg.youtube_videos_channel_id}>` : 'Non configure',
            inline: true,
          },
          {
            name: 'Videos TikTok',
            value: cfg.tiktok_videos_channel_id ? `<#${cfg.tiktok_videos_channel_id}>` : 'Non configure',
            inline: true,
          },
          { name: 'Role mentionne', value: cfg.ping_role_id ? `<@&${cfg.ping_role_id}>` : 'Aucun', inline: false }
        );
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
