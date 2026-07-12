const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const subscriptions = require('../../database/models/subscriptions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sub')
    .setDescription('Gerer les abonnements (attribution/retrait de role)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Donner un role d\'abonnement a un membre')
        .addUserOption((opt) => opt.setName('membre').setDescription('Membre concerne').setRequired(true))
        .addRoleOption((opt) => opt.setName('role').setDescription('Role a attribuer').setRequired(true))
        .addIntegerOption((opt) =>
          opt
            .setName('jours')
            .setDescription('Duree en jours avant retrait automatique (vide = permanent)')
            .setMinValue(1)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Retirer un abonnement (et le role associe)')
        .addUserOption((opt) => opt.setName('membre').setDescription('Membre concerne').setRequired(true))
        .addRoleOption((opt) => opt.setName('role').setDescription('Role a retirer').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('Lister les abonnements actifs')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'add') {
      const member = interaction.options.getMember('membre');
      const role = interaction.options.getRole('role', true);
      const jours = interaction.options.getInteger('jours');

      if (!member) {
        await interaction.reply({ content: 'Membre introuvable sur ce serveur.', ephemeral: true });
        return;
      }

      const botMember = interaction.guild.members.me;
      if (role.position >= botMember.roles.highest.position) {
        await interaction.reply({
          content: `Je ne peux pas attribuer le role ${role} : il est place au-dessus (ou au meme niveau) de mon role le plus eleve.`,
          ephemeral: true,
        });
        return;
      }

      await member.roles.add(role);
      const expiresAt = subscriptions.expiresAtFromDays(jours);
      subscriptions.add(guildId, member.id, role.id, expiresAt);

      const dureeText = jours ? `pendant ${jours} jour(s)` : 'de maniere permanente';
      await interaction.reply({ content: `Role ${role} attribue a ${member} ${dureeText}.`, ephemeral: true });
      return;
    }

    if (sub === 'remove') {
      const member = interaction.options.getMember('membre');
      const role = interaction.options.getRole('role', true);

      if (member && member.roles.cache.has(role.id)) {
        await member.roles.remove(role).catch(() => {});
      }
      subscriptions.deactivate(guildId, interaction.options.getUser('membre', true).id, role.id);

      await interaction.reply({ content: `Abonnement retire pour ${member || 'ce membre'} (role ${role}).`, ephemeral: true });
      return;
    }

    if (sub === 'list') {
      const rows = subscriptions.listByGuild(guildId);
      if (rows.length === 0) {
        await interaction.reply({ content: 'Aucun abonnement actif sur ce serveur.', ephemeral: true });
        return;
      }
      const embed = new EmbedBuilder()
        .setTitle('Abonnements actifs')
        .setColor(0x5865f2)
        .setDescription(
          rows
            .map((r) => `<@${r.user_id}> — <@&${r.role_id}> — ${r.expires_at ? `expire ${r.expires_at} UTC` : 'permanent'}`)
            .join('\n')
        );
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
