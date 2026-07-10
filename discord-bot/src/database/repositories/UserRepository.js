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
    return db.updateKeys(discordId, newCount);
  }

  async setCheckin(discordId, dateStr, keysToAdd) {
    return db.setCheckin(discordId, dateStr, keysToAdd);
  }

  async setCheckinWithStreak(discordId, dateStr, streak, keysToAdd) {
    return db.setCheckinWithStreak(discordId, dateStr, streak, keysToAdd);
  }

  async toggleReminderSubscription(discordId, status) {
    return db.toggleReminderSubscription(discordId, status);
  }

  async updateExchangedTicks(discordId, newExchangedTicks, keysToAdd) {
    return db.updateExchangedTicks(discordId, newExchangedTicks, keysToAdd);
  }

  async getCheckinLeaderboard(limit = 10) {
    return db.getCheckinLeaderboard(limit);
  }

  async getSubscribedUsers() {
    return db.getSubscribedUsers();
  }

  async addKeysByMcUsername(mcUsername, keysToAdd) {
    return db.addKeysByMcUsername(mcUsername, keysToAdd);
  }

  async addKeysByDiscordId(discordId, keysToAdd) {
    return db.addKeysByDiscordId(discordId, keysToAdd);
  }

  async bindUser(discordId, mcUuid, mcUsername, code) {
    return db.bindUser(discordId, mcUuid, mcUsername, code);
  }
}

module.exports = new UserRepository();
