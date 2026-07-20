const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const UserRepository = require('../../database/repositories/UserRepository');
const session = require('../../websocket/session');
const { getDailyTasksFallback, getTaipeiDateString } = require('../../utils/dailyTasksHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tasks')
    .setDescription('查詢您的每日任務進度'),
  async execute(interaction) {
    const discordId = interaction.user.id;
    const binding = await UserRepository.getBindingByDiscordId(discordId);

    if (!binding) {
      return interaction.reply({
        content: '❌ 您尚未綁定 Minecraft 帳號，請先私訊本機器人傳送遊戲中 \`/discord link\` 獲得的驗證碼以完成綁定！',
        ephemeral: true
      });
    }

    const dateStr = getTaipeiDateString();

    if (!session.isActive()) {
      const fallbackTasks = getDailyTasksFallback(dateStr);
      const embed = new EmbedBuilder()
        .setTitle(`📅 每日任務進度 (伺服器離線) - ${dateStr}`)
        .setColor('#e74c3c')
        .setDescription(`⚠️ 遊戲伺服器目前未連線，顯示今日每日任務定義。`)
        .addFields(
          { name: `⚔️ 擊殺任務: ${fallbackTasks[0].target}`, value: `進度: \`0/${fallbackTasks[0].count}\` (獎勵: $${fallbackTasks[0].reward}) ❌ 未完成` },
          { name: `⛏️ 挖掘任務: ${fallbackTasks[1].target}`, value: `進度: \`0/${fallbackTasks[1].count}\` (獎勵: $${fallbackTasks[1].reward}) ❌ 未完成` }
        )
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const res = await session.queryDailyTasks(binding.mc_username);
      if (res && res.success) {
        const tasks = res.tasks;
        const slayTask = tasks.find(t => t.type === 1);
        const mineTask = tasks.find(t => t.type === 2);

        const slayCompleted = slayTask.progress >= slayTask.count;
        const mineCompleted = mineTask.progress >= mineTask.count;

        const embed = new EmbedBuilder()
          .setTitle(`📅 每日任務進度 - ${res.date}`)
          .setColor('#3498db')
          .setDescription(`玩家：\`${binding.mc_username}\``)
          .addFields(
            { name: `⚔️ 擊殺任務: ${slayTask.target}`, value: `進度: \`${slayTask.progress}/${slayTask.count}\` (獎勵: $${slayTask.reward}) ${slayCompleted ? '✅ 已完成' : '❌ 未完成'}` },
            { name: `⛏️ 挖掘任務: ${mineTask.target}`, value: `進度: \`${mineTask.progress}/${mineTask.count}\` (獎勵: $${mineTask.reward}) ${mineCompleted ? '✅ 已完成' : '❌ 未完成'}` }
          )
          .setTimestamp();
        
        return interaction.editReply({ embeds: [embed] });
      } else {
        return interaction.editReply({
          content: '❌ 查詢每日任務失敗：遊戲伺服器未回應'
        });
      }
    } catch (error) {
      const fallbackTasks = getDailyTasksFallback(dateStr);
      const embed = new EmbedBuilder()
        .setTitle(`📅 每日任務進度 (查詢超時) - ${dateStr}`)
        .setColor('#e74c3c')
        .setDescription(`⚠️ 查詢伺服器超時，顯示今日每日任務定義。`)
        .addFields(
          { name: `⚔️ 擊殺任務: ${fallbackTasks[0].target}`, value: `進度: \`0/${fallbackTasks[0].count}\` (獎勵: $${fallbackTasks[0].reward}) ❌ 未完成` },
          { name: `⛏️ 挖掘任務: ${fallbackTasks[1].target}`, value: `進度: \`0/${fallbackTasks[1].count}\` (獎勵: $${fallbackTasks[1].reward}) ❌ 未完成` }
        )
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }
  }
};
