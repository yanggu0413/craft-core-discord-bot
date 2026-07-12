const db = require('../index');

class TicketRepository {
  async createTicket(ticketId, channelId, creatorId) {
    return db.createTicket(ticketId, channelId, creatorId);
  }

  async getTicketByChannelId(channelId) {
    const row = await db.getTicketByChannelId(channelId);
    return row !== undefined ? row : null;
  }

  async closeTicket(channelId) {
    return db.closeTicket(channelId);
  }
}

module.exports = new TicketRepository();
