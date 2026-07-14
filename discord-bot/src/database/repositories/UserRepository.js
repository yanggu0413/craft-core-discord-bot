const db = require('../index');

class UserRepository {
  async addBinding(discordId, mcUuid, mcUsername) {
    return db.addBinding(discordId, mcUuid, mcUsername);
  }

  async getBindingByDiscordId(discordId) {
    const row = await db.getBindingByDiscordId(discordId);
    return row !== undefined ? row : null;
  }

  async getBindingByMcUuid(mcUuid) {
    const row = await db.getBindingByMcUuid(mcUuid);
    return row !== undefined ? row : null;
  }

  async getBindingByMcUsername(mcUsername) {
    const row = await db.getBindingByMcUsername(mcUsername);
    return row !== undefined ? row : null;
  }

  async removeBindingByDiscordId(discordId) {
    return db.removeBindingByDiscordId(discordId);
  }

  async removeBindingByMcUuid(mcUuid) {
    return db.removeBindingByMcUuid(mcUuid);
  }

  async removeBindingByMcUsername(mcUsername) {
    return db.removeBindingByMcUsername(mcUsername);
  }

  async getUserKeys(discordId) {
    const row = await db.getUserKeys(discordId);
    return row !== undefined ? row : null;
  }

  async updateKeys(discordId, newCount) {
    const res = await db.updateKeys(discordId, newCount);
    await this.syncKeysToGameByDiscordId(discordId);
    return res;
  }

  async setCheckin(discordId, dateStr, keysToAdd) {
    const res = await db.setCheckin(discordId, dateStr, keysToAdd);
    await this.syncKeysToGameByDiscordId(discordId);
    return res;
  }

  async setCheckinWithStreak(discordId, dateStr, streak, keysToAdd) {
    const res = await db.setCheckinWithStreak(discordId, dateStr, streak, keysToAdd);
    await this.syncKeysToGameByDiscordId(discordId);
    return res;
  }

  async toggleReminderSubscription(discordId, status) {
    return db.toggleReminderSubscription(discordId, status);
  }

  async updateExchangedTicks(discordId, newExchangedTicks, keysToAdd) {
    const res = await db.updateExchangedTicks(discordId, newExchangedTicks, keysToAdd);
    await this.syncKeysToGameByDiscordId(discordId);
    return res;
  }

  async getCheckinLeaderboard(limit = 10) {
    return db.getCheckinLeaderboard(limit);
  }

  async getSubscribedUsers() {
    return db.getSubscribedUsers();
  }

  async addKeysByMcUsername(mcUsername, keysToAdd) {
    const res = await db.addKeysByMcUsername(mcUsername, keysToAdd);
    await this.syncKeysToGame(mcUsername);
    return res;
  }

  async addKeysByDiscordId(discordId, keysToAdd) {
    const res = await db.addKeysByDiscordId(discordId, keysToAdd);
    await this.syncKeysToGameByDiscordId(discordId);
    return res;
  }

  async bindUser(discordId, mcUuid, mcUsername, code) {
    return db.bindUser(discordId, mcUuid, mcUsername, code);
  }

  async syncKeysToGame(mcUsername) {
    try {
      const binding = await this.getBindingByMcUsername(mcUsername);
      if (binding) {
        const userKeys = await this.getUserKeys(binding.discord_id);
        if (userKeys) {
          const session = require('../../websocket/session');
          session.send({
            type: 'player_keys_update',
            payload: {
              username: mcUsername,
              keys: userKeys.keys_count || 0
            }
          });
        }
      }
    } catch (e) {
      console.error('[UserRepository] Failed to sync keys to game for ' + mcUsername, e);
    }
  }

  async syncKeysToGameByDiscordId(discordId) {
    try {
      const binding = await this.getBindingByDiscordId(discordId);
      if (binding) {
        await this.syncKeysToGame(binding.mc_username);
      }
    } catch (e) {
      console.error('[UserRepository] Failed to sync keys to game for discordId ' + discordId, e);
    }
  }
}

module.exports = new UserRepository();
