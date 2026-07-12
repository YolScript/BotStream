const express = require('express');
const crypto = require('crypto');
const { ensureAuthenticated } = require('../middleware/auth');
const twitchOAuth = require('../twitchOAuth');
const googleOAuth = require('../googleOAuth');
const streamersModel = require('../../database/models/streamers');
const platformLinks = require('../../database/models/platformLinks');

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

  // ---- Twitch : ajout d'un streamer suivi (admin) ----
  router.get('/twitch', (req, res) => {
    const { guildId } = req.query;
    if (!canManage(req, guildId)) {
      return res.status(403).render('error', { message: "Acces refuse a ce serveur." });
    }
    const state = crypto.randomBytes(16).toString('hex');
    req.session.twitchOAuthState = state;
    req.session.twitchOAuthPurpose = 'add-streamer';
    req.session.twitchOAuthGuildId = guildId;
    res.redirect(twitchOAuth.getAuthorizeUrl(state, twitchOAuth.STREAMER_SCOPE));
  });

  router.get('/twitch/callback', async (req, res) => {
    const { code, state } = req.query;
    const purpose = req.session.twitchOAuthPurpose;
    const guildId = req.session.twitchOAuthGuildId;

    if (!code || !state || state !== req.session.twitchOAuthState) {
      return res.status(400).render('error', { message: 'Requete OAuth2 Twitch invalide ou expiree. Reessayez.' });
    }
    delete req.session.twitchOAuthState;
    delete req.session.twitchOAuthPurpose;
    delete req.session.twitchOAuthGuildId;

    try {
      const tokens = await twitchOAuth.exchangeCode(code);
      const twitchUser = await twitchOAuth.fetchOwnUser(tokens.accessToken);

      if (purpose === 'link-member') {
        platformLinks.upsert(req.session.user.id, 'twitch', {
          platformUserId: twitchUser.id,
          platformUsername: twitchUser.display_name,
        });
        return res.redirect('/link?connected=twitch');
      }

      if (!canManage(req, guildId)) {
        return res.status(403).render('error', { message: "Acces refuse a ce serveur." });
      }
      streamersModel.add(guildId, 'twitch', twitchUser.login, twitchUser.display_name, twitchUser.id, tokens);
      res.redirect(`/dashboard/${guildId}/streamers?connected=twitch`);
    } catch (err) {
      console.error('[auth] Echec OAuth2 Twitch:', err.response?.data || err.message);
      res.status(500).render('error', { message: 'Echec de la connexion Twitch.' });
    }
  });

  // ---- Google/YouTube : ajout d'un streamer suivi (admin) ----
  router.get('/google', (req, res) => {
    const { guildId } = req.query;
    if (!canManage(req, guildId)) {
      return res.status(403).render('error', { message: "Acces refuse a ce serveur." });
    }
    const state = crypto.randomBytes(16).toString('hex');
    req.session.googleOAuthState = state;
    req.session.googleOAuthPurpose = 'add-streamer';
    req.session.googleOAuthGuildId = guildId;
    res.redirect(
      googleOAuth.getAuthorizeUrl(state, {
        scope: `${googleOAuth.READONLY_SCOPE} ${googleOAuth.MEMBERSHIP_SCOPE}`,
        accessType: 'offline',
      })
    );
  });

  router.get('/google/callback', async (req, res) => {
    const { code, state } = req.query;
    const purpose = req.session.googleOAuthPurpose;
    const guildId = req.session.googleOAuthGuildId;

    if (!code || !state || state !== req.session.googleOAuthState) {
      return res.status(400).render('error', { message: 'Requete OAuth2 Google invalide ou expiree. Reessayez.' });
    }
    delete req.session.googleOAuthState;
    delete req.session.googleOAuthPurpose;
    delete req.session.googleOAuthGuildId;

    try {
      const tokens = await googleOAuth.exchangeCode(code);
      const channel = await googleOAuth.fetchOwnChannel(tokens.accessToken);
      if (!channel) {
        return res.status(400).render('error', { message: 'Aucune chaine YouTube trouvee sur ce compte Google.' });
      }

      if (purpose === 'link-member') {
        platformLinks.upsert(req.session.user.id, 'youtube', {
          platformUserId: channel.id,
          platformUsername: channel.snippet.title,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
        });
        return res.redirect('/link?connected=youtube');
      }

      if (!canManage(req, guildId)) {
        return res.status(403).render('error', { message: "Acces refuse a ce serveur." });
      }
      streamersModel.add(guildId, 'youtube', channel.id, channel.snippet.title, channel.id, tokens);
      res.redirect(`/dashboard/${guildId}/streamers?connected=youtube`);
    } catch (err) {
      console.error('[auth] Echec OAuth2 Google:', err.response?.data || err.message);
      res.status(500).render('error', { message: 'Echec de la connexion Google/YouTube.' });
    }
  });

  return router;
};
