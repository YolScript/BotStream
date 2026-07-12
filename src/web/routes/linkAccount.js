const express = require('express');
const crypto = require('crypto');
const { ensureAuthenticated } = require('../middleware/auth');
const twitchOAuth = require('../twitchOAuth');
const googleOAuth = require('../googleOAuth');
const platformLinks = require('../../database/models/platformLinks');

module.exports = function createLinkRouter() {
  const router = express.Router();
  router.use(ensureAuthenticated);

  router.get('/', (req, res) => {
    const twitchLink = platformLinks.get(req.session.user.id, 'twitch');
    const youtubeLink = platformLinks.get(req.session.user.id, 'youtube');
    res.render('link', { twitchLink, youtubeLink, connected: req.query.connected });
  });

  router.get('/twitch', (req, res) => {
    const state = crypto.randomBytes(16).toString('hex');
    req.session.twitchOAuthState = state;
    req.session.twitchOAuthPurpose = 'link-member';
    res.redirect(twitchOAuth.getAuthorizeUrl(state, ''));
  });

  router.get('/google', (req, res) => {
    const state = crypto.randomBytes(16).toString('hex');
    req.session.googleOAuthState = state;
    req.session.googleOAuthPurpose = 'link-member';
    res.redirect(googleOAuth.getAuthorizeUrl(state, { scope: googleOAuth.READONLY_SCOPE, accessType: 'offline' }));
  });

  return router;
};
