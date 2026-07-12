const express = require('express');
const crypto = require('crypto');
const { getAuthorizeUrl, exchangeCode, fetchUser, fetchManageableGuildIds } = require('../discordOAuth');

const router = express.Router();

router.get('/discord', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;
  res.redirect(getAuthorizeUrl(state));
});

router.get('/discord/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state || state !== req.session.oauthState) {
    return res.status(400).render('error', { message: 'Requete OAuth2 invalide ou expiree. Reessayez.' });
  }
  delete req.session.oauthState;

  try {
    const accessToken = await exchangeCode(code);
    const [discordUser, manageableGuilds] = await Promise.all([
      fetchUser(accessToken),
      fetchManageableGuildIds(accessToken),
    ]);

    req.session.user = {
      id: discordUser.id,
      username: discordUser.username,
      avatar: discordUser.avatar,
      manageableGuilds,
    };

    res.redirect('/dashboard');
  } catch (err) {
    console.error('[auth] Echec OAuth2 Discord:', err.response?.data || err.message);
    res.status(500).render('error', { message: "Echec de l'authentification Discord." });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
