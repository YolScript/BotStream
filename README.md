# BotStream

Bot Discord de notifications de live (Twitch / YouTube / TikTok) avec panel web de controle et gestion des abonnements (attribution/retrait automatique de roles).

## Fonctionnalites

- Notifications automatiques quand un streamer suivi passe en live sur Twitch, YouTube ou TikTok (embed avec titre, vignette, lien direct).
- Configuration par serveur : salon de notification par plateforme + role a mentionner.
- Commandes slash : `/config`, `/streamer`, `/sub`, `/panel`.
- Panel web (login via Discord OAuth2) pour gerer la configuration, les streamers suivis et les abonnements sans passer par Discord.
- Connexion directe Twitch/YouTube (OAuth2) pour ajouter un streamer suivi : pas de saisie manuelle, le compte est verifie et lie automatiquement.
- Abonnements avec attribution de role, duree optionnelle et retrait automatique a expiration.

## Prerequis

- Node.js **22.5 ou superieur** (utilise le module natif `node:sqlite`, aucune compilation native requise).
- Une application Discord (bot) : https://discord.com/developers/applications
- Une application Twitch (facultatif, pour les notifications Twitch) : https://dev.twitch.tv/console/apps
- Une cle API YouTube Data v3 (facultatif, pour les notifications YouTube) : https://console.cloud.google.com/

## Installation

```bash
npm install
cp .env.example .env
```

Remplir `.env` :

| Variable | Description |
| --- | --- |
| `DISCORD_TOKEN` | Token du bot (onglet Bot de l'application Discord) |
| `DISCORD_CLIENT_ID` | Application ID |
| `DISCORD_CLIENT_SECRET` | Client Secret (onglet OAuth2) |
| `PUBLIC_URL` | URL publique du panel (ex: `https://monbot.exemple.com`), utilisee pour le callback OAuth2 |
| `SESSION_SECRET` | Chaine aleatoire longue (`openssl rand -hex 32`) |
| `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` | Application Twitch (facultatif, desactive le polling + le bouton "Connecter Twitch" si absent) |
| `YOUTUBE_API_KEY` | Cle API YouTube Data v3 (facultatif, desactive le polling YouTube si absente) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | App OAuth2 Google, pour le bouton "Connecter YouTube" (facultatif, voir ci-dessous) |
| `DEV_GUILD_ID` | ID d'un serveur de test pour deployer les commandes instantanement (facultatif) |

Dans le portail Discord Developer, activer l'intent privilegie **Server Members Intent** (onglet Bot), necessaire pour l'attribution/retrait de roles.

Dans le portail OAuth2 Discord, ajouter comme Redirect URI : `<PUBLIC_URL>/auth/discord/callback`.

Dans la console Twitch, ajouter comme OAuth Redirect URL : `<PUBLIC_URL>/auth/twitch/callback` (meme Client ID/Secret que celui deja utilise pour le polling).

Pour le bouton "Connecter YouTube" (facultatif) : creer une app OAuth2 dans Google Cloud Console (APIs & Services > Credentials > Create OAuth Client ID > Web application), activer l'API YouTube Data v3, ajouter `<PUBLIC_URL>/auth/google/callback` comme Redirect URI autorisee. Sans ces variables, le bouton YouTube reste desactive sur le panel (l'ajout manuel du handle/ID reste possible).

## Lancement

```bash
npm run deploy-commands   # a refaire uniquement quand les commandes changent
npm start
```

Le panel web est servi sur `http://localhost:3000` (ou `PORT`).

Inviter le bot sur un serveur avec les permissions necessaires (Voir les salons, Envoyer des messages, Integrer des liens, Voir l'historique, Gerer les roles) :

```
https://discord.com/oauth2/authorize?client_id=<DISCORD_CLIENT_ID>&scope=bot%20applications.commands&permissions=268520448
```

> Important : le role du bot doit etre place **au-dessus** de tout role qu'il doit attribuer/retirer (hierarchie de roles Discord), sinon `/sub add` echouera.

## Commandes slash

- `/config channel plateforme:<twitch|youtube|tiktok> salon:#salon` — definit le salon de notification.
- `/config role role:@role` — role mentionne lors d'une notification de live.
- `/config show` — affiche la configuration actuelle.
- `/streamer add plateforme nom` — suit un nouveau streamer (login Twitch, handle/ID YouTube, pseudo TikTok).
- `/streamer remove plateforme nom` — retire un streamer suivi.
- `/streamer list` — liste les streamers suivis avec leur statut.
- `/sub add membre role jours` — attribue un role d'abonnement (retrait automatique apres `jours`, permanent si omis).
- `/sub remove membre role` — retire un abonnement et le role associe.
- `/sub list` — liste les abonnements actifs.
- `/panel` — renvoie le lien direct vers le panel web pour ce serveur.

## Panel web

Connexion via Discord OAuth2. Affiche les serveurs ou l'utilisateur a la permission "Gerer le serveur", avec pour chacun :

- **Configuration** : salons de notification + role mentionne.
- **Streamers** : connexion directe Twitch/YouTube (OAuth2, sans saisie manuelle) ou ajout manuel (pseudo, utile pour suivre un streamer autre que soi-meme) ; retrait, statut live en direct.
- **Abonnements** : attribution/retrait de roles avec expiration, vue d'ensemble des abonnements actifs.

## Limites connues

- La detection TikTok repose sur du scraping non officiel (TikTok n'expose aucune API publique de live) : elle peut casser si TikTok modifie la structure de sa page. Voir `src/services/tiktok.js`.
- Twitch et YouTube sont interroges par polling (intervalle configurable via `.env`), pas de push temps reel (EventSub webhook/websocket non implemente pour rester simple a auto-heberger).
- Le panel utilise un stockage de session SQLite maison (`src/web/sessionStore.js`) : un seul processus Node a la fois (pas de scaling horizontal sans changer de store).

## Structure du projet

```
src/
  config.js              Chargement de la configuration (.env)
  index.js                Point d'entree : demarre le bot et le serveur web
  database/               SQLite (node:sqlite) + modeles (guildConfigs, streamers, subscriptions)
  discord/                Client discord.js, evenements, commandes slash
  services/               Twitch (Helix), YouTube (Data API v3), TikTok (scraping), notifier, scheduler
  web/                     Serveur Express, OAuth2 Discord, routes, vues EJS
```
