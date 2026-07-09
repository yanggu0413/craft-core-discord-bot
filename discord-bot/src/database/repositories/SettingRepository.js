const db = require('../index');

class SettingRepository {
  async setSetting(key, value) {
    return db.setSetting(key, value);
  }

  async getSetting(key) {
    const value = await db.getSetting(key);
    return value !== undefined ? value : null;
  }
}

module.exports = new SettingRepository();
