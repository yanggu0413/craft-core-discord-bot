const db = require('../index');

class OfflineMailRepository {
  async createMail(senderDiscordId, senderUsername, receiverUsername, itemId, quantity, nbt) {
    return db.createMail(senderDiscordId, senderUsername, receiverUsername, itemId, quantity, nbt);
  }

  async getPendingMails(receiverUsername) {
    return db.getPendingMails(receiverUsername);
  }

  async getAllMails(receiverUsername) {
    return db.getAllMails(receiverUsername);
  }

  async markMailDelivered(mailId) {
    return db.markMailDelivered(mailId);
  }
}

module.exports = new OfflineMailRepository();
