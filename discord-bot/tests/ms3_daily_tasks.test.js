const { getDailyTasksFallback, getTaipeiDateString } = require('../src/utils/dailyTasksHelper');
const tasksCommand = require('../src/bot/commands/tasks');
const session = require('../src/websocket/session');
const UserRepository = require('../src/database/repositories/UserRepository');

jest.mock('../src/websocket/session');
jest.mock('../src/database/repositories/UserRepository');

describe('Milestone 3: Daily Task & Greeting System Tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('Daily tasks seeded randomization returns identical tasks for the same date', () => {
    const date1 = '2026-07-13';
    const date2 = '2026-07-13';
    const date3 = '2026-07-14';

    const tasks1 = getDailyTasksFallback(date1);
    const tasks2 = getDailyTasksFallback(date2);
    const tasks3 = getDailyTasksFallback(date3);

    expect(tasks1).toEqual(tasks2);
    expect(tasks1[0]).toHaveProperty('type');
    expect(tasks1[0]).toHaveProperty('target');
    expect(tasks1[0]).toHaveProperty('count');
    expect(tasks1[0]).toHaveProperty('reward');

    // Different dates might produce different tasks
    const hash1 = JSON.stringify(tasks1);
    const hash3 = JSON.stringify(tasks3);
    // There are 3 options in each pool, so 9 combinations total, different seed should behave deterministically
    expect(tasks1).toBeDefined();
    expect(tasks3).toBeDefined();
  });

  test('Tasks command replies with error if user is not bound', async () => {
    UserRepository.getBindingByDiscordId.mockResolvedValue(null);

    const interaction = {
      user: { id: 'user-not-bound' },
      reply: jest.fn().mockResolvedValue({}),
      deferReply: jest.fn().mockResolvedValue({}),
      editReply: jest.fn().mockResolvedValue({})
    };

    await tasksCommand.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('尚未綁定'),
      ephemeral: true
    }));
  });

  test('Tasks command uses offline fallback when game server is disconnected', async () => {
    UserRepository.getBindingByDiscordId.mockResolvedValue({ mc_username: 'Player1' });
    session.isActive.mockReturnValue(false);

    const interaction = {
      user: { id: 'user-bound' },
      reply: jest.fn().mockResolvedValue({}),
      deferReply: jest.fn().mockResolvedValue({}),
      editReply: jest.fn().mockResolvedValue({})
    };

    await tasksCommand.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.any(Array),
      ephemeral: true
    }));

    const embed = interaction.reply.mock.calls[0][0].embeds[0];
    expect(embed.data.title).toContain('每日任務進度 (伺服器離線)');
  });

  test('Tasks command fetches dynamic progress when server is online', async () => {
    UserRepository.getBindingByDiscordId.mockResolvedValue({ mc_username: 'Player1' });
    session.isActive.mockReturnValue(true);
    session.queryDailyTasks.mockResolvedValue({
      success: true,
      username: 'Player1',
      date: '2026-07-13',
      tasks: [
        { type: 1, target: 'Zombie', count: 15, reward: 250, progress: 10 },
        { type: 2, target: 'Coal Ore', count: 20, reward: 200, progress: 20 }
      ]
    });

    const interaction = {
      user: { id: 'user-bound' },
      reply: jest.fn().mockResolvedValue({}),
      deferReply: jest.fn().mockResolvedValue({}),
      editReply: jest.fn().mockResolvedValue({})
    };

    await tasksCommand.execute(interaction);

    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.any(Array)
    }));

    const embed = interaction.editReply.mock.calls[0][0].embeds[0];
    expect(embed.data.title).toContain('每日任務進度');
    expect(embed.data.description).toContain('Player1');
  });
});
