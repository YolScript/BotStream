const express = require('express');
const crypto = require('crypto');
const { ensureAuthenticated } = require('../middleware/auth');
const twitchOAuth = require('../twitchOAuth');
const googleOAuth = require('../googleOAuth');
const streamersModel = require('../../database/models/streamers');

module.exports = function createPlatformAuthRouter(client) {
  const router = express.Router();
  router.use(ensureAuthenticated);

  function canManage(req, guildId) {
    return (
      !!guildId &&
      req.session.user.manageableGuilds.some((g) => g.id === guildId) &&
      client.guilds.cache.has(guildId)
    );
  }

  router.get('/twitch', (req, res) => {
    const { guildId } = req.query;
    if (!canManage(req, guildId)) {
      return res.status(403).render('error', { message: "Acces refuse a ce serveur." });
    }
    const state = crypto.randomBytes(16).toString('hex');
    req.session.twitchOAuthState = state;
    req.session.twitchOAuthGuildId = guildId;
    res.redirect(twitchOAuth.getAuthorizeUrl(state));
  });

  router.get('/twitch/callback', async (req, res) => {
    const { code, state } = req.query;
    const guildId = req.session.twitchOAuthGuildId;

    if (!code || !state || state !== req.session.twitchOAuthState || !canManage(req, guildId)) {
      return res.status(400).render('error', { message: 'Requete OAuth2 Twitch invalide ou expiree. Reessayez.' });
    }
    delete req.session.twitchOAuthState;
    delete req.session.twitchOAuthGuildId;

    try {
      const accessToken = await twitchOAuth.exchangeCode(code);
      const twitchUser = await twitchOAuth.fetchOwnUser(accessToken);
      streamersModel.add(guildId, 'twitch', twitchUser.login, twitchUser.display_name, twitchUser.id);
      res.redirect(`/dashboard/${guildId}/streamers?connected=twitch`);
    } catch (err) {
      console.error('[auth] Echec OAuth2 Twitch:', err.response?.data || err.message);
      res.status(500).render('error', { message: 'Echec de la connexion Twitch.' });
    }
  });

  router.get('/google', (req, res) => {
    const { guildId } = req.query;
    if (!canManage(req, guildId)) {
      return res.status(403).render('error', { message: "Acces refuse a ce serveur." });
    }
    const state = crypto.randomBytes(16).toString('hex');
    req.session.googleOAuthState = state;
    req.session.googleOAuthGuildId = guildId;
    res.redirect(googleOAuth.getAuthorizeUrl(state));
  });

  router.get('/google/callback', async (req, res) => {
    const { code, state } = req.query;
    const guildId = req.session.googleOAuthGuildId;

    if (!code || !state || state !== req.session.googleOAuthState || !canManage(req, guildId)) {
      return res.status(400).render('error', { message: 'Requete OAuth2 Google invalide ou expiree. Reessayez.' });
    }
    delete req.session.googleOAuthState;
    delete req.session.googleOAuthGuildId;

    try {
      const accessToken = await googleOAuth.exchangeCode(code);
      const channel = await googleOAuth.fetchOwnChannel(accessToken);
      if (!channel) {
        return res.status(400).render('error', { message: 'Aucune chaine YouTube trouvee sur ce compte Google.' });
      }
      streamersModel.add(guildId, 'youtube', channel.id, channel.snippet.title, channel.id);
      res.redirect(`/dashboard/${guildId}/streamers?connected=youtube`);
    } catch (err) {
      console.error('[auth] Echec OAuth2 Google:', err.response?.data || err.message);
      res.status(500).render('error', { message: 'Echec de la connexion Google/YouTube.' });
    }
  });

  return router;
};
