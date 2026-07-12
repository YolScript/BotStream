const path = require('path');
const express = require('express');
const session = require('express-session');
const config = require('../config');
const SQLiteStore = require('./sessionStore');
const authRoutes = require('./routes/auth');
const createPlatformAuthRouter = require('./routes/platformAuth');
const createDashboardRouter = require('./routes/dashboard');

function createServer(client) {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(express.urlencoded({ extended: false }));

  app.use(
    session({
      store: new SQLiteStore(),
      secret: config.web.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 24 * 60 * 60 * 1000, httpOnly: true },
    })
  );

  app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
  });

  app.get('/', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    res.render('login');
  });

  app.use('/auth', authRoutes);
  app.use('/auth', createPlatformAuthRouter(client));
  app.use('/dashboard', createDashboardRouter(client));

  app.use((req, res) => {
    res.status(404).render('error', { message: 'Page introuvable.' });
  });

  return app;
}

module.exports = createServer;
