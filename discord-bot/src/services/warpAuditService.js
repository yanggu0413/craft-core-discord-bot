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
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const SUBMIT_COOLDOWN_MS = 60 * 1000;
const submitCooldowns = new Map();

function getWarpsFilePath() {
  if (process.env.CRAFT_CORE_WARPS_FILE) {
    return path.resolve(process.env.CRAFT_CORE_WARPS_FILE);
  }

  const possiblePaths = [
    path.join(PROJECT_ROOT, 'config/craft-core-shop/warps.json'),
    path.join(PROJECT_ROOT, 'fabric-mod/config/craft-core-shop/warps.json'),
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

function normalizeWarp(warp) {
  const coords = typeof warp.coords === 'string'
    ? warp.coords.split(',').map(value => Number(value.trim()))
    : [warp.x, warp.y, warp.z];

  return {
    name: warp.name,
    x: Number(coords[0]) || 0,
    y: Number(coords[1]) || 0,
    z: Number(coords[2]) || 0,
    dimension: warp.dimension || 'minecraft:overworld'
  };
}

async function getWarpsForPanel() {
  if (session.isActive()) {
    try {
      const response = await session.queryWarps();
      if (response.success && Array.isArray(response.warps)) {
        return response.warps.map(normalizeWarp);
      }
    } catch (error) {
      logger.warn('Failed to query live warps; falling back to warps.json', { error: error.message });
    }
  }

  return Object.values(loadWarpsFromFile()).map(normalizeWarp);
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

    const warpList = await getWarpsForPanel();

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

function parseCoords(coordsStr) {
  if (!coordsStr) return null;
  const parts = coordsStr.replace(/,/g, ' ').trim().split(/\s+/).map(Number);
  if (parts.length < 3 || parts.some(Number.isNaN)) return null;
  const [x, y, z] = parts;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  if (Math.abs(x) > 30000000 || Math.abs(z) > 30000000 || y < -64 || y > 320) return null;
  return { x, y, z };
}

async function postAuditCard(client, audit, applicantMention) {
  const adminChannel = await client.channels.fetch(ADMIN_PANEL_CHANNEL_ID);
  if (!adminChannel) return;

  const isMachine = audit.type === 'machine';
  const embed = new EmbedBuilder()
    .setTitle(isMachine ? '🔧 新機器認證申請' : '📍 新公共設施 / Warp 審核申請')
    .setDescription(isMachine ? '有玩家提出了機器認證申請，請確認內容後進行審核（選擇通過等級或駁回）。' : '有玩家提出了全新公共設施審核申請，請確認內容後進行審核。')
    .addFields(
      { name: '👤 申請玩家', value: applicantMention || `\`${audit.applicant_username}\``, inline: true },
      { name: '🏷️ 名稱', value: `\`${audit.facility_name}\``, inline: true },
      { name: '📍 座標', value: `\`${audit.coords}\` (${(audit.dimension || 'minecraft:overworld').replace('minecraft:', '')})`, inline: true },
      { name: isMachine ? '🔧 機器項目' : '📝 功能與說明', value: audit.function_desc || '(無)' }
    )
    .setColor('#f39c12')
    .setTimestamp();

  const row = new ActionRowBuilder();
  if (isMachine) {
    row.addComponents(
      new ButtonBuilder().setCustomId(`btn_audit_approve_t:${audit.id}:T1`).setLabel('✅ T1').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`btn_audit_approve_t:${audit.id}:T2`).setLabel('✅ T2').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`btn_audit_approve_t:${audit.id}:T3`).setLabel('✅ T3').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`btn_audit_reject:${audit.id}`).setLabel('❌ 駁回').setStyle(ButtonStyle.Danger)
    );
  } else {
    row.addComponents(
      new ButtonBuilder().setCustomId(`btn_audit_approve:${audit.id}`).setLabel('✅ 同意通過並設立 Warp').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`btn_audit_reject:${audit.id}`).setLabel('❌ 駁回申請').setStyle(ButtonStyle.Danger)
    );
  }

  await adminChannel.send({ embeds: [embed], components: [row] });
}

async function notifyApplicant(client, audit, outcomeText) {
  if (!audit) return;
  try {
    let discordId = audit.applicant_discord_id || null;
    if (!discordId && audit.applicant_username) {
      const binding = await db.getBindingByMcUsername(audit.applicant_username);
      if (binding && binding.discord_id) discordId = binding.discord_id;
    }
    if (!discordId) return;
    const user = await client.users.fetch(discordId);
    if (!user) return;
    await discordQueue.enqueue(() => user.send({ content: outcomeText }), { type: 'audit_dm' });
  } catch (e) {
    logger.warn('Failed to send audit DM notification', { error: e.message });
  }
}

function notifyInGame(username, title, subtitle, message) {
  if (!username || !session.isActive()) return;
  try {
    session.send({ type: 'player_notify', payload: { username, title, subtitle, message } });
  } catch (e) {}
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

  const userId = interaction.user.id;

  const lastSubmit = submitCooldowns.get(userId);
  if (lastSubmit && Date.now() - lastSubmit < SUBMIT_COOLDOWN_MS) {
    const remain = Math.ceil((SUBMIT_COOLDOWN_MS - (Date.now() - lastSubmit)) / 1000);
    await interaction.reply({ content: `⏳ 提交太頻繁了！請 ${remain} 秒後再試。`, ephemeral: true });
    return;
  }

  let binding = null;
  try {
    binding = await db.getBindingByDiscordId(userId);
  } catch (e) {}
  if (!binding || !binding.mc_username) {
    await interaction.reply({ content: `❌ 尚未綁定遊戲帳號！請先在遊戲內輸入 \`/discord link\` 取得驗證碼，並私訊機器人完成綁定後再提交。`, ephemeral: true });
    return;
  }

  const parsed = parseCoords(coordsStr);
  if (!parsed) {
    await interaction.reply({ content: '❌ 座標格式錯誤！請輸入 3 個數字（如: `150 64 -200`）。', ephemeral: true });
    return;
  }

  const existing = await getWarpsForPanel();
  const existingNames = new Set(existing.map(w => w.name.toLowerCase()));
  if (existingNames.has(facilityName.toLowerCase())) {
    await interaction.reply({ content: `❌ 名稱「${facilityName}」已存在於公共傳送點，無法重複申請。`, ephemeral: true });
    return;
  }

  const mcUsername = binding.mc_username;
  let submissionId = Date.now();
  try {
    const res = await db.createAudit(mcUsername, userId, facilityName, functionDesc, coordsStr, dimensionStr, 'warp', null);
    if (res && res.lastInsertRowid) submissionId = res.lastInsertRowid;
  } catch (e) {
    logger.error('Failed to insert warp submission into SQLite', { error: e.message });
  }
  submitCooldowns.set(userId, Date.now());

  await interaction.reply({
    content: `✅ **提交成功！** 您申請的設施「**${facilityName}**」已送出審核。\n管理員審核通過後，系統將會自動建立公共傳送點 \`/warp ${facilityName}\`！`,
    ephemeral: true
  });

  try {
    const audit = { id: submissionId, applicant_username: mcUsername, applicant_discord_id: userId, facility_name: facilityName, function_desc: functionDesc, coords: coordsStr, dimension: dimensionStr, type: 'warp' };
    await postAuditCard(interaction.client, audit, `<@${userId}> (MC: \`${mcUsername}\`)`);
  } catch (adminErr) {
    logger.error('Failed to send admin audit message', { error: adminErr.message });
  }
}

async function handleMachineAuditSubmit(payload, client) {
  try {
    if (!payload || !payload.machine_id || !payload.username) return;
    const coordsStr = `${payload.x ?? 0}, ${payload.y ?? 0}, ${payload.z ?? 0}`;
    const dimension = payload.dimension || 'minecraft:overworld';
    let discordId = payload.discord_id || null;
    if (!discordId) {
      const binding = await db.getBindingByMcUsername(payload.username);
      if (binding && binding.discord_id) discordId = binding.discord_id;
    }
    let insertion = null;
    try {
      insertion = await db.createAudit(payload.username, discordId, payload.name || payload.machine_id, '', coordsStr, dimension, 'machine', payload.machine_id);
    } catch (e) {
      logger.error('Failed to insert machine audit submission', { error: e.message });
      return;
    }
    const auditId = insertion && insertion.lastInsertRowid ? insertion.lastInsertRowid : Date.now();
    const audit = { id: auditId, applicant_username: payload.username, applicant_discord_id: discordId, facility_name: payload.name || payload.machine_id, function_desc: `機器審核申請 (ID: ${payload.machine_id})`, coords: coordsStr, dimension, type: 'machine', target_id: payload.machine_id };
    await postAuditCard(client, audit, discordId ? `<@${discordId}> (MC: \`${payload.username}\`)` : `\`${payload.username}\``);
  } catch (e) {
    logger.error('Failed to handle machine audit submit', { error: e.message });
  }
}

async function handleWarpApproveButton(interaction, submissionId, tier) {
  let submission = null;
  try {
    submission = await db.getAuditById(submissionId);
  } catch (e) {}

  if (!submission) {
    await interaction.reply({ content: '❌ 找不到該審核申請資料（可能已失效）。', ephemeral: true });
    return;
  }

  const isMachine = submission.type === 'machine';
  let detail = '';
  let outcomeText = '';

  if (isMachine) {
    if (['T1', 'T2', 'T3'].includes((tier || '').toUpperCase())) {
      tier = tier.toUpperCase();
    } else {
      await interaction.reply({ content: '❌ 機器審核需選擇通過等級（T1 / T2 / T3）。', ephemeral: true });
      return;
    }
    const targetId = submission.target_id;
    if (!targetId) {
      await interaction.reply({ content: '❌ 機器申請缺少有效的伺服器端 ID。', ephemeral: true });
      return;
    }
    let cmdOk = false;
    if (session.isActive()) {
      try {
        const res = await session.executeCommand(`/machine admin approve ${targetId} ${tier}`, 'DiscordAdmin');
        cmdOk = !!res && res.success !== false;
      } catch (e) {
        cmdOk = false;
      }
    }
    if (!cmdOk) {
      await interaction.reply({ content: `❌ 機器認證執行失敗（伺服器未連線或機器不存在）。`, ephemeral: true });
      return;
    }
    detail = `（等級 ${tier}）`;
    outcomeText = `✅ **機器認證已通過 (${tier})！** 您申請的機器「**${submission.facility_name}**」已認證成功，若在線將在遊戲內收到通知。`;
  } else {
    const facilityName = submission.facility_name || ('warp_' + submissionId);
    const coordsStr = submission.coords || '0 64 0';
    const dimension = submission.dimension || 'minecraft:overworld';
    const parts = coordsStr.replace(/,/g, ' ').trim().split(/\s+/);
    const x = parseFloat(parts[0]) || 0;
    const y = parseFloat(parts[1]) || 64;
    const z = parseFloat(parts[2]) || 0;

    if (session.isActive()) {
      const result = await session.upsertWarp({ name: facilityName, x, y, z, yaw: 0, pitch: 0, dimension });
      if (!result.success) {
        throw new Error(result.message || 'Minecraft server rejected the Warp update');
      }
    } else {
      saveWarpToFile(facilityName, x, y, z, 0, 0, dimension);
    }
    detail = `並自動新增至公共傳送點 \`/warp ${facilityName}\``;
    outcomeText = `✅ **審核已通過！** 已成功核准設施「**${facilityName}**」並自動新增至公共傳送點 \`/warp ${facilityName}\`！`;
    notifyInGame(submission.applicant_username, '§a§l✔ Warp 審核通過', `§f${facilityName} 已建立為公共傳送點`, `§a[Craft-Core] 您的 Warp「${facilityName}」已通過審核並建立傳送點！`);
  }

  try {
    await db.setAuditStatus(submissionId, 'approved', interaction.user.username, tier || null);
  } catch (e) {}

  await interaction.update({
    content: `✅ **審核已通過！** ${detail}`,
    embeds: interaction.message.embeds,
    components: []
  });

  await notifyApplicant(interaction.client, submission, outcomeText);

  if (!isMachine) {
    await updateWarpPanel(interaction.client);
  }
}

async function handleWarpRejectButton(interaction, submissionId) {
  let submission = null;
  try {
    submission = await db.getAuditById(submissionId);
  } catch (e) {}

  try {
    await db.setAuditStatus(submissionId, 'rejected', interaction.user.username, null);
  } catch (e) {}

  await interaction.update({
    content: `❌ **已駁回申請！** 管理員已駁回編號 #${submissionId} 的審核申請。`,
    embeds: interaction.message.embeds,
    components: []
  });

  const outcomeText = `❌ **審核未通過**：您的申請「${submission ? submission.facility_name : ('#' + submissionId)}」已被管理員駁回。`;
  notifyInGame(submission ? submission.applicant_username : null, '§c§l✘ 審核未通過', `§f${submission ? submission.facility_name : ('#' + submissionId)}`, `§c[Craft-Core] 您的審核申請「${submission ? submission.facility_name : ('#' + submissionId)}」已被管理員駁回。`);
  await notifyApplicant(interaction.client, submission, outcomeText);
}

async function handleAuditQueryWarps(payload, client) {
  try {
    let audits = [];
    try {
      audits = await db.getPendingAudits('warp');
    } catch (e) {}
    const rows = (audits || []).map(a => ({
      id: a.id,
      name: a.facility_name,
      applicant: a.applicant_username,
      coords: a.coords,
      dimension: a.dimension || 'minecraft:overworld',
      desc: a.function_desc || ''
    }));
    session.send({
      type: 'audit_query_warps_response',
      payload: { query_id: payload.query_id || null, audits: rows }
    });
  } catch (e) {
    logger.error('Failed to handle audit_query_warps', { error: e.message });
  }
}

async function handleInGameWarpDecision(payload, client) {
  try {
    const id = payload.id;
    const action = payload.action;
    const reviewer = payload.reviewer || 'InGameAdmin';
    let submission = null;
    try {
      submission = await db.getAuditById(id);
    } catch (e) {}

    if (!submission || submission.type !== 'warp') {
      session.send({ type: 'audit_warp_decision_response', payload: { id, success: false, message: 'warp audit not found' } });
      return;
    }

    if (action === 'approve') {
      const facilityName = submission.facility_name;
      const coordsStr = submission.coords || '0 64 0';
      const dimension = submission.dimension || 'minecraft:overworld';
      const parts = coordsStr.replace(/,/g, ' ').trim().split(/\s+/);
      const x = parseFloat(parts[0]) || 0;
      const y = parseFloat(parts[1]) || 64;
      const z = parseFloat(parts[2]) || 0;
      if (session.isActive()) {
        const result = await session.upsertWarp({ name: facilityName, x, y, z, yaw: 0, pitch: 0, dimension });
        if (!result.success) throw new Error(result.message || 'server rejected');
      } else {
        saveWarpToFile(facilityName, x, y, z, 0, 0, dimension);
      }
      await db.setAuditStatus(id, 'approved', reviewer, null);
      notifyInGame(submission.applicant_username, '§a§l✔ Warp 審核通過', `§f${facilityName} 已建立為公共傳送點`, `§a[Craft-Core] 您的 Warp「${facilityName}」已通過審核並建立傳送點！`);
      session.send({ type: 'audit_warp_decision_response', payload: { id, success: true, message: 'approved' } });
      if (client) await updateWarpPanel(client);
      await notifyApplicant(client, submission, `✅ **審核已通過！** 設施「${facilityName}」已新增至公共傳送點 \`/warp ${facilityName}\`！`);
    } else {
      await db.setAuditStatus(id, 'rejected', reviewer, null);
      notifyInGame(submission.applicant_username, '§c§l✘ 審核未通過', `§f${submission.facility_name}`, `§c[Craft-Core] 您的審核申請「${submission.facility_name}」已被管理員駁回。`);
      session.send({ type: 'audit_warp_decision_response', payload: { id, success: true, message: 'rejected' } });
      await notifyApplicant(client, submission, `❌ **審核未通過**：您的申請「${submission.facility_name}」已被管理員駁回。`);
    }
  } catch (e) {
    logger.error('Failed to handle in-game warp decision', { error: e.message });
  }
}

module.exports = {
  updateWarpPanel,
  showSubmitWarpModal,
  handleWarpModalSubmit,
  handleWarpApproveButton,
  handleWarpRejectButton,
  handleMachineAuditSubmit,
  handleAuditQueryWarps,
  handleInGameWarpDecision,
  WARP_PANEL_CHANNEL_ID,
  getWarpsFilePath
};
