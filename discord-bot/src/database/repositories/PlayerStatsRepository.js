const db = require('../index');

class PlayerStatsRepository {
  async incrementDeath(mcUuid, mcUsername) {
    return db.incrementDeath(mcUuid, mcUsername);
  }

  async getDeathLeaderboard(limit) {
    const list = await db.getDeathLeaderboard(limit);
    return list !== undefined ? list : [];
  }
}

module.exports = new PlayerStatsRepository();
