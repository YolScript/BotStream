const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`Bienvenue sur ${member.guild.name} !`)
      .setDescription(
        "Ce serveur utilise BotStream pour attribuer automatiquement des roles selon ton follow/abonnement Twitch ou YouTube.\n\n" +
          'Lie tes comptes avec ces commandes (a taper sur le serveur) :\n' +
          '`/link twitch` — lier ton compte Twitch\n' +
          '`/link youtube` — lier ton compte YouTube\n\n' +
          'Une fois lie, les roles se mettent a jour automatiquement (verification periodique).'
      );

    await member.send({ embeds: [embed] }).catch(() => {
      // MP fermes : rien a faire, le membre pourra toujours utiliser /link manuellement.
    });
  },
};
