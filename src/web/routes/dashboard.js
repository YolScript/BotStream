const express = require('express');
const { ChannelType } = require('discord.js');
const { ensureAuthenticated, ensureGuildManage } = require('../middleware/auth');
const guildConfigs = require('../../database/models/guildConfigs');
const streamersModel = require('../../database/models/streamers');
const subscriptionsModel = require('../../database/models/subscriptions');
const roleRulesModel = require('../../database/models/roleRules');
const twitch = require('../../services/twitch');
const youtube = require('../../services/youtube');
const config = require('../../config');

const SNOWFLAKE = /^\d{17,20}$/;
const PLATFORMS = new Set(['twitch', 'youtube', 'tiktok']);

module.exports = function createDashboardRouter(client) {
  const router = express.Router();
  router.use(ensureAuthenticated);

  router.get('/', (req, res) => {
    const guilds = req.session.user.manageableGuilds.map((g) => ({
      ...g,
      botPresent: client.guilds.cache.has(g.id),
    }));
    res.render('dashboard', {
      guilds,
      clientId: config.discord.clientId,
      invitePermissions: config.discord.invitePermissions,
    });
  });

  router.get('/:guildId', ensureGuildManage(client), (req, res) => {
    const cfg = guildConfigs.get(req.params.guildId);
    const streamerCount = streamersModel.listByGuild(req.params.guildId).length;
    res.render('guild', { guild: req.guild, cfg, streamerCount });
  });

  router.get('/:guildId/config', ensureGuildManage(client), (req, res) => {
    const cfg = guildConfigs.get(req.params.guildId);
    const textChannels = [...req.guild.channels.cache.values()].filter((c) => c.type === ChannelType.GuildText);
    const roles = [...req.guild.roles.cache.values()].filter((r) => r.id !== req.guild.id);
    res.render('config', { guild: req.guild, cfg, textChannels, roles, saved: req.query.saved === '1' });
  });

  router.post('/:guildId/config', ensureGuildManage(client), (req, res) => {
    const { twitch_channel, youtube_channel, tiktok_channel, ping_role } = req.body;

    for (const [platform, channelId] of [
      ['twitch', twitch_channel],
      ['youtube', youtube_channel],
      ['tiktok', tiktok_channel],
    ]) {
      if (!channelId) continue;
      if (!req.guild.channels.cache.has(channelId)) continue;
      guildConfigs.setChannel(req.params.guildId, platform, channelId);
    }

    if (ping_role && req.guild.roles.cache.has(ping_role)) {
      guildConfigs.setPingRole(req.params.guildId, ping_role);
    } else if (ping_role === '') {
      guildConfigs.setPingRole(req.params.guildId, null);
    }

    res.redirect(`/dashboard/${req.params.guildId}/config?saved=1`);
  });

  router.get('/:guildId/streamers', ensureGuildManage(client), (req, res) => {
    const rows = streamersModel.listByGuild(req.params.guildId);
    res.render('streamers', {
      guild: req.guild,
      streamers: rows,
      error: req.query.error,
      connected: req.query.connected,
      twitchEnabled: !!config.twitch.clientId,
      googleEnabled: !!config.google.clientId,
    });
  });

  router.post('/:guildId/streamers/add', ensureGuildManage(client), async (req, res) => {
    const { platform, username } = req.body;
    const guildId = req.params.guildId;

    if (!PLATFORMS.has(platform) || !username || !username.trim()) {
      return res.redirect(`/dashboard/${guildId}/streamers?error=Champs invalides`);
    }

    const name = username.trim();
    let displayName = null;

    try {
      if (platform === 'twitch') {
        const users = await twitch.getUsersByLogin([name.toLowerCase()]);
        if (users.length === 0) return res.redirect(`/dashboard/${guildId}/streamers?error=Compte Twitch introuvable`);
        displayName = users[0].display_name;
      } else if (platform === 'youtube') {
        const channelId = await youtube.resolveChannelId(name);
        if (!channelId) return res.redirect(`/dashboard/${guildId}/streamers?error=Chaine YouTube introuvable`);
      }
    } catch {
      // API indisponible : on ajoute quand meme, la resolution sera retentee au prochain poll
    }

    streamersModel.add(guildId, platform, name, displayName);
    res.redirect(`/dashboard/${guildId}/streamers`);
  });

  router.post('/:guildId/streamers/:id/delete', ensureGuildManage(client), (req, res) => {
    streamersModel.removeById(req.params.id, req.params.guildId);
    res.redirect(`/dashboard/${req.params.guildId}/streamers`);
  });

  router.get('/:guildId/streamers/:id/roles', ensureGuildManage(client), (req, res) => {
    const streamer = streamersModel.getById(req.params.id);
    if (!streamer || streamer.guild_id !== req.params.guildId) {
      return res.status(404).render('error', { message: 'Streamer introuvable.' });
    }
    if (streamer.platform === 'tiktok') {
      return res.status(400).render('error', { message: 'Pas de roles automatiques disponibles pour TikTok.' });
    }

    const rules = roleRulesModel.listByStreamer(streamer.id);
    const rulesByType = Object.fromEntries(rules.map((r) => [r.rule_type, r.role_id]));
    const roles = [...req.guild.roles.cache.values()].filter((r) => r.id !== req.guild.id);
    res.render('streamerRoles', { guild: req.guild, streamer, rulesByType, roles, saved: req.query.saved === '1' });
  });

  router.post('/:guildId/streamers/:id/roles', ensureGuildManage(client), (req, res) => {
    const streamer = streamersModel.getById(req.params.id);
    if (!streamer || streamer.guild_id !== req.params.guildId) {
      return res.status(404).render('error', { message: 'Streamer introuvable.' });
    }

    const ruleTypes =
      streamer.platform === 'twitch' ? ['follow', 'sub_tier1', 'sub_tier2', 'sub_tier3'] : ['yt_subscriber', 'yt_member'];

    for (const ruleType of ruleTypes) {
      const roleId = req.body[ruleType];
      if (roleId && !req.guild.roles.cache.has(roleId)) continue;
      roleRulesModel.set(streamer.id, ruleType, roleId || null);
    }

    res.redirect(`/dashboard/${req.params.guildId}/streamers/${req.params.id}/roles?saved=1`);
  });

  router.get('/:guildId/subscriptions', ensureGuildManage(client), (req, res) => {
    const rows = subscriptionsModel.listByGuild(req.params.guildId);
    const roles = [...req.guild.roles.cache.values()].filter((r) => r.id !== req.guild.id);
    res.render('subscriptions', { guild: req.guild, subscriptions: rows, roles, error: req.query.error });
  });

  router.post('/:guildId/subscriptions/add', ensureGuildManage(client), async (req, res) => {
    const { userId, roleId, days } = req.body;
    const guildId = req.params.guildId;

    if (!SNOWFLAKE.test(userId || '') || !req.guild.roles.cache.has(roleId || '')) {
      return res.redirect(`/dashboard/${guildId}/subscriptions?error=Champs invalides`);
    }

    const role = req.guild.roles.cache.get(roleId);
    if (role.position >= req.guild.members.me.roles.highest.position) {
      return res.redirect(`/dashboard/${guildId}/subscriptions?error=Role trop eleve pour le bot`);
    }

    const member = await req.guild.members.fetch(userId).catch(() => null);
    if (!member) {
      return res.redirect(`/dashboard/${guildId}/subscriptions?error=Membre introuvable sur ce serveur`);
    }

    await member.roles.add(role);
    const daysInt = parseInt(days, 10);
    subscriptionsModel.add(guildId, userId, roleId, subscriptionsModel.expiresAtFromDays(daysInt > 0 ? daysInt : null));

    res.redirect(`/dashboard/${guildId}/subscriptions`);
  });

  router.post('/:guildId/subscriptions/remove', ensureGuildManage(client), async (req, res) => {
    const { userId, roleId } = req.body;
    const guildId = req.params.guildId;

    const member = await req.guild.members.fetch(userId).catch(() => null);
    if (member && member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId).catch(() => {});
    }
    subscriptionsModel.deactivate(guildId, userId, roleId);

    res.redirect(`/dashboard/${guildId}/subscriptions`);
  });

  return router;
};
