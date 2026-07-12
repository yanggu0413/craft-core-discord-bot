const db = require('../index');

class DailyStatsRepository {
  async incrementMessage(date) {
    return db.incrementMessage(date);
  }

  async incrementDeath(date) {
    return db.incrementDailyDeath(date);
  }

  async incrementLogin(date) {
    return db.incrementLogin(date);
  }

  async recordLogin(date, mcUsername) {
    return db.recordLogin(date, mcUsername);
  }

  async updateMaxOnline(date, count) {
    return db.updateMaxOnline(date, count);
  }

  async getStats(date) {
    return db.getStats(date);
  }

  async getLoginCount(date) {
    return db.getLoginCount(date);
  }
}

module.exports = new DailyStatsRepository();
