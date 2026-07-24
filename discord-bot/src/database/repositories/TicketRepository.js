const db = require('../index');

class TicketRepository {
  async createTicket(ticketId, channelId, creatorId, creatorUsername, channelName) {
    return db.createTicket(ticketId, channelId, creatorId, creatorUsername, channelName);
  }

  async getTicketByChannelId(channelId) {
    const row = await db.getTicketByChannelId(channelId);
    return row !== undefined ? row : null;
  }

  async closeTicket(channelId, closedBy, transcriptJson, transcriptText) {
    return db.closeTicket(channelId, closedBy, transcriptJson, transcriptText);
  }
}

module.exports = new TicketRepository();
