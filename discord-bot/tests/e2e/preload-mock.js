const Module = require('module');
const EventEmitter = require('events');

class MockClientCollection extends Map {
  find(fn) {
    for (const [key, val] of this) {
      if (fn(val, key, this)) return val;
    }
    return undefined;
  }
}

class SlashCommandBuilder {
  constructor() {
    this.name = '';
    this.description = '';
    this.options = [];
  }
  setName(name) { this.name = name; return this; }
  setDescription(desc) { this.description = desc; return this; }
  addStringOption(fn) {
    const opt = { type: 'string', name: '', description: '', required: false };
    const builder = {
      setName(n) { opt.name = n; return this; },
      setDescription(d) { opt.description = d; return this; },
      setRequired(r) { opt.required = r; return this; },
      setMinLength(l) { opt.minLength = l; return this; },
      setMaxLength(l) { opt.maxLength = l; return this; }
    };
    fn(builder);
    this.options.push(opt);
    return this;
  }
  setDefaultMemberPermissions(p) { this.defaultPermissions = p; return this; }
  toJSON() {
    return {
      name: this.name,
      description: this.description,
      options: this.options
    };
  }
}

class EmbedBuilder {
  constructor() {
    this.fields = [];
  }
  setTitle(t) { this.title = t; return this; }
  setDescription(d) { this.description = d; return this; }
  setColor(c) { this.color = c; return this; }
  setAuthor(a) { this.author = a; return this; }
  setFooter(f) { this.footer = f; return this; }
  setThumbnail(t) { this.thumbnail = t; return this; }
  setImage(i) { this.image = i; return this; }
  addFields(...fields) {
    if (Array.isArray(fields[0])) {
      this.fields.push(...fields[0]);
    } else {
      this.fields.push(...fields);
    }
    return this;
  }
  setTimestamp(t) { this.timestamp = t || new Date().toISOString(); return this; }
  toJSON() {
    return {
      title: this.title,
      description: this.description,
      color: this.color,
      author: this.author,
      footer: this.footer,
      thumbnail: this.thumbnail,
      image: this.image,
      fields: this.fields,
      timestamp: this.timestamp
    };
  }
}

class ButtonBuilder {
  setCustomId(id) { this.customId = id; return this; }
  setLabel(l) { this.label = l; return this; }
  setStyle(s) { this.style = s; return this; }
  toJSON() {
    return { customId: this.customId, label: this.label, style: this.style };
  }
}

class ActionRowBuilder {
  constructor() {
    this.components = [];
  }
  addComponents(...components) {
    if (Array.isArray(components[0])) {
      this.components.push(...components[0]);
    } else {
      this.components.push(...components);
    }
    return this;
  }
  toJSON() {
    return { components: this.components.map(c => typeof c.toJSON === 'function' ? c.toJSON() : c) };
  }
}

class WebhookClient {
  constructor({ url }) {
    this.url = url;
  }
  async send(options) {
    if (process.send) {
      process.send({
        type: 'DISCORD_EVENT',
        event: 'WEBHOOK_SEND',
        payload: {
          webhookUrl: this.url,
          content: options.content,
          username: options.username,
          avatarURL: options.avatarURL,
          embeds: options.embeds
        }
      });
    }
    return { id: 'mock_webhook_msg_id' };
  }
}

let activeClientInstance = null;

class MockClient extends EventEmitter {
  constructor(options) {
    super();
    this.user = { id: '1353160821315997787', tag: 'TestBot#1234', username: 'TestBot' };
    this.commands = new MockClientCollection();
    
    const cacheMap = new Map();
    this.channels = {
      cache: cacheMap,
      fetch: async (id) => {
        if (!cacheMap.has(id)) {
          cacheMap.set(id, createMockChannel(id, 'mock-channel', this));
        }
        return cacheMap.get(id);
      }
    };
    activeClientInstance = this;
  }
  
  async login(token) {
    setTimeout(() => {
      this.emit('ready');
    }, 10);
    return 'mock_token';
  }
}

const guild = {
  id: 'mock_guild_id',
  channels: {
    create: async (nameOrOptions, options) => {
      const createOptions = typeof nameOrOptions === 'string' ? { name: nameOrOptions, ...options } : nameOrOptions;
      const newChannelId = 'ticket-' + Math.floor(Math.random() * 1000000);
      const newChannel = createMockChannel(newChannelId, createOptions.name, activeClientInstance);
      newChannel.type = createOptions.type;
      newChannel.parentId = createOptions.parent;
      newChannel.delete = async () => {
        if (activeClientInstance) {
          activeClientInstance.channels.cache.delete(newChannelId);
        }
        if (process.send) {
          process.send({
            type: 'DISCORD_EVENT',
            event: 'CHANNEL_DELETE',
            payload: { id: newChannelId }
          });
        }
      };
      if (activeClientInstance) {
        activeClientInstance.channels.cache.set(newChannelId, newChannel);
      }
      if (process.send) {
        process.send({
          type: 'DISCORD_EVENT',
          event: 'CHANNEL_CREATE',
          payload: {
            id: newChannelId,
            name: createOptions.name,
            type: createOptions.type,
            parent: createOptions.parent,
            permissionOverwrites: createOptions.permissionOverwrites
          }
        });
      }
      return newChannel;
    },
    fetch: async (id) => {
      if (activeClientInstance && activeClientInstance.channels) {
        return activeClientInstance.channels.fetch(id);
      }
      return createMockChannel(id, 'mock-channel', activeClientInstance);
    }
  }
};

function createMockChannel(id, name, client) {
  const messagesCache = new MockClientCollection();
  return {
    id,
    name,
    messages: {
      cache: messagesCache,
      fetch: async (optionsOrId) => {
        if (typeof optionsOrId === 'string') {
          return messagesCache.get(optionsOrId);
        }
        return messagesCache;
      }
    },
    send: async (options) => {
      const content = typeof options === 'string' ? options : options.content;
      const embeds = options.embeds ? options.embeds.map(e => typeof e.toJSON === 'function' ? e.toJSON() : e) : undefined;
      const components = options.components ? options.components.map(c => typeof c.toJSON === 'function' ? c.toJSON() : c) : undefined;
      const files = options.files;
      
      const mockMsgId = 'mock_message_id_' + Math.floor(Math.random() * 1000000);
      const mockMsg = {
        id: mockMsgId,
        channelId: id,
        content,
        embeds,
        components,
        files,
        author: client ? client.user : { id: 'mock_author_id' },
        edit: async (editOptions) => {
          const editContent = typeof editOptions === 'string' ? editOptions : editOptions.content;
          const editEmbeds = editOptions.embeds ? editOptions.embeds.map(e => typeof e.toJSON === 'function' ? e.toJSON() : e) : undefined;
          const editComponents = editOptions.components ? editOptions.components.map(c => typeof c.toJSON === 'function' ? c.toJSON() : c) : undefined;
          
          if (editContent !== undefined) mockMsg.content = editContent;
          if (editEmbeds !== undefined) mockMsg.embeds = editEmbeds;
          if (editComponents !== undefined) mockMsg.components = editComponents;
          
          if (process.send) {
            process.send({
              type: 'DISCORD_EVENT',
              event: 'MESSAGE_EDIT',
              payload: { id: mockMsgId, channelId: id, content: mockMsg.content, embeds: mockMsg.embeds, components: mockMsg.components }
            });
          }
          return mockMsg;
        }
      };
      messagesCache.set(mockMsgId, mockMsg);
      
      if (process.send) {
        process.send({
          type: 'DISCORD_EVENT',
          event: 'MESSAGE_CREATE',
          payload: { channelId: id, content, embeds, components, files }
        });
      }
      return mockMsg;
    },
    createWebhook: async (webhookName) => {
      return {
        id: 'mock_webhook_id',
        name: webhookName,
        url: `https://discord.com/api/webhooks/mock_webhook_id/mock_token`,
        send: async (options) => {
          if (process.send) {
            process.send({
              type: 'DISCORD_EVENT',
              event: 'WEBHOOK_SEND',
              payload: {
                webhookUrl: `https://discord.com/api/webhooks/mock_webhook_id/mock_token`,
                content: options.content,
                username: options.username,
                avatarURL: options.avatarURL,
                embeds: options.embeds
              }
            });
          }
          return { id: 'mock_webhook_msg_id' };
        }
      };
    }
  };
}

class MockREST {
  constructor() {
    this.token = null;
  }
  setToken(token) {
    this.token = token;
    return this;
  }
  async put(route, { body }) {
    return body;
  }
}

const MockRoutes = {
  applicationGuildCommands: (clientId, guildId) => `/applications/${clientId}/guilds/${guildId}/commands`
};

const mockDiscord = {
  Client: MockClient,
  Collection: MockClientCollection,
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 2,
    MessageContent: 4,
    GuildMembers: 8
  },
  ButtonStyle: {
    Primary: 1,
    Secondary: 2,
    Success: 3,
    Danger: 4,
    Link: 5
  },
  ComponentType: {
    ActionRow: 1,
    Button: 2,
    StringSelect: 3,
    TextInput: 4,
    UserSelect: 5
  },
  ApplicationCommandOptionType: {
    Subcommand: 1,
    SubcommandGroup: 2,
    String: 3,
    Integer: 4,
    Boolean: 5,
    User: 6,
    Channel: 7,
    Role: 8,
    Mentionable: 9,
    Number: 10,
    Attachment: 11
  },
  PermissionFlagsBits: {
    Administrator: 8n
  },
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  WebhookClient,
  REST: MockREST,
  Routes: MockRoutes
};

// Hook require
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'discord.js') {
    return mockDiscord;
  }
  return originalRequire.apply(this, arguments);
};

// Route IPC messages
process.on('message', async (msg) => {
  if (!activeClientInstance) return;
  
  if (msg.type === 'INTERACTION_CREATE') {
    const { interaction } = msg;
    const isSlash = interaction.type === 'slash';
    const isButton = interaction.type === 'button';
    
    const member = {
      user: { id: interaction.userId, username: interaction.username },
      permissions: {
        has: (perm) => {
          return interaction.isAdmin !== false;
        }
      },
      roles: {
        cache: {
          has: (roleId) => {
            return interaction.roles && interaction.roles.includes(roleId);
          }
        }
      }
    };
    
    const mockChannel = await activeClientInstance.channels.fetch(interaction.channelId || 'mock_channel_id');
    
    const interactionObj = {
      type: interaction.type,
      id: 'interaction-' + Math.floor(Math.random() * 1000000),
      user: { id: interaction.userId, username: interaction.username, tag: `${interaction.username}#1234` },
      member: interaction.isDM ? null : member,
      channel: mockChannel,
      guild,
      customId: interaction.customId,
      isChatInputCommand: () => isSlash,
      isButton: () => isButton,
      commandName: interaction.name,
      
      options: {
        getString(name) {
          return interaction.options && interaction.options[name];
        },
        getInteger(name) {
          return interaction.options && interaction.options[name];
        },
        getBoolean(name) {
          return interaction.options && interaction.options[name];
        }
      },
      
      reply: async (options) => {
        const content = typeof options === 'string' ? options : options.content;
        const embeds = options.embeds ? options.embeds.map(e => typeof e.toJSON === 'function' ? e.toJSON() : e) : undefined;
        const components = options.components ? options.components.map(c => typeof c.toJSON === 'function' ? c.toJSON() : c) : undefined;
        if (process.send) {
          process.send({
            type: 'DISCORD_EVENT',
            event: 'INTERACTION_REPLY',
            payload: { type: 'reply', content, embeds, components, ephemeral: options.ephemeral }
          });
        }
        return { id: 'mock_reply_id' };
      },
      
      deferReply: async (options) => {
        if (process.send) {
          process.send({
            type: 'DISCORD_EVENT',
            event: 'INTERACTION_REPLY',
            payload: { type: 'deferReply', ephemeral: options?.ephemeral }
          });
        }
      },
      
      editReply: async (options) => {
        const content = typeof options === 'string' ? options : options.content;
        const embeds = options.embeds ? options.embeds.map(e => typeof e.toJSON === 'function' ? e.toJSON() : e) : undefined;
        const components = options.components ? options.components.map(c => typeof c.toJSON === 'function' ? c.toJSON() : c) : undefined;
        if (process.send) {
          process.send({
            type: 'DISCORD_EVENT',
            event: 'INTERACTION_REPLY',
            payload: { type: 'editReply', content, embeds, components }
          });
        }
        return { id: 'mock_edit_reply_id' };
      }
    };
    
    activeClientInstance.emit('interactionCreate', interactionObj);
  } else if (msg.type === 'GUILD_MEMBER_REMOVE') {
    const { userId } = msg;
    activeClientInstance.emit('guildMemberRemove', {
      user: { id: userId },
      guild: { id: 'mock_guild_id' }
    });
  } else if (msg.type === 'MESSAGE_CREATE') {
    const { message } = msg;
    activeClientInstance.emit('messageCreate', {
      content: message.content,
      channelId: message.channelId,
      author: {
        id: message.userId,
        username: message.username,
        tag: `${message.username}#1234`,
        bot: message.bot || false
      }
    });
  }
});

module.exports = mockDiscord;
