package com.craftcore.link.util;

import java.util.HashMap;
import java.util.Map;

public class AdvancementTranslationUtil {

    public static class AdvancementText {
        private final String title;
        private final String description;

        public AdvancementText(String title, String description) {
            this.title = title;
            this.description = description;
        }

        public String getTitle() {
            return title;
        }

        public String getDescription() {
            return description;
        }
    }

    private static final Map<String, AdvancementText> ADV_MAP = new HashMap<>();

    static {
        // Minecraft Tab
        put("Minecraft", "Minecraft", "遊戲的核心與故事");
        put("Stone Age", "石器時代", "用你的新鎬子挖掘石頭");
        put("Getting an Upgrade", "獲取升級", "製作一把更好的鎬");
        put("Acquire Hardware", "來硬的", "冶煉出鐵錠");
        put("Isn't It Iron Pick", "莫非這是鐵鎬", "升級你的鎬");
        put("Hot Stuff", "火熱的東西", "把熔岩裝進鐵桶");
        put("Suit Up", "整裝待發", "使用鐵製盔甲保護自己");
        put("Diamonds!", "鑽石！", "獲得鑽石");
        put("Ice Bucket Challenge", "冰桶挑戰", "取得一塊黑曜石");
        put("Not Today, Thank You", "抱歉，今天不行", "使用盾牌反彈投射物");
        put("Enchanter", "附魔師", "使用附魔台附魔一件物品");
        put("Cover Me with Diamonds", "用鑽石包覆我", "鑽石盔甲救人一命");
        put("We Need to Go Deeper", "我們必須更深入一點", "建造、點燃並進入地獄傳送門");
        put("Zombie Doctor", "殭屍醫生", "弱化並治好一位殭屍村民");
        put("Eye Spy", "隔牆有眼", "跟隨終界之眼");
        put("The End?", "結束了？", "進入終界傳送門");

        // Nether Tab
        put("Nether", "地獄", "攜帶夏季服飾");
        put("Oh Shiny", "金光閃閃", "用黃金使豬布林分心");
        put("Subspace Bubble", "子空間氣泡", "利用地獄在主世界旅行至七公里外");
        put("Those Were the Days", "今非昔比", "進入堡壘遺蹟");
        put("A Terrible Fortress", "可怕的要塞", "用自己的方式進入地獄要塞");
        put("Hidden in the Depths", "深藏不露", "取得遠古遺骸");
        put("Who is Cutting Onions?", "是誰在切洋蔥？", "取得哭泣的黑曜石");
        put("Return to Sender", "以牙還牙", "使用火球殺死地獄幽靈");
        put("This Boat Has Legs", "行舟", "利用扭曲蕈菇釣竿騎乘熾足獸");
        put("War Pigs", "戰豬", "掠奪一個堡壘遺蹟裡的儲物箱");
        put("Spooky Scary Skeleton", "詭異又恐怖的骷髏", "取得凋零骷髏的頭顱");
        put("Into Fire", "與火共舞", "讓烈焰使者從烈焰桿中解脫");
        put("Cover Me in Debris", "以瓦礫為壁壘", "取得全套獄髓盔甲");
        put("Not Quite \"Nine\" Lives", "非言「九」命", "將重生錨充滿能量");
        put("Uneasy Alliance", "不安的同盟", "將地獄幽靈從地獄安全的救回主世界 ... 然後讓它解脫");
        put("Hot Tourist Destinations", "熱門景點", "探索地獄所有的生態域");
        put("Feels Like Home", "溫暖如家", "在主世界的熔岩湖上和熾足獸來一段長～～途旅行");
        put("Withering Heights", "凋零山莊", "召喚凋零怪");
        put("Local Brewery", "道地的釀造坊", "釀造一瓶藥水");
        put("Bring Home the Beacon", "為家庭帶來光明", "建造及放置烽火台");
        put("A Furious Cocktail", "猛烈的雞尾酒", "同時擁有所有藥水的效果");
        put("Beaconator", "引導者", "令烽火台全力運作");
        put("How Did We Get Here?", "我們是如何走到這地步的？", "同時擁有所有狀態效果");

        // End Tab
        put("The End", "終界", "或是新的開始？");
        put("Free the End", "解放終界", "祝你好運");
        put("You Need a Mint", "你需要降火氣", "使用玻璃瓶取得龍之吐息");
        put("The Next Generation", "銀河飛龍", "取得龍蛋");
        put("Remote Getaway", "逃向遠方", "逃離這座島");
        put("The End... Again...", "終界... 再臨...", "重生終界龍");
        put("The City at the End of the Game", "終末都市", "進去吧，還能發生什麼事？");
        put("Sky's the Limit", "天下無難事", "找到鞘翅");
        put("Great View From Up Here", "上面的風景真好", "利用界伏蚌的攻擊向上飄浮50格");

        // Adventure Tab
        put("Adventure", "冒險", "冒險、探索和戰鬥");
        put("Sneak 100", "潛行力 100", "在伏聆振測器或伏守者附近潛行以避免被偵測");
        put("Crafters Crafting Crafters", "合成器合成合成器", "靠近一台正在合成合成器的合成器");
        put("Caves & Cliffs", "洞穴與山崖", "從世界的最高處（建築高度限制）落至底部並存活");
        put("Heart Transplanter", "移心接木", "將嘎枝之心以正確方向放置在兩個蒼白橡木原木之間");
        put("Sticky Situation", "陷入膠著", "跳向蜂蜜塊安全滑落地面");
        put("Monster Hunter", "魔物獵人", "殺死任何敵對怪物");
        put("Surge Protector", "突波保護器", "保護村民不受雷擊的飛來橫禍，以免發生火災");
        put("Minecraft: Trial(s) Edition", "Minecraft: 試煉版", "踏入試煉密室");
        put("Minecraft: Trials Edition", "Minecraft: 試煉版", "踏入試煉密室");
        put("Ol' Betsy", "扣下扳機", "用弩發射箭矢");
        put("The Power of Books", "知書就是力量", "使用紅石比較器讀取浮雕書櫃的紅石訊號");
        put("Isn't It Scute?", "莫非這是鱗甲？", "使用刷子從犰狳身上取得犰狳鱗甲");
        put("Respecting the Remnants", "探古尋源", "刷拭可疑的方塊以取得陶器碎片");
        put("Sweet Dreams", "甜美的夢", "在床上睡覺以變更您的重生點");
        put("Is It a Bird?", "那是鳥嗎？", "使用望遠鏡觀察鸚鵡");
        put("What a Deal!", "成交！", "成功與村民進行交易");
        put("Crafting a New Look", "鍛然一新", "使用鍛造台合成帶有紋樣的盔甲");
        put("Voluntary Exile", "自我放逐", "殺死突襲隊長。 或許該考慮暫時離村莊遠一點...");
        put("Country Lode, Take Me Home", "天涯共此石", "對磁石使用羅盤");
        put("Monsters Hunted", "獵取怪物", "殺死每種敵對怪物各一隻");
        put("It Spreads", "它蔓延了", "在伏聆觸媒旁殺死生物");
        put("Take Aim", "瞄準", "使用箭矢射擊任何東西");
        put("A Throwaway Joke", "免洗笑話", "將三叉戟擲向任何物品。 注意：拋棄你僅有的武器並不是個好主意。");
        put("Postmortal", "超越生死", "使用不死圖騰來逃避死亡");
        put("Mob Kabob", "生物串燒", "用矛在一次衝鋒攻擊內命中五隻生物");
        put("Blowback", "逆風翻盤", "反彈旋風使者的風彈來擊殺它");
        put("Lighten Up", "銅光煥發", "用斧頭為銅燈除鏽使其更加明亮");
        put("Over-Overkill", "天賜良擊", "使用重錘一擊造成50顆心的傷害");
        put("Under Lock and Key", "妥善保管", "用試煉鑰匙解鎖寶庫");
        put("Who Needs Rockets?", "誰還需要火箭？", "使用風彈將自己向上彈射 8 格");
        put("Arbalistic", "重弩手", "用弩一擊射殺五種生物");
        put("Two Birds, One Arrow", "一箭雙鵰", "使用貫穿箭矢一次殺死兩隻夜魅");
        put("Who's the Pillager Now?", "現在誰才是掠奪者？", "讓掠奪者自食其果");
        put("Careful Restoration", "精修細補", "將四塊陶器碎片組成飾紋陶罐");
        put("Adventuring Time", "探險時光", "發現每個生態域");
        put("Sound of Music", "真善美", "用唱片機的音樂為草甸注入生命力");
        put("Light as a Rabbit", "輕功雪上飄", "在粉雪上行走... 並且不陷下去");
        put("Is It a Balloon?", "那是氣球嗎？", "使用望遠鏡觀察地獄幽靈");
        put("Hired Help", "招兵買馬", "生成一隻鐵魔像以協助保衛村莊");
        put("Star Trader", "星際貿易", "在建築高度上限與村民交易");
        put("Smithing with Style", "匠心獨具", "將下列鍛造模板都至少使用一次：旋塔、豬鼻、肋骨、伏守、寂靜、惱鬼、潮汐、嚮導");
        put("Hero of the Village", "村莊英雄", "成功在突襲中守住村莊");
        put("Bullseye", "正中紅心", "從至少30公尺外擊中標靶的靶心");
        put("Sniper Duel", "狙擊手對決", "在距50公尺遠外的地方射殺一隻骷髏");
        put("Very Very Frightening", "非常驚世駭俗", "以閃電制裁村民");
        put("Is It a Plane?", "那是飛機嗎？", "使用望遠鏡觀察終界龍");
        put("Revaulting", "逢凶化吉", "用不祥試煉鑰匙解鎖不祥寶庫");

        // Husbandry Tab
        put("Husbandry", "農牧", "這個世界充滿朋友與食物");
        put("You've Got a Friend in Me", "我是你好朋友", "讓悅靈遞送物品給你");
        put("The Parrots and the Bats", "送子鳥的禮物", "促使動物繁殖");
        put("Fishy Business", "關漁生意", "捕獲一條魚");
        put("Glow and Behold!", "光輝奪目！", "使任意種類告示牌上的文字發光");
        put("Smells Interesting", "逸聞趣事", "取得嗅探獸蛋");
        put("Stay Hydrated!", "補水保濕！", "將乾癟幽靈放入水中");
        put("A Seedy Place", "汗滴禾下土", "種下一個種子並見證它的成長");
        put("Whatever Floats Your Goat!", "飄羊過海！", "與山羊一起乘船航行");
        put("Bee Our Guest", "待客蜂範", "使用營火以在不激怒蜜蜂的情況下用玻璃瓶從蜂窩中取得蜂蜜");
        put("Total Beelocation", "蜂裝物流", "使用絲綢之觸來移動裡面有3隻蜜蜂的蜂窩或蜂箱");
        put("Bukkit Bukkit", "通通進桶", "用鐵桶捕捉一隻蝌蚪");
        put("Best Friends Forever", "永遠的好搭檔", "馴服一隻動物");
        put("Uh Oh", "不妙", "讓硫磺立方怪吸收 TNT 方塊");
        put("Birthday Song", "生日快樂歌", "讓悅靈朝音階盒投出一個蛋糕");
        put("Two by Two", "成雙成對", "繁殖所有種類的動物！");
        put("Tactical Fishing", "戰術性捕魚", "釣魚... 不用釣竿！");
        put("Little Sniffs", "小小嗅探獸", "餵食一隻幼年嗅探獸");
        put("A Balanced Diet", "均衡飲食", "吃遍所有可以食用的東西，即使它們對你的身體有害");
        put("Serious Dedication", "敬業樂業", "使用獄髓錠升級一把鋤頭，然後重新衡量你的人生抉擇");
        put("Wax On", "上蠟", "為銅方塊塗上蜂蠟！");
        put("When the Squad Hops into Town", "蛙軍壓境", "用拴繩牽著所有種類的青蛙");
        put("Good as New", "復舊如新", "使用犰狳鱗甲完全修復耗損的狼鎧");
        put("Shear Brilliance", "剪潔俐落", "使用剪刀移除狼身上的狼鎧");
        put("A Complete Catalogue", "貓科全書", "馴服所有種類的貓！");
        put("The Whole Pack", "琳狼滿目", "馴服所有種類的狼");
        put("The Cutest Predator", "最可愛的捕食者", "用鐵桶捕捉一隻六角恐龍");
        put("Planting the Past", "種種往事", "種植任意嗅探獸種子");
        put("Wax Off", "除蠟", "刮除銅方塊上的蠟！");
        put("With Our Powers Combined!", "同心協力！", "在你的物品欄中集齊所有種類的蛙光體");
        put("The Healing Power of Friendship!", "療癒力滿點的友情！", "和六角恐龍結盟並贏得一場戰鬥");
    }

    private static void put(String key, String title, String desc) {
        ADV_MAP.put(key.toLowerCase(), new AdvancementText(title, desc));
    }

    public static AdvancementText translate(String originalTitle, String originalDesc) {
        if (originalTitle == null) return new AdvancementText("", originalDesc != null ? originalDesc : "");
        AdvancementText matched = ADV_MAP.get(originalTitle.trim().toLowerCase());
        if (matched != null) {
            return matched;
        }
        return new AdvancementText(originalTitle, originalDesc != null ? originalDesc : "");
    }
}
