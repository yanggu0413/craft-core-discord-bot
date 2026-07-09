const { WebhookClient, EmbedBuilder } = require('discord.js');
const config = require('../config');

function translateDeathMessage(details, username) {
  if (!details) return `${username} 死亡了`;

  const mobMap = {
    'Zombie Villager': '殭屍村民',
    'Zombified Piglin': '殭屍豬布林',
    'Wither Skeleton': '凋零骷髏',
    'Cave Spider': '洞穴蜘蛛',
    'Elder Guardian': '遠古守衛者',
    'Ender Dragon': '終界龍',
    'Iron Golem': '鐵魔像',
    'Magma Cube': '岩漿史萊姆',
    'Polar Bear': '北極熊',
    'Trader Llama': '流浪商人的駝羊',
    'Zombie': '殭屍',
    'Skeleton': '骷髏',
    'Spider': '蜘蛛',
    'Enderman': '終界使者',
    'Witch': '女巫',
    'Slime': '史萊姆',
    'Drowned': '溺屍',
    'Phantom': '幻翼',
    'Creeper': '苦力怕',
    'Allay': '悅靈',
    'Armour Stand': '盔甲架',
    'Arrow': '箭',
    'Bee': '蜜蜂',
    'Blaze': '烈焰使者',
    'Dolphin': '海豚',
    'Evoker': '喚魔者',
    'Fox': '狐狸',
    'Ghast': '地獄幽靈',
    'Goat': '山羊',
    'Guardian': '守衛者',
    'Hoglin': '疣豬獸',
    'Husk': '屍殼',
    'Llama': '駝羊',
    'Panda': '貓熊',
    'Piglin Brute': '豬布林蠻兵',
    'Piglin': '豬布林',
    'Pillager': '掠奪者',
    'Pufferfish': '河豚',
    'Ravager': '劫掠獸',
    'Shulker Bullet': '潛影貝飛彈',
    'Shulker': '潛影貝',
    'Silverfish': '蠹魚',
    'Spectral Arrow': '追蹤箭矢',
    'Stray': '流髑',
    'Trident': '三叉戟',
    'Vex': '惱鬼',
    'Villager': '村民',
    'Vindicator': '衛道士',
    'Warden': '伏守者',
    'Wither': '凋零怪',
    'Wolf': '狼',
    'Zoglin': '殭屍疣豬獸',
    'Area Affect Cloud': '藥水效果雲'
  };

  function transName(name) {
    const trimmed = name.trim();
    if (trimmed === username) return `**${username}**`;
    if (mobMap[trimmed]) return `**${mobMap[trimmed]}**`;
    return `**${trimmed}**`;
  }

  const patternRules = [
    // 1. Escaping/fighting patterns (2 targets)
    {
      regex: /^(.*) walked into a cactus whilst trying to escape (.*)$/i,
      format: (m1, m2) => `${transName(m1)} 在試圖逃離 ${transName(m2)} 時撞上仙人掌死了`
    },
    {
      regex: /^(.*) drowned whilst trying to escape (.*)$/i,
      format: (m1, m2) => `${transName(m1)} 在試圖逃離 ${transName(m2)} 時淹死了`
    },
    {
      regex: /^(.*) experienced kinetic energy whilst trying to escape (.*)$/i,
      format: (m1, m2) => `${transName(m1)} 在試圖逃離 ${transName(m2)} 時撞牆身亡`
    },
    {
      regex: /^(.*) hit the ground too hard whilst trying to escape (.*)$/i,
      format: (m1, m2) => `${transName(m1)} 在試圖逃離 ${transName(m2)} 時重摔落地身亡`
    },
    {
      regex: /^(.*) was impaled on a stalagmite whilst fighting (.*)$/i,
      format: (m1, m2) => `${transName(m1)} 在與 ${transName(m2)} 戰鬥時被石筍刺穿了`
    },
    {
      regex: /^(.*) was squashed by a falling anvil whilst fighting (.*)$/i,
      format: (m1, m2) => `${transName(m1)} 在與 ${transName(m2)} 戰鬥時被掉落的鐵砧砸扁了`
    },
    {
      regex: /^(.*) was skewered by a falling stalactite whilst fighting (.*)$/i,
      format: (m1, m2) => `${transName(m1)} 在與 ${transName(m2)} 戰鬥時被掉落的鐘乳石刺穿了`
    },
    {
      regex: /^(.*) walked into fire whilst fighting (.*)$/i,
      format: (m1, m2) => `${transName(m1)} 在與 ${transName(m2)} 戰鬥時走入火中燒死了`
    },
    {
      regex: /^(.*) tried to swim in lava to escape (.*)$/i,
      format: (m1, m2) => `${transName(m1)} 為了逃離 ${transName(m2)} 而試圖在岩漿中游泳`
    },
    {
      regex: /^(.*) was struck by lightning whilst fighting (.*)$/i,
      format: (m1, m2) => `${transName(m1)} 在與 ${transName(m2)} 戰鬥時被雷劈死了`
    },
    {
      regex: /^(.*) walked into the danger zone due to (.*)$/i,
      format: (m1, m2) => `${transName(m1)} 因為 ${transName(m2)} 而走進了危險區域`
    },
    {
      regex: /^(.*) was killed by magic whilst trying to escape (.*)$/i,
      format: (m1, m2) => `${transName(m1)} 在試圖逃離 ${transName(m2)} 時被魔法殺死了`
    },
    {
      regex: /^(.*) was frozen to death by (.*)$/i,
      format: (m1, m2) => `${transName(m1)} 被 ${transName(m2)} 凍死了`
    },
    {
      regex: /^(.*) starved to death whilst fighting (.*)$/i,
      format: (m1, m2) => `${transName(m1)} 在與 ${transName(m2)} 戰鬥時餓死了`
    },
    {
      regex: /^(.*) suffocated in a wall whilst fighting (.*)$/i,
      format: (m1, m2) => `${transName(m1)} 在與 ${transName(m2)} 戰鬥時在牆中窒息而死`
    },
    {
      regex: /^(.*) was squashed by (.*)$/i,
      format: (m1, m2) => `${transName(m1)} 被 ${transName(m2)} 壓扁了`
    },
    {
      regex: /^(.*) was poked to death by a sweet berry bush whilst trying to escape (.*)$/i,
      format: (m1, m2) => `${transName(m1)} 在試圖逃離 ${transName(m2)} 時被甜莓灌木戳死了`
    },
    {
      regex: /^(.*) didn't want to live in the same world as (.*)$/i,
      format: (m1, m2) => `${transName(m1)} 不想與 ${transName(m2)} 活在同一個世界`
    },
    {
      regex: /^(.*) withered away whilst fighting (.*)$/i,
      format: (m1, m2) => `${transName(m1)} 在與 ${transName(m2)} 戰鬥時凋零而死`
    },

    // 2. Item-related patterns (3 targets)
    {
      regex: /^(.*) went off with a bang due to a firework fired from (.*) by (.*)$/i,
      format: (m1, item, m2) => `${transName(m1)} 因 ${transName(m2)} 使用 **${item}** 發射的煙火爆炸而身亡`
    },
    {
      regex: /^(.*) was slain by (.*) using (.*)$/i,
      format: (m1, m2, item) => `${transName(m1)} 被 ${transName(m2)} 使用 **${item}** 殺死了`
    },
    {
      regex: /^(.*) was shot by (.*) using (.*)$/i,
      format: (m1, m2, item) => `${transName(m1)} 被 ${transName(m2)} 使用 **${item}** 射殺了`
    },
    {
      regex: /^(.*) was impaled by (.*) using (.*)$/i,
      format: (m1, m2, item) => `${transName(m1)} 被 ${transName(m2)} 使用 **${item}** 刺穿了`
    },
    {
      regex: /^(.*) was killed by (.*) trying to hurt (.*)$/i,
      format: (m1, item, m2) => `${transName(m1)} 在試圖傷害 ${transName(m2)} 時被 **${item}** 殺死了`
    },
    {
      regex: /^(.*) was killed by (.*) using magic$/i,
      format: (m1, m2) => `${transName(m1)} 被 ${transName(m2)} 用魔法殺死了`
    },
    {
      regex: /^(.*) was killed by (.*) using (.*)$/i,
      format: (m1, m2, item) => `${transName(m1)} 被 ${transName(m2)} 使用 **${item}** 殺死了`
    },
    {
      regex: /^(.*) was blown up by (.*) using (.*)$/i,
      format: (m1, m2, item) => `${transName(m1)} 被 ${transName(m2)} 使用 **${item}** 炸死了`
    },
    {
      regex: /^(.*) was blown up by (.*)$/i,
      format: (m1, m2) => `${transName(m1)} 被 ${transName(m2)} 炸死了`
    },

    // 3. Slain / fireballed / shot (2 targets)
    {
      regex: /^(.*) was slain by (.*)$/i,
      format: (m1, m2) => `${transName(m1)} 被 ${transName(m2)} 殺死了`
    },
    {
      regex: /^(.*) was shot by (.*)$/i,
      format: (m1, m2) => `${transName(m1)} 被 ${transName(m2)} 射殺了`
    },
    {
      regex: /^(.*) was impaled by (.*)$/i,
      format: (m1, m2) => `${transName(m1)} 被 ${transName(m2)} 刺穿了`
    },
    {
      regex: /^(.*) was fireballed by (.*)$/i,
      format: (m1, m2) => `${transName(m1)} 被 ${transName(m2)} 的火球燒死了`
    },
    {
      regex: /^(.*) was killed trying to hurt (.*)$/i,
      format: (m1, m2) => `${transName(m1)} 在試圖傷害 ${transName(m2)} 時被殺死了`
    },

    // 4. Environmental and standalone (1 target)
    {
      regex: /^(.*) was pricked to death$/i,
      format: (m1) => `${transName(m1)} 被仙人掌刺死了`
    },
    {
      regex: /^(.*) drowned$/i,
      format: (m1) => `${transName(m1)} 淹死了`
    },
    {
      regex: /^(.*) experienced kinetic energy$/i,
      format: (m1) => `${transName(m1)} 撞牆身亡`
    },
    {
      regex: /^(.*) blew up$/i,
      format: (m1) => `${transName(m1)} 爆炸了`
    },
    {
      regex: /^(.*) was killed by \[Intentional Game Design\]$/i,
      format: (m1) => `${transName(m1)} 被 [故意設計的遊戲機制] 殺死了 (例如在下界/終界睡覺)`
    },
    {
      regex: /^(.*) hit the ground too hard$/i,
      format: (m1) => `${transName(m1)} 摔得太重了`
    },
    {
      regex: /death\.fell\.accident\.water/i,
      format: () => `在水中不幸墜落`
    },
    {
      regex: /^(.*) fell from a high place$/i,
      format: (m1) => `${transName(m1)} 從高處摔了下來`
    },
    {
      regex: /^(.*) fell off a ladder$/i,
      format: (m1) => `${transName(m1)} 從梯子摔了下來`
    },
    {
      regex: /^(.*) fell off some vines$/i,
      format: (m1) => `${transName(m1)} 從藤蔓摔了下來`
    },
    {
      regex: /^(.*) fell off some weeping vines$/i,
      format: (m1) => `${transName(m1)} 從垂淚藤摔了下來`
    },
    {
      regex: /^(.*) fell off some twisting vines$/i,
      format: (m1) => `${transName(m1)} 從纏繞藤摔了下來`
    },
    {
      regex: /^(.*) fell while climbing$/i,
      format: (m1) => `${transName(m1)} 在攀爬時摔了下來`
    },
    {
      regex: /^(.*) fell off scaffolding$/i,
      format: (m1) => `${transName(m1)} 從鷹架摔了下來`
    },
    {
      regex: /^(.*) was impaled on a stalagmite$/i,
      format: (m1) => `${transName(m1)} 被石筍刺穿了`
    },
    {
      regex: /^(.*) was skewered by a falling stalactite$/i,
      format: (m1) => `${transName(m1)} 被掉落的鐘乳石刺穿了`
    },
    {
      regex: /^(.*) was squashed by a falling anvil$/i,
      format: (m1) => `${transName(m1)} 被掉落的鐵砧砸扁了`
    },
    {
      regex: /^(.*) went up in flames$/i,
      format: (m1) => `${transName(m1)} 燒起來了`
    },
    {
      regex: /^(.*) burned to death$/i,
      format: (m1) => `${transName(m1)} 被燒死了`
    },
    {
      regex: /^(.*) went off with a bang$/i,
      format: (m1) => `${transName(m1)} 因煙火爆炸而死亡`
    },
    {
      regex: /^(.*) tried to swim in lava$/i,
      format: (m1) => `${transName(m1)} 試圖在岩漿中游泳`
    },
    {
      regex: /^(.*) was struck by lightning$/i,
      format: (m1) => `${transName(m1)} 被雷劈死了`
    },
    {
      regex: /^(.*) discovered the floor was lava$/i,
      format: (m1) => `${transName(m1)} 發現地面是岩漿`
    },
    {
      regex: /^(.*) was killed by magic$/i,
      format: (m1) => `${transName(m1)} 被魔法殺死了`
    },
    {
      regex: /^(.*) froze to death$/i,
      format: (m1) => `${transName(m1)} 被凍死了`
    },
    {
      regex: /^(.*) starved to death$/i,
      format: (m1) => `${transName(m1)} 餓死了`
    },
    {
      regex: /^(.*) suffocated in a wall$/i,
      format: (m1) => `${transName(m1)} 在牆中窒息而死`
    },
    {
      regex: /^(.*) was squished too much$/i,
      format: (m1) => `${transName(m1)} 被擠壓死了`
    },
    {
      regex: /^(.*) was poked to death by a sweet berry bush$/i,
      format: (m1) => `${transName(m1)} 被甜莓灌木戳死了`
    },
    {
      regex: /^(.*) fell out of the world$/i,
      format: (m1) => `${transName(m1)} 掉出了世界外`
    },
    {
      regex: /^(.*) withered away$/i,
      format: (m1) => `${transName(m1)} 凋零而死`
    },
    {
      regex: /^(.*) was stung to death$/i,
      format: (m1) => `${transName(m1)} 被蜜蜂螫死了`
    },
    {
      regex: /^(.*) was obliterated by a sonically-charged shriek$/i,
      format: (m1) => `${transName(m1)} 被監守者的音波尖叫粉碎了`
    },
    {
      regex: /^(.*) was shot by a skull from Wither$/i,
      format: (m1) => `${transName(m1)} 被凋零怪的凋零之首射殺了`
    },
    {
      regex: /^(.*) died$/i,
      format: (m1) => `${transName(m1)} 死亡了`
    }
  ];

  for (const rule of patternRules) {
    const match = details.match(rule.regex);
    if (match) {
      return rule.format(...match.slice(1));
    }
  }

  return details.replace(username, `**${username}**`);
}

function translateAdvancement(title, desc) {
  const advMap = {
    "Stone Age": { title: "石器時代", desc: "用你的新鎬子開採石頭" },
    "Getting an Upgrade": { title: "獲取升級", desc: "製作一把更好的鎬" },
    "Acquire Hardware": { title: "獲得鐵器", desc: "冶煉一塊鐵錠" },
    "Suit Up": { title: "全副武裝", desc: "用一件鐵防具保護你自己" },
    "Not Today, Thank You": { title: "今天不行，謝謝", desc: "用盾牌擋下一發彈射物" },
    "Ice Bucket Challenge": { title: "冰桶挑戰", desc: "獲得一個黑曜石方塊" },
    "Diamonds!": { title: "鑽石！", desc: "獲得鑽石" },
    "Cover Me in Debris": { title: "用碎片保護我", desc: "獲得一套完整的獄髓防具" },
    "Enchanter": { title: "附魔師", desc: "在附魔台附魔一件物品" },
    "We Need to Go Deeper": { title: "我們需要再深入一點", desc: "建造、點燃並進入下界傳送門" },
    "Monster Hunter": { title: "怪物獵人", desc: "擊殺任意敵對怪物" },
    "Monsters Hunted": { title: "怪物獵手", desc: "擊殺每種敵對怪物各一隻" },
    "Take Aim": { title: "瞄準", desc: "用箭射中某物" },
    "Sniper Duel": { title: "狙擊手的對決", desc: "從至少 50 公尺外擊殺一隻骷髏" },
    "Bullseye": { title: "正中紅心", desc: "從至少 30 公尺外射中靶子方塊的紅心" },
    "Into Fire": { title: "進入烈火", desc: "獲得一支烈焰棒" },
    "Local Brewery": { title: "地方釀酒廠", desc: "釀造一瓶藥水" },
    "The End?": { title: "終界？", desc: "進入終界傳送門" },
    "The End.": { title: "終界。", desc: "擊殺終界龍" },
    "Great View From Up Here": { title: "這上面的風景真好", desc: "因潛影貝的攻擊而漂浮向上 50 個方塊" },
    "Sky's the Limit": { title: "展翅高飛", desc: "找到鞘翅" }
  };

  const matched = advMap[title];
  if (matched) {
    return {
      title: `${matched.title} (${title})`,
      desc: `${matched.desc}\n*${desc}*`
    };
  }
  return { title, desc };
}

async function sendChat(sender, uuid, message, discordClient) {
  if (config.discord.chatWebhookUrl) {
    try {
      const webhookClient = new WebhookClient({ url: config.discord.chatWebhookUrl });
      const avatarUrl = config.minecraft.avatarProvider.replace('{uuid}', uuid);
      await webhookClient.send({
        content: message,
        username: sender,
        avatarURL: avatarUrl
      });
      return;
    } catch (err) {
      console.warn('Failed to send message via WebhookClient, falling back:', err);
    }
  }

  // Fallback to regular channel message
  if (config.discord.channels.chatSync) {
    try {
      const channel = await discordClient.channels.fetch(config.discord.channels.chatSync);
      if (channel) {
        await channel.send(`<${sender}> ${message}`);
      }
    } catch (err) {
      console.error('Failed to send chat message to Discord:', err);
    }
  }
}

async function sendServerStart(discordClient) {
  if (!config.discord.channels.chatSync) return;
  try {
    const channel = await discordClient.channels.fetch(config.discord.channels.chatSync);
    if (channel) {
      await channel.send('✅ 伺服器已開啟');
    }
  } catch (err) {
    console.error('Failed to send server start status to Discord:', err);
  }
}

async function sendServerStop(discordClient) {
  if (!config.discord.channels.chatSync) return;
  try {
    const channel = await discordClient.channels.fetch(config.discord.channels.chatSync);
    if (channel) {
      await channel.send('❌ 伺服器已關閉');
    }
  } catch (err) {
    console.error('Failed to send server stop status to Discord:', err);
  }
}

async function sendEvent(eventType, username, uuid, details, discordClient) {
  if (!config.discord.channels.chatSync) return;

  try {
    const channel = await discordClient.channels.fetch(config.discord.channels.chatSync);
    if (!channel) return;

    const avatarUrl = config.minecraft.avatarProvider.replace('{uuid}', uuid);

    if (eventType === 'join') {
      const embed = new EmbedBuilder()
        .setColor(0x55FF55) // Light green
        .setAuthor({
          name: `${username} 加入了伺服器`,
          iconURL: avatarUrl
        });
      await channel.send({
        embeds: [embed]
      });
    } else if (eventType === 'leave') {
      const embed = new EmbedBuilder()
        .setColor(0xFF5555) // Red
        .setAuthor({
          name: `${username} 離開了伺服器`,
          iconURL: avatarUrl
        });
      await channel.send({
        embeds: [embed]
      });
    } else if (eventType === 'death') {
      const translatedMsg = translateDeathMessage(details, username);
      const embed = new EmbedBuilder()
        .setColor(0xFF5555) // Red
        .setAuthor({
          name: `${username} 死亡了`,
          iconURL: avatarUrl
        })
        .setDescription(`💀 ${translatedMsg}`);
      await channel.send({
        embeds: [embed]
      });
    } else if (eventType === 'advancement') {
      const parts = details.split('|');
      const originalTitle = parts[0] || '';
      const originalDesc = parts[1] || '';
      const itemId = parts[2] || '';

      const { title, desc } = translateAdvancement(originalTitle, originalDesc);

      const embed = new EmbedBuilder()
        .setColor(0x55FF55) // Light green
        .setTitle(`${username} 已完成進度 [${title}]`)
        .setDescription(desc);

      if (itemId) {
        const cleanItemId = itemId.replace('minecraft:', '');
        embed.setThumbnail(`https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.21.11/items/${cleanItemId}.png`);
      }

      await channel.send({
        embeds: [embed]
      });
    } else {
      await channel.send(`📢 [${eventType}] **${username}**: ${details}`);
    }
  } catch (err) {
    console.error('Failed to send game event to Discord:', err);
  }
}

module.exports = {
  sendChat,
  sendEvent,
  sendServerStart,
  sendServerStop
};
