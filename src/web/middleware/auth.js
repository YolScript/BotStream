const config = require('../../config');

function ensureAuthenticated(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/');
}

function isSuperAdmin(req) {
  return !!config.web.superAdminId && req.session.user?.id === config.web.superAdminId;
}

function ensureSuperAdmin(req, res, next) {
  if (isSuperAdmin(req)) return next();
  res.status(403).render('error', { message: 'Acces reserve.' });
}

function ensureGuildManage(client) {
  return (req, res, next) => {
    const { guildId } = req.params;
    const manageable = isSuperAdmin(req) || req.session.user?.manageableGuilds?.find((g) => g.id === guildId);

    if (!manageable) {
      return res.status(403).render('error', { message: "Vous n'avez pas les droits de gestion sur ce serveur." });
    }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).render('error', {
        message: "Le bot n'est pas present sur ce serveur. Invitez-le d'abord puis reessayez.",
        inviteUrl: `https://discord.com/oauth2/authorize?client_id=${client.user?.id}&scope=bot%20applications.commands&permissions=${config.discord.invitePermissions}&guild_id=${guildId}`,
      });
    }

    req.guild = guild;
    next();
  };
}

module.exports = { ensureAuthenticated, ensureGuildManage, ensureSuperAdmin, isSuperAdmin };
