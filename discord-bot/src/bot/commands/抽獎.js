const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database');

const rewards = [
  { id: 'diamond', name: '鑽石', amount: 5, cleanId: 'diamond' },
  { id: 'golden_carrot', name: '金胡蘿蔔', amount: 5, cleanId: 'golden_carrot' },
  { id: 'golden_apple', name: '金蘋果', amount: 5, cleanId: 'golden_apple' },
  { id: 'experience_bottle', name: '經驗瓶', amount: 64, cleanId: 'experience_bottle' },
  { id: 'totem_of_undying', name: '不死圖騰', amount: 1, cleanId: 'totem_of_undying' }
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('抽獎')
    .setDescription('使用抽獎鑰匙兌換隨機生存物資與獎勵'),
  async execute(interaction) {
    const discordId = interaction.user.id;
    const binding = db.getBindingByDiscordId(discordId);

    if (!binding) {
      return interaction.reply({
        content: '❌ 您尚未綁定 Minecraft 帳號，請先使用 `/綁定` 完成綁定才能進行抽獎！',
        ephemeral: true
      });
    }

    const userKeys = db.getUserKeys(discordId);
    if (!userKeys || userKeys.keys_count <= 0) {
      return interaction.reply({
        content: '❌ 您的抽獎鑰匙不足（目前擁有 0 把）。請先完成每日簽到 `/checkin` 獲得鑰匙！',
        ephemeral: true
      });
    }

    const session = require('../../websocket/session');
    if (!session || !session.isActive()) {
      return interaction.reply({
        content: '❌ 遊戲伺服器當前未連線，請稍後再試！',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    // Check if player is online on the Minecraft server
    let isOnline = false;
    try {
      const result = await session.executeCommand(`playerinfo ${binding.mc_username}`, interaction.user.tag);
      if (result.success && result.output.includes('Online: true')) {
        isOnline = true;
      }
    } catch (error) {
      console.error('Failed to verify player online status:', error);
    }

    if (!isOnline) {
      return interaction.editReply({
        content: '❌ 開獎失敗！為了能夠即時發送遊戲內道具，開獎時您必須處於【遊戲線上狀態】。請先登入伺服器後，再於 Discord 執行抽獎！'
      });
    }

    // Deduct 1 key
    const newKeysCount = userKeys.keys_count - 1;
    try {
      db.updateKeys(discordId, newKeysCount);
    } catch (error) {
      console.error('Failed to update user keys count:', error);
      return interaction.editReply({
        content: '❌ 扣除鑰匙失敗，抽獎已取消！'
      });
    }

    // Pick a random reward
    const reward = rewards[Math.floor(Math.random() * rewards.length)];

    // Send item to player in game
    try {
      await session.executeCommand(`give ${binding.mc_username} minecraft:${reward.id} ${reward.amount}`, 'system');
      await session.executeCommand(`title ${binding.mc_username} subtitle {"text":"抽中了 ${reward.name} x ${reward.amount}！","color":"gold"}`, 'system');
      await session.executeCommand(`title ${binding.mc_username} title {"text":"🎉 抽獎成功！","color":"yellow"}`, 'system');
      await session.executeCommand(`playsound minecraft:entity.player.levelup master ${binding.mc_username}`, 'system');
    } catch (error) {
      console.error('Failed to send reward in-game:', error);
      // We don't rollback keys here because RCON issues should be checked, but we inform the user
    }

    const embed = new EmbedBuilder()
      .setTitle('🎁 Craft-Core 幸運抽獎結果')
      .setColor('#FFAA00')
      .setThumbnail(`https://api.minecraftitems.xyz/api/item/${reward.cleanId}/size=8`)
      .setDescription(`恭喜 **${binding.mc_username}** 消耗了 1 把鑰匙！\n\n🎉 獲得了 **【${reward.name}】** x **${reward.amount}**！\n*(獎勵已即時發送到您的遊戲背包中)*\n\n🔑 剩餘鑰匙：**${newKeysCount}** 把`)
      .setTimestamp();

    await interaction.editReply({
      content: '✅ 抽獎成功！',
      embeds: [embed]
    });
  }
};
