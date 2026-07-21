const { 
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle 
} = require('discord.js');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const logger = require('../utils/logger');
const discordQueue = require('../utils/discordQueue');
const session = require('../websocket/session');

const WARP_PANEL_CHANNEL_ID = '1524354515661492344';
const ADMIN_PANEL_CHANNEL_ID = '1524977578362933419';

function getWarpsFilePath() {
  const possiblePaths = [
    path.resolve(__dirname, '../../../../config/craft-core-shop/warps.json'),
    path.resolve(__dirname, '../../../../fabric-mod/config/craft-core-shop/warps.json'),
    path.resolve('config/craft-core-shop/warps.json')
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return possiblePaths[0];
}

function loadWarpsFromFile() {
  const filePath = getWarpsFilePath();
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw) || {};
    } catch (e) {
      logger.error('Failed to parse warps.json', { error: e.message });
    }
  }
  return {};
}

function saveWarpToFile(name, x, y, z, yaw, pitch, dimension) {
  const filePath = getWarpsFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const warps = loadWarpsFromFile();
  warps[name.toLowerCase()] = {
    name,
    x, y, z,
    yaw, pitch,
    dimension: dimension || 'minecraft:overworld'
  };
  fs.writeFileSync(filePath, JSON.stringify(warps, null, 2), 'utf8');
}

async function updateWarpPanel(client) {
  try {
    const channel = await client.channels.fetch(WARP_PANEL_CHANNEL_ID);
    if (!channel) return;

    const warpsMap = loadWarpsFromFile();
    const warpList = Object.values(warpsMap);

    let warpText = warpList.map(w => `📍 **${w.name}** \`(${Math.round(w.x)}, ${Math.round(w.y)}, ${Math.round(w.z)})\` — ${w.dimension.replace('minecraft:', '')}`).join('\n');
    if (!warpText) {
      warpText = '目前尚無已設立的公共傳送點。';
    }

    const embed = new EmbedBuilder()
      .setTitle('📍 Craft-Core 官方與玩家公共傳送點 (Warps)')
      .setDescription('歡迎使用公共傳送點控制台！您可以在遊戲內輸入 `/warp <地標>` 傳送至以下地點：')
      .addFields(
        { name: '✨ 目前開放之公共傳送點', value: warpText },
        { name: '📝 申請設立公共傳送點', value: '若您建造了刷鐵機、公共農場、紅石設施、市集或玩家小鎮，歡迎點擊下方按鈕提交審核！審核通過後將自動設立公共傳送點。' }
      )
      .setColor('#9b59b6');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_submit_warp_audit')
        .setLabel('📝 提交公共設施 / Warp 審核')
        .setStyle(ButtonStyle.Primary)
    );

    const messages = await channel.messages.fetch({ limit: 10 });
    const botMsg = messages.find(m => m.author.id === client.user.id && m.components && m.components.some(r => r.components.some(c => c.customId === 'btn_submit_warp_audit')));

    if (botMsg) {
      await discordQueue.enqueue(() => botMsg.edit({ embeds: [embed], components: [row] }), { type: 'warp_panel_edit' });
    } else {
      await discordQueue.enqueue(() => channel.send({ embeds: [embed], components: [row] }), { type: 'warp_panel_send' });
    }
  } catch (error) {
    logger.error('Failed to update Warp Panel', { error: error.message });
  }
}

async function showSubmitWarpModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('modal_submit_warp_audit')
    .setTitle('📝 提交公共設施 / Warp 審核');

  const nameInput = new TextInputBuilder()
    .setCustomId('facility_name')
    .setLabel('1. 設施/地標名稱 (例如: 刷鐵機/公共農場)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('請輸入簡短清晰的設施名稱')
    .setRequired(true);

  const descInput = new TextInputBuilder()
    .setCustomId('function_desc')
    .setLabel('2. 設施功能與說明')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('說明設施功能（如：提供免費馬鈴薯、免費鐵錠、公共附魔台...）')
    .setRequired(true);

  const coordsInput = new TextInputBuilder()
    .setCustomId('coords')
    .setLabel('3. 設施座標 X Y Z (例如: 150 64 -200)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('150 64 -200')
    .setRequired(true);

  const dimInput = new TextInputBuilder()
    .setCustomId('dimension')
    .setLabel('4. 所在世界 (選填: overworld / nether / end)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('預設為 overworld 主世界')
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(nameInput),
    new ActionRowBuilder().addComponents(descInput),
    new ActionRowBuilder().addComponents(coordsInput),
    new ActionRowBuilder().addComponents(dimInput)
  );

  await interaction.showModal(modal);
}

async function handleWarpModalSubmit(interaction) {
  const facilityName = interaction.fields.getTextInputValue('facility_name').trim();
  const functionDesc = interaction.fields.getTextInputValue('function_desc').trim();
  const coordsStr = interaction.fields.getTextInputValue('coords').trim();
  let dimensionStr = interaction.fields.getTextInputValue('dimension')?.trim() || 'overworld';

  if (!dimensionStr.startsWith('minecraft:')) {
    if (dimensionStr.includes('nether')) dimensionStr = 'minecraft:the_nether';
    else if (dimensionStr.includes('end')) dimensionStr = 'minecraft:the_end';
    else dimensionStr = 'minecraft:overworld';
  }

  // Find applicant MC username if bound
  let mcUsername = interaction.user.username;
  try {
    const row = db.prepare('SELECT mc_username FROM bindings WHERE discord_id = ?').get(interaction.user.id);
    if (row && row.mc_username) {
      mcUsername = row.mc_username;
    }
  } catch (e) {}

  // Insert into SQLite
  let submissionId = Date.now();
  try {
    const stmt = db.prepare(`
      INSERT INTO warp_submissions (applicant_username, applicant_discord_id, facility_name, function_desc, coords, dimension, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `);
    const res = stmt.run(mcUsername, interaction.user.id, facilityName, functionDesc, coordsStr, dimensionStr);
    if (res && res.lastInsertRowid) {
      submissionId = res.lastInsertRowid;
    }
  } catch (e) {
    logger.error('Failed to insert warp submission into SQLite', { error: e.message });
  }

  await interaction.reply({
    content: `✅ **提交成功！** 您申請的設施「**${facilityName}**」已送出審核。\n管理員審核通過後，系統將會自動建立公共傳送點 \`/warp ${facilityName}\`！`,
    ephemeral: true
  });

  // Send Audit Card to Admin Panel Channel
  try {
    const adminChannel = await interaction.client.channels.fetch(ADMIN_PANEL_CHANNEL_ID);
    if (adminChannel) {
      const embed = new EmbedBuilder()
        .setTitle('📍 新公共設施 / Warp 審核申請')
        .setDescription('有玩家提出了全新公共設施審核申請，請確認內容後進行審核。')
        .addFields(
          { name: '👤 申請玩家', value: `<@${interaction.user.id}> (MC: \`${mcUsername}\`)`, inline: true },
          { name: '🏷️ 設施名稱', value: `\`${facilityName}\``, inline: true },
          { name: '📍 設施座標', value: `\`${coordsStr}\` (${dimensionStr.replace('minecraft:', '')})`, inline: true },
          { name: '📝 功能與說明', value: functionDesc }
        )
        .setColor('#f39c12')
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`btn_warp_approve:${submissionId}`).setLabel('✅ 同意通過並設立 Warp').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`btn_warp_reject:${submissionId}`).setLabel('❌ 駁回申請').setStyle(ButtonStyle.Danger)
      );

      await adminChannel.send({ embeds: [embed], components: [row] });
    }
  } catch (adminErr) {
    logger.error('Failed to send admin audit message', { error: adminErr.message });
  }
}

async function handleWarpApproveButton(interaction, submissionId) {
  let submission = null;
  try {
    submission = db.prepare('SELECT * FROM warp_submissions WHERE id = ?').get(submissionId);
  } catch (e) {}

  if (!submission) {
    // Try parsing from embed fields if DB record missing
    const embed = interaction.message.embeds[0];
    if (embed) {
      const nameField = embed.fields.find(f => f.name.includes('設施名稱'));
      const coordsField = embed.fields.find(f => f.name.includes('座標'));
      submission = {
        facility_name: nameField ? nameField.value.replace(/`/g, '') : 'warp_' + submissionId,
        coords: coordsField ? coordsField.value.replace(/`/g, '').split('(')[0].trim() : '0 64 0',
        dimension: 'minecraft:overworld'
      };
    }
  }

  const facilityName = submission ? submission.facility_name : 'warp_' + submissionId;
  const coordsStr = submission ? submission.coords : '0 64 0';
  const dimension = submission ? (submission.dimension || 'minecraft:overworld') : 'minecraft:overworld';

  // Parse coords
  const parts = coordsStr.replace(/,/g, ' ').trim().split(/\s+/);
  const x = parseFloat(parts[0]) || 0;
  const y = parseFloat(parts[1]) || 64;
  const z = parseFloat(parts[2]) || 0;

  // Save to warps.json
  saveWarpToFile(facilityName, x, y, z, 0, 0, dimension);

  // Send WebSocket command if active
  if (session.isActive()) {
    session.send({
      type: 'command_request',
      payload: {
        command: `/setwarp ${facilityName}`,
        admin_username: 'Discord-Audit'
      }
    });
  }

  // Update DB status
  try {
    db.prepare("UPDATE warp_submissions SET status = 'approved', admin_reviewer = ? WHERE id = ?").run(interaction.user.username, submissionId);
  } catch (e) {}

  await interaction.update({
    content: `✅ **審核已通過！** 已成功核准設施「**${facilityName}**」並自動新增至公共傳送點 \`/warp ${facilityName}\`！`,
    embeds: interaction.message.embeds,
    components: []
  });

  // Re-update public Warp Panel
  await updateWarpPanel(interaction.client);
}

async function handleWarpRejectButton(interaction, submissionId) {
  try {
    db.prepare("UPDATE warp_submissions SET status = 'rejected', admin_reviewer = ? WHERE id = ?").run(interaction.user.username, submissionId);
  } catch (e) {}

  await interaction.update({
    content: `❌ **已駁回申請！** 管理員已駁回編號 #${submissionId} 的公共設施審核申請。`,
    embeds: interaction.message.embeds,
    components: []
  });
}

module.exports = {
  updateWarpPanel,
  showSubmitWarpModal,
  handleWarpModalSubmit,
  handleWarpApproveButton,
  handleWarpRejectButton,
  WARP_PANEL_CHANNEL_ID
};
