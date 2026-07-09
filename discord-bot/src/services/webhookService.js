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
    // Minecraft Tab
    "Minecraft": { title: "Minecraft", desc: "遊戲的核心與故事" },
    "Stone Age": { title: "石器時代", desc: "用你的新鎬子挖掘石頭" },
    "Getting an Upgrade": { title: "獲取升級", desc: "製作一把更好的鎬" },
    "Acquire Hardware": { title: "來硬的", desc: "冶煉出鐵錠" },
    "Isn't It Iron Pick": { title: "莫非這是鐵鎬", desc: "升級你的鎬" },
    "Hot Stuff": { title: "火熱的東西", desc: "把熔岩裝進鐵桶" },
    "Suit Up": { title: "整裝待發", desc: "使用鐵製盔甲保護自己" },
    "Diamonds!": { title: "鑽石！", desc: "獲得鑽石" },
    "Ice Bucket Challenge": { title: "冰桶挑戰", desc: "取得一塊黑曜石" },
    "Not Today, Thank You": { title: "抱歉，今天不行", desc: "使用盾牌反彈投射物" },
    "Enchanter": { title: "附魔師", desc: "使用附魔台附魔一件物品" },
    "Cover Me with Diamonds": { title: "用鑽石包覆我", desc: "鑽石盔甲救人一命" },
    "We Need to Go Deeper": { title: "我們必須更深入一點", desc: "建造、點燃並進入地獄傳送門" },
    "Zombie Doctor": { title: "殭屍醫生", desc: "弱化並治好一位殭屍村民" },
    "Eye Spy": { title: "隔牆有眼", desc: "跟隨終界之眼" },
    "The End?": { title: "結束了？", desc: "進入終界傳送門" },

    // Nether Tab
    "Nether": { title: "地獄", desc: "攜帶夏季服飾" },
    "Oh Shiny": { title: "金光閃閃", desc: "用黃金使豬布林分心" },
    "Subspace Bubble": { title: "子空間氣泡", desc: "利用地獄在主世界旅行至七公里外" },
    "Those Were the Days": { title: "今非昔比", desc: "進入堡壘遺蹟" },
    "A Terrible Fortress": { title: "可怕的要塞", desc: "用自己的方式進入地獄要塞" },
    "Hidden in the Depths": { title: "深藏不露", desc: "取得遠古遺骸" },
    "Who is Cutting Onions?": { title: "是誰在切洋蔥？", desc: "取得哭泣的黑曜石" },
    "Return to Sender": { title: "以牙還牙", desc: "使用火球殺死地獄幽靈" },
    "This Boat Has Legs": { title: "行舟", desc: "利用扭曲蕈菇釣竿騎乘熾足獸" },
    "War Pigs": { title: "戰豬", desc: "掠奪一個堡壘遺蹟裡的儲物箱" },
    "Spooky Scary Skeleton": { title: "詭異又恐怖的骷髏", desc: "取得凋零骷髏的頭顱" },
    "Into Fire": { title: "與火共舞", desc: "讓烈焰使者從烈焰桿中解脫" },
    "Cover Me in Debris": { title: "以瓦礫為壁壘", desc: "取得全套獄髓盔甲" },
    "Not Quite \"Nine\" Lives": { title: "非言「九」命", desc: "將重生錨充滿能量" },
    "Uneasy Alliance": { title: "不安的同盟", desc: "將地獄幽靈從地獄安全的救回主世界 ... 然後讓它解脫" },
    "Hot Tourist Destinations": { title: "熱門景點", desc: "探索地獄所有的生態域" },
    "Feels Like Home": { title: "溫暖如家", desc: "在主世界的熔岩湖上和熾足獸來一段長～～途旅行" },
    "Withering Heights": { title: "凋零山莊", desc: "召喚凋零怪" },
    "Local Brewery": { title: "道地的釀造坊", desc: "釀造一瓶藥水" },
    "Bring Home the Beacon": { title: "為家庭帶來光明", desc: "建造及放置烽火台" },
    "A Furious Cocktail": { title: "猛烈的雞尾酒", desc: "同時擁有所有藥水的效果" },
    "Beaconator": { title: "引導者", desc: "令烽火台全力運作" },
    "How Did We Get Here?": { title: "我們是如何走到這地步的？", desc: "同時擁有所有狀態效果" },

    // End Tab
    "The End": { title: "終界", desc: "或是新的開始？" },
    "Free the End": { title: "解放終界", desc: "祝你好運" },
    "You Need a Mint": { title: "你需要降火氣", desc: "使用玻璃瓶取得龍之吐息" },
    "The Next Generation": { title: "銀河飛龍", desc: "取得龍蛋" },
    "Remote Getaway": { title: "逃向遠方", desc: "逃離這座島" },
    "The End... Again...": { title: "終界... 再臨...", desc: "重生終界龍" },
    "The City at the End of the Game": { title: "終末都市", desc: "進去吧，還能發生什麼事？" },
    "Sky's the Limit": { title: "天下無難事", desc: "找到鞘翅" },
    "Great View From Up Here": { title: "上面的風景真好", desc: "利用界伏蚌的攻擊向上飄浮50格" },

    // Adventure Tab
    "Adventure": { title: "冒險", desc: "冒險、探索和戰鬥" },
    "Sneak 100": { title: "潛行力 100", desc: "在伏聆振測器或伏守者附近潛行以避免被偵測" },
    "Crafters Crafting Crafters": { title: "合成器合成合成器", desc: "靠近一台正在合成合成器的合成器" },
    "Caves & Cliffs": { title: "洞穴與山崖", desc: "從世界的最高處（建築高度限制）落至底部並存活" },
    "Heart Transplanter": { title: "移心接木", desc: "將嘎枝之心以正確方向放置在兩個蒼白橡木原木之間" },
    "Sticky Situation": { title: "陷入膠著", desc: "跳向蜂蜜塊安全滑落地面" },
    "Monster Hunter": { title: "魔物獵人", desc: "殺死任何敵對怪物" },
    "Surge Protector": { title: "突波保護器", desc: "保護村民不受雷擊的飛來橫禍，以免發生火災" },
    "Minecraft: Trial(s) Edition": { title: "Minecraft: 試煉版", desc: "踏入試煉密室" },
    "Minecraft: Trials Edition": { title: "Minecraft: 試煉版", desc: "踏入試煉密室" },
    "Ol' Betsy": { title: "扣下扳機", desc: "用弩發射箭矢" },
    "The Power of Books": { title: "知書就是力量", desc: "使用紅石比較器讀取浮雕書櫃的紅石訊號" },
    "Isn't It Scute?": { title: "莫非這是鱗甲？", desc: "使用刷子從犰狳身上取得犰狳鱗甲" },
    "Respecting the Remnants": { title: "探古尋源", desc: "刷拭可疑的方塊以取得陶器碎片" },
    "Sweet Dreams": { title: "甜美的夢", desc: "在床上睡覺以變更您的重生點" },
    "Is It a Bird?": { title: "那是鳥嗎？", desc: "使用望遠鏡觀察鸚鵡" },
    "What a Deal!": { title: "成交！", desc: "成功與村民進行交易" },
    "Crafting a New Look": { title: "鍛然一新", desc: "使用鍛造台合成帶有紋樣的盔甲" },
    "Voluntary Exile": { title: "自我放逐", desc: "殺死突襲隊長。 或許該考慮暫時離村莊遠一點..." },
    "Country Lode, Take Me Home": { title: "天涯共此石", desc: "對磁石使用羅盤" },
    "Monsters Hunted": { title: "獵取怪物", desc: "殺死每種敵對怪物各一隻" },
    "It Spreads": { title: "它蔓延了", desc: "在伏聆觸媒旁殺死生物" },
    "Take Aim": { title: "瞄準", desc: "使用箭矢射擊任何東西" },
    "A Throwaway Joke": { title: "免洗笑話", desc: "將三叉戟擲向任何物品。 注意：拋棄你僅有的武器並不是個好主意。" },
    "Postmortal": { title: "超越生死", desc: "使用不死圖騰來逃避死亡" },
    "Mob Kabob": { title: "生物串燒", desc: "用矛在一次衝鋒攻擊內命中五隻生物" },
    "Blowback": { title: "逆風翻盤", desc: "反彈旋風使者的風彈來擊殺它" },
    "Lighten Up": { title: "銅光煥發", desc: "用斧頭為銅燈除鏽使其更加明亮" },
    "Over-Overkill": { title: "天賜良擊", desc: "使用重錘一擊造成50顆心的傷害" },
    "Under Lock and Key": { title: "妥善保管", desc: "用試煉鑰匙解鎖寶庫" },
    "Who Needs Rockets?": { title: "誰還需要火箭？", desc: "使用風彈將自己向上彈射 8 格" },
    "Arbalistic": { title: "重弩手", desc: "用弩一擊射殺五種生物" },
    "Two Birds, One Arrow": { title: "一箭雙鵰", desc: "使用貫穿箭矢一次殺死兩隻夜魅" },
    "Who's the Pillager Now?": { title: "現在誰才是掠奪者？", desc: "讓掠奪者自食其果" },
    "Careful Restoration": { title: "精修細補", desc: "將四塊陶器碎片組成飾紋陶罐" },
    "Adventuring Time": { title: "探險時光", desc: "發現每個生態域" },
    "Sound of Music": { title: "真善美", desc: "用唱片機的音樂為草甸注入生命力" },
    "Light as a Rabbit": { title: "輕功雪上飄", desc: "在粉雪上行走... 並且不陷下去" },
    "Is It a Balloon?": { title: "那是氣球嗎？", desc: "使用望遠鏡觀察地獄幽靈" },
    "Hired Help": { title: "招兵買馬", desc: "生成一隻鐵魔像以協助保衛村莊" },
    "Star Trader": { title: "星際貿易", desc: "在建築高度上限與村民交易" },
    "Smithing with Style": { title: "匠心獨具", desc: "將下列鍛造模板都至少使用一次：旋塔、豬鼻、肋骨、伏守、寂靜、惱鬼、潮汐、嚮導" },
    "Hero of the Village": { title: "村莊英雄", desc: "成功在突襲中守住村莊" },
    "Bullseye": { title: "正中紅心", desc: "從至少30公尺外擊中標靶的靶心" },
    "Sniper Duel": { title: "狙擊手對決", desc: "在距50公尺遠外的地方射殺一隻骷髏" },
    "Very Very Frightening": { title: "非常驚世駭俗", desc: "以閃電制裁村民" },
    "Is It a Plane?": { title: "那是飛機嗎？", desc: "使用望遠鏡觀察終界龍" },
    "Revaulting": { title: "逢凶化吉", desc: "用不祥試煉鑰匙解鎖不祥寶庫" },

    // Husbandry Tab
    "Husbandry": { title: "農牧", desc: "這個世界充滿朋友與食物" },
    "You've Got a Friend in Me": { title: "我是你好朋友", desc: "讓悅靈遞送物品給你" },
    "The Parrots and the Bats": { title: "送子鳥的禮物", desc: "促使動物繁殖" },
    "Fishy Business": { title: "關漁生意", desc: "捕獲一條魚" },
    "Glow and Behold!": { title: "光輝奪目！", desc: "使任意種類告示牌上的文字發光" },
    "Smells Interesting": { title: "逸聞趣事", desc: "取得嗅探獸蛋" },
    "Stay Hydrated!": { title: "補水保濕！", desc: "將乾癟幽靈放入水中" },
    "A Seedy Place": { title: "汗滴禾下土", desc: "種下一個種子並見證它的成長" },
    "Whatever Floats Your Goat!": { title: "飄羊過海！", desc: "與山羊一起乘船航行" },
    "Bee Our Guest": { title: "待客蜂範", desc: "使用營火以在不激怒蜜蜂的情況下用玻璃瓶從蜂窩中取得蜂蜜" },
    "Total Beelocation": { title: "蜂裝物流", desc: "使用絲綢之觸來移動裡面有3隻蜜蜂的蜂窩或蜂箱" },
    "Bukkit Bukkit": { title: "通通進桶", desc: "用鐵桶捕捉一隻蝌蚪" },
    "Best Friends Forever": { title: "永遠的好搭檔", desc: "馴服一隻動物" },
    "Uh Oh": { title: "不妙", desc: "讓硫磺立方怪吸收 TNT 方塊" },
    "Birthday Song": { title: "生日快樂歌", desc: "讓悅靈朝音階盒投出一個蛋糕" },
    "Two by Two": { title: "成雙成對", desc: "繁殖所有種類的動物！" },
    "Tactical Fishing": { title: "戰術性捕魚", desc: "釣魚... 不用釣竿！" },
    "Little Sniffs": { title: "小小嗅探獸", desc: "餵食一隻幼年嗅探獸" },
    "A Balanced Diet": { title: "均衡飲食", desc: "吃遍所有可以食用的東西，即使它們對你的身體有害" },
    "Serious Dedication": { title: "敬業樂業", desc: "使用獄髓錠升級一把鋤頭，然後重新衡量你的人生抉擇" },
    "Wax On": { title: "上蠟", desc: "為銅方塊塗上蜂蠟！" },
    "When the Squad Hops into Town": { title: "蛙軍壓境", desc: "用拴繩牽著所有種類的青蛙" },
    "Good as New": { title: "復舊如新", desc: "使用犰狳鱗甲完全修復耗損的狼鎧" },
    "Shear Brilliance": { title: "剪潔俐落", desc: "使用剪刀移除狼身上的狼鎧" },
    "A Complete Catalogue": { title: "貓科全書", desc: "馴服所有種類的貓！" },
    "The Whole Pack": { title: "琳狼滿目", desc: "馴服所有種類的狼" },
    "The Cutest Predator": { title: "最可愛的捕食者", desc: "用鐵桶捕捉一隻六角恐龍" },
    "Planting the Past": { title: "種種往事", desc: "種植任意嗅探獸種子" },
    "Wax Off": { title: "除蠟", desc: "刮除銅方塊上的蠟！" },
    "With Our Powers Combined!": { title: "同心協力！", desc: "在你的物品欄中集齊所有種類的蛙光體" },
    "The Healing Power of Friendship!": { title: "療癒力滿點的友情！", desc: "和六角恐龍結盟並贏得一場戰鬥" }
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
        embed.setImage(`https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.21.11/items/${cleanItemId}.png`);
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
