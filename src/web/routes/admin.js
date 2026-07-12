const express = require('express');
const { ensureAuthenticated, ensureSuperAdmin } = require('../middleware/auth');
const streamersModel = require('../../database/models/streamers');

module.exports = function createAdminRouter(client) {
  const router = express.Router();
  router.use(ensureAuthenticated, ensureSuperAdmin);

  router.get('/', (req, res) => {
    const guilds = [...client.guilds.cache.values()]
      .map((g) => ({
        id: g.id,
        name: g.name,
        icon: g.icon,
        memberCount: g.memberCount,
        streamers: streamersModel.listByGuild(g.id),
      }))
      .sort((a, b) => b.memberCount - a.memberCount);
    res.render('admin', { guilds });
  });

  return router;
};
