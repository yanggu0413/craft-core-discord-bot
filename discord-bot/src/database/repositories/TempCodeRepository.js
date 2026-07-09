const db = require('../index');

class TempCodeRepository {
  async createTempCode(mcUuid, mcUsername, code) {
    return db.createTempCode(mcUuid, mcUsername, code);
  }

  async getTempCode(code) {
    const row = await db.getTempCode(code);
    return row !== undefined ? row : null;
  }

  async deleteTempCode(code) {
    return db.deleteTempCode(code);
  }

  async clearExpiredTempCodes() {
    return db.clearExpiredTempCodes();
  }
}

module.exports = new TempCodeRepository();
