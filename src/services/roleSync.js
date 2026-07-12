const twitch = require('./twitch');
const twitchOAuth = require('../web/twitchOAuth');
const googleOAuth = require('../web/googleOAuth');
const streamersModel = require('../database/models/streamers');
const roleRulesModel = require('../database/models/roleRules');
const platformLinksModel = require('../database/models/platformLinks');
const { fromSqliteDatetime } = require('./timeUtil');

function isExpired(expiresAt) {
  if (!expiresAt) return true;
  return fromSqliteDatetime(expiresAt).getTime() < Date.now() + 60000;
}

async function ensureFreshStreamerToken(streamer) {
  if (!streamer.oauth_access_token) return null;
  if (!isExpired(streamer.oauth_token_expires_at)) return streamer.oauth_access_token;
  if (!streamer.oauth_refresh_token) return null;

  const refresh = streamer.platform === 'twitch' ? twitchOAuth.refreshAccessToken : googleOAuth.refreshAccessToken;
  const tokens = await refresh(streamer.oauth_refresh_token);
  streamersModel.updateOAuthTokens(streamer.id, tokens);
  return tokens.accessToken;
}

async function ensureFreshMemberToken(link) {
  if (!link.access_token) return null;
  if (!isExpired(link.token_expires_at)) return link.access_token;
  if (!link.refresh_token) return null;

  const tokens = await googleOAuth.refreshAccessToken(link.refresh_token);
  platformLinksModel.updateTokens(link.discord_user_id, link.platform, tokens);
  return tokens.accessToken;
}

async function fetchMember(guild, discordUserId) {
  return guild.members.cache.get(discordUserId) || guild.members.fetch(discordUserId).catch(() => null);
}

async function applyRole(member, roleId, shouldHave) {
  if (!roleId) return;
  const has = member.roles.cache.has(roleId);
  if (shouldHave && !has) await member.roles.add(roleId).catch(() => {});
  if (!shouldHave && has) await member.roles.remove(roleId).catch(() => {});
}

function groupRules(rules) {
  return Object.fromEntries(rules.map((r) => [r.rule_type, r.role_id]));
}

async function syncTwitchRoles(guild, streamer, rules) {
  const streamerToken = await ensureFreshStreamerToken(streamer);
  if (!streamerToken) return;

  const rulesByType = groupRules(rules);
  const links = platformLinksModel.listByPlatform('twitch');

  for (const link of links) {
    const member = await fetchMember(guild, link.discord_user_id);
    if (!member) continue;

    try {
      if (rulesByType.follow) {
        const follows = await twitch.isFollowing(streamerToken, streamer.platform_channel_id, link.platform_user_id);
        await applyRole(member, rulesByType.follow, follows);
      }

      if (rulesByType.sub_tier1 || rulesByType.sub_tier2 || rulesByType.sub_tier3) {
        const tier = await twitch.getSubscriptionTier(streamerToken, streamer.platform_channel_id, link.platform_user_id);
        await applyRole(member, rulesByType.sub_tier1, tier >= 1);
        await applyRole(member, rulesByType.sub_tier2, tier >= 2);
        await applyRole(member, rulesByType.sub_tier3, tier >= 3);
      }
    } catch (err) {
      console.error(`[roleSync] Erreur Twitch (streamer=${streamer.username}, membre=${link.discord_user_id}):`, err.message);
    }
  }
}

async function syncYoutubeRoles(guild, streamer, rules) {
  const rulesByType = groupRules(rules);
  const links = platformLinksModel.listByPlatform('youtube');

  let memberChannelIds = null;
  if (rulesByType.yt_member) {
    const streamerToken = await ensureFreshStreamerToken(streamer);
    if (streamerToken) {
      try {
        const members = await googleOAuth.listChannelMembers(streamerToken);
        memberChannelIds = new Set(members.map((m) => m.snippet.memberDetails.channelId));
      } catch (err) {
        console.error(`[roleSync] Erreur liste membres YouTube (streamer=${streamer.username}):`, err.message);
      }
    }
  }

  for (const link of links) {
    const member = await fetchMember(guild, link.discord_user_id);
    if (!member) continue;

    try {
      if (rulesByType.yt_member && memberChannelIds) {
        await applyRole(member, rulesByType.yt_member, memberChannelIds.has(link.platform_user_id));
      }
      if (rulesByType.yt_subscriber) {
        const memberToken = await ensureFreshMemberToken(link);
        if (memberToken) {
          const subscribed = await googleOAuth.isSubscribedToChannel(memberToken, streamer.platform_channel_id);
          await applyRole(member, rulesByType.yt_subscriber, subscribed);
        }
      }
    } catch (err) {
      console.error(`[roleSync] Erreur YouTube (streamer=${streamer.username}, membre=${link.discord_user_id}):`, err.message);
    }
  }
}

async function syncGuildRoles(guild) {
  const streamers = streamersModel
    .listByGuild(guild.id)
    .filter((s) => s.platform === 'twitch' || s.platform === 'youtube');
  if (streamers.length === 0) return;

  const rules = roleRulesModel.listByStreamerIds(streamers.map((s) => s.id));
  const rulesByStreamer = new Map();
  for (const rule of rules) {
    if (!rulesByStreamer.has(rule.streamer_id)) rulesByStreamer.set(rule.streamer_id, []);
    rulesByStreamer.get(rule.streamer_id).push(rule);
  }

  for (const streamer of streamers) {
    const streamerRules = rulesByStreamer.get(streamer.id);
    if (!streamerRules || streamerRules.length === 0) continue;

    if (streamer.platform === 'twitch') await syncTwitchRoles(guild, streamer, streamerRules);
    else await syncYoutubeRoles(guild, streamer, streamerRules);
  }
}

async function syncAllGuilds(client) {
  for (const guild of client.guilds.cache.values()) {
    await syncGuildRoles(guild).catch((err) => {
      console.error(`[roleSync] Erreur guild ${guild.id}:`, err.message);
    });
  }
}

module.exports = { syncAllGuilds };
