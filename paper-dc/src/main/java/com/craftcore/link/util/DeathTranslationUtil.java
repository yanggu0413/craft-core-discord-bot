package com.craftcore.link.util;

import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class DeathTranslationUtil {

    private static final Map<String, String> MOB_MAP = new HashMap<>();

    static {
        MOB_MAP.put("Zombie Villager", "殭屍村民");
        MOB_MAP.put("Zombified Piglin", "殭屍豬布林");
        MOB_MAP.put("Wither Skeleton", "凋零骷髏");
        MOB_MAP.put("Cave Spider", "洞穴蜘蛛");
        MOB_MAP.put("Elder Guardian", "遠古守衛者");
        MOB_MAP.put("Ender Dragon", "終界龍");
        MOB_MAP.put("Iron Golem", "鐵魔像");
        MOB_MAP.put("Magma Cube", "岩漿史萊姆");
        MOB_MAP.put("Polar Bear", "北極熊");
        MOB_MAP.put("Trader Llama", "流浪商人的駝羊");
        MOB_MAP.put("Zombie", "殭屍");
        MOB_MAP.put("Skeleton", "骷髏");
        MOB_MAP.put("Spider", "蜘蛛");
        MOB_MAP.put("Enderman", "終界使者");
        MOB_MAP.put("Witch", "女巫");
        MOB_MAP.put("Slime", "史萊姆");
        MOB_MAP.put("Drowned", "溺屍");
        MOB_MAP.put("Phantom", "幻翼");
        MOB_MAP.put("Creeper", "苦力怕");
        MOB_MAP.put("Allay", "悅靈");
        MOB_MAP.put("Armour Stand", "盔甲架");
        MOB_MAP.put("Arrow", "箭");
        MOB_MAP.put("Bee", "蜜蜂");
        MOB_MAP.put("Blaze", "烈焰使者");
        MOB_MAP.put("Dolphin", "海豚");
        MOB_MAP.put("Evoker", "喚魔者");
        MOB_MAP.put("Fox", "狐狸");
        MOB_MAP.put("Ghast", "地獄幽靈");
        MOB_MAP.put("Goat", "山羊");
        MOB_MAP.put("Guardian", "守衛者");
        MOB_MAP.put("Hoglin", "疣豬獸");
        MOB_MAP.put("Husk", "屍殼");
        MOB_MAP.put("Llama", "駝羊");
        MOB_MAP.put("Panda", "貓熊");
        MOB_MAP.put("Piglin Brute", "豬布林蠻兵");
        MOB_MAP.put("Piglin", "豬布林");
        MOB_MAP.put("Pillager", "掠奪者");
        MOB_MAP.put("Pufferfish", "河豚");
        MOB_MAP.put("Ravager", "劫掠獸");
        MOB_MAP.put("Shulker Bullet", "潛影貝飛彈");
        MOB_MAP.put("Shulker", "潛影貝");
        MOB_MAP.put("Silverfish", "蠹魚");
        MOB_MAP.put("Spectral Arrow", "追蹤箭矢");
        MOB_MAP.put("Stray", "流髑");
        MOB_MAP.put("Trident", "三叉戟");
        MOB_MAP.put("Vex", "惱鬼");
        MOB_MAP.put("Villager", "村民");
        MOB_MAP.put("Vindicator", "衛道士");
        MOB_MAP.put("Warden", "伏守者");
        MOB_MAP.put("Wither", "凋零怪");
        MOB_MAP.put("Wolf", "狼");
        MOB_MAP.put("Zoglin", "殭屍疣豬獸");
        MOB_MAP.put("Area Affect Cloud", "藥水效果雲");
    }

    private static String transName(String name, String username) {
        String trimmed = name.trim();
        if (trimmed.equalsIgnoreCase(username)) return "**" + username + "**";
        if (MOB_MAP.containsKey(trimmed)) return "**" + MOB_MAP.get(trimmed) + "**";
        return "**" + trimmed + "**";
    }

    private static class PatternRule {
        final Pattern pattern;
        final RuleFormatter formatter;

        PatternRule(String regex, RuleFormatter formatter) {
            this.pattern = Pattern.compile(regex, Pattern.CASE_INSENSITIVE);
            this.formatter = formatter;
        }
    }

    @FunctionalInterface
    private interface RuleFormatter {
        String format(Matcher matcher, String username);
    }

    private static final PatternRule[] RULES = new PatternRule[] {
        new PatternRule("^(.*?) walked into a cactus whi(?:le|lst) trying to escape (.*)$",
            (m, u) -> transName(m.group(1), u) + " 在試圖逃離 " + transName(m.group(2), u) + " 時撞上仙人掌死了"),
        new PatternRule("^(.*?) drowned whi(?:le|lst) trying to escape (.*)$",
            (m, u) -> transName(m.group(1), u) + " 在試圖逃離 " + transName(m.group(2), u) + " 時淹死了"),
        new PatternRule("^(.*?) experienced kinetic energy whi(?:le|lst) trying to escape (.*)$",
            (m, u) -> transName(m.group(1), u) + " 在試圖逃離 " + transName(m.group(2), u) + " 時撞牆身亡"),
        new PatternRule("^(.*?) hit the ground too hard whi(?:le|lst) trying to escape (.*)$",
            (m, u) -> transName(m.group(1), u) + " 在試圖逃離 " + transName(m.group(2), u) + " 時重摔落地身亡"),
        new PatternRule("^(.*?) fell from a high place whi(?:le|lst) trying to escape (.*)$",
            (m, u) -> transName(m.group(1), u) + " 在試圖逃離 " + transName(m.group(2), u) + " 時從高處摔下身亡"),
        new PatternRule("^(.*?)(?: was)? impaled on a stalagmite whi(?:le|lst) fighting (.*)$",
            (m, u) -> transName(m.group(1), u) + " 在與 " + transName(m.group(2), u) + " 戰鬥時被石筍刺穿了"),
        new PatternRule("^(.*?)(?: was)? squashed by a falling anvil whi(?:le|lst) fighting (.*)$",
            (m, u) -> transName(m.group(1), u) + " 在與 " + transName(m.group(2), u) + " 戰鬥時被掉落的鐵砧砸扁了"),
        new PatternRule("^(.*?)(?: was)? skewered by a falling stalactite whi(?:le|lst) fighting (.*)$",
            (m, u) -> transName(m.group(1), u) + " 在與 " + transName(m.group(2), u) + " 戰鬥時被掉落的鐘乳石刺穿了"),
        new PatternRule("^(.*?) walked into fire whi(?:le|lst) fighting (.*)$",
            (m, u) -> transName(m.group(1), u) + " 在與 " + transName(m.group(2), u) + " 戰鬥時走入火中燒死了"),
        new PatternRule("^(.*?)(?: was)? burned to a crisp whi(?:le|lst) fighting (.*)$",
            (m, u) -> transName(m.group(1), u) + " 在與 " + transName(m.group(2), u) + " 戰鬥時被燒成了灰燼"),
        new PatternRule("^(.*?) tried to swim in lava (?:to escape|whi(?:le|lst) trying to escape) (.*)$",
            (m, u) -> transName(m.group(1), u) + " 為了逃離 " + transName(m.group(2), u) + " 而試圖在岩漿中游泳"),
        new PatternRule("^(.*?)(?: was)? struck by lightning whi(?:le|lst) fighting (.*)$",
            (m, u) -> transName(m.group(1), u) + " 在與 " + transName(m.group(2), u) + " 戰鬥時被雷劈死了"),
        new PatternRule("^(.*?) walked into the danger zone due to (.*)$",
            (m, u) -> transName(m.group(1), u) + " 因為 " + transName(m.group(2), u) + " 而走進了危險區域"),
        new PatternRule("^(.*?)(?: was)? killed by magic whi(?:le|lst) trying to escape (.*)$",
            (m, u) -> transName(m.group(1), u) + " 在試圖逃離 " + transName(m.group(2), u) + " 時被魔法殺死了"),
        new PatternRule("^(.*?) froze to death whi(?:le|lst) trying to escape (.*)$",
            (m, u) -> transName(m.group(1), u) + " 在試圖逃離 " + transName(m.group(2), u) + " 時被凍死了"),
        new PatternRule("^(.*?) starved to death whi(?:le|lst) fighting (.*)$",
            (m, u) -> transName(m.group(1), u) + " 在與 " + transName(m.group(2), u) + " 戰鬥時餓死了"),
        new PatternRule("^(.*?) suffocated in a wall whi(?:le|lst) fighting (.*)$",
            (m, u) -> transName(m.group(1), u) + " 在與 " + transName(m.group(2), u) + " 戰鬥時在牆中窒息而死"),
        new PatternRule("^(.*?)(?: was)? squashed by (.*)$",
            (m, u) -> transName(m.group(1), u) + " 被 " + transName(m.group(2), u) + " 壓扁了"),
        new PatternRule("^(.*?)(?: was)? smashed by (.*) using (.*)$",
            (m, u) -> transName(m.group(1), u) + " 被 " + transName(m.group(2), u) + " 使用 **" + m.group(3) + "** 砸死了"),
        new PatternRule("^(.*?)(?: was)? smashed by (.*)$",
            (m, u) -> transName(m.group(1), u) + " 被 " + transName(m.group(2), u) + " 砸死了"),
        new PatternRule("^(.*?)(?: was)? pummeled by (.*) using (.*)$",
            (m, u) -> transName(m.group(1), u) + " 被 " + transName(m.group(2), u) + " 使用 **" + m.group(3) + "** 痛擊致死"),
        new PatternRule("^(.*?)(?: was)? pummeled by (.*)$",
            (m, u) -> transName(m.group(1), u) + " 被 " + transName(m.group(2), u) + " 痛擊致死"),
        new PatternRule("^(.*?)(?: was)? poked to death by a sweet berry bush whi(?:le|lst) trying to escape (.*)$",
            (m, u) -> transName(m.group(1), u) + " 在試圖逃離 " + transName(m.group(2), u) + " 時被甜莓灌木戳死了"),
        new PatternRule("^(.*?) didn't want to live in the same world as (.*)$",
            (m, u) -> transName(m.group(1), u) + " 不想與 " + transName(m.group(2), u) + " 活在同一個世界"),
        new PatternRule("^(.*?) withered away whi(?:le|lst) fighting (.*)$",
            (m, u) -> transName(m.group(1), u) + " 在與 " + transName(m.group(2), u) + " 戰鬥時凋零而死"),
        new PatternRule("^(.*?) went off with a bang due to a firework fired from (.*) by (.*)$",
            (m, u) -> transName(m.group(1), u) + " 因 " + transName(m.group(3), u) + " 使用 **" + m.group(2) + "** 發射的煙火爆炸而身亡"),
        new PatternRule("^(.*?)(?: was)? slain by (.*) using (.*)$",
            (m, u) -> transName(m.group(1), u) + " 被 " + transName(m.group(2), u) + " 使用 **" + m.group(3) + "** 殺死了"),
        new PatternRule("^(.*?)(?: was)? shot by (.*) using (.*)$",
            (m, u) -> transName(m.group(1), u) + " 被 " + transName(m.group(2), u) + " 使用 **" + m.group(3) + "** 射殺了"),
        new PatternRule("^(.*?)(?: was)? impaled by (.*) using (.*)$",
            (m, u) -> transName(m.group(1), u) + " 被 " + transName(m.group(2), u) + " 使用 **" + m.group(3) + "** 刺穿了"),
        new PatternRule("^(.*?)(?: was)? killed by (.*) (?:whi(?:le|lst) )?trying to hurt (.*)$",
            (m, u) -> transName(m.group(1), u) + " 在試圖傷害 " + transName(m.group(3), u) + " 時被 " + transName(m.group(2), u) + " 殺死了"),
        new PatternRule("^(.*?)(?: was)? killed by (.*) using magic$",
            (m, u) -> transName(m.group(1), u) + " 被 " + transName(m.group(2), u) + " 用魔法殺死了"),
        new PatternRule("^(.*?)(?: was)? killed by (.*) using (.*)$",
            (m, u) -> transName(m.group(1), u) + " 被 " + transName(m.group(2), u) + " 使用 **" + m.group(3) + "** 殺死了"),
        new PatternRule("^(.*?)(?: was)? killed by (.*)$",
            (m, u) -> transName(m.group(1), u) + " 被 " + transName(m.group(2), u) + " 殺死了"),
        new PatternRule("^(.*?)(?: was)? blown up by (.*) using (.*)$",
            (m, u) -> transName(m.group(1), u) + " 被 " + transName(m.group(2), u) + " 使用 **" + m.group(3) + "** 炸死了"),
        new PatternRule("^(.*?)(?: was)? blown up by (.*)$",
            (m, u) -> transName(m.group(1), u) + " 被 " + transName(m.group(2), u) + " 炸死了"),
        new PatternRule("^(.*?)(?: was)? slain by (.*)$",
            (m, u) -> transName(m.group(1), u) + " 被 " + transName(m.group(2), u) + " 殺死了"),
        new PatternRule("^(.*?)(?: was)? shot by (.*)$",
            (m, u) -> transName(m.group(1), u) + " 被 " + transName(m.group(2), u) + " 射殺了"),
        new PatternRule("^(.*?)(?: was)? impaled by (.*)$",
            (m, u) -> transName(m.group(1), u) + " 被 " + transName(m.group(2), u) + " 刺穿了"),
        new PatternRule("^(.*?)(?: was)? fireballed by (.*)$",
            (m, u) -> transName(m.group(1), u) + " 被 " + transName(m.group(2), u) + " 的火球燒死了"),
        new PatternRule("^(.*?)(?: was)? killed (?:whi(?:le|lst) )?trying to hurt (.*)$",
            (m, u) -> transName(m.group(1), u) + " 在試圖傷害 " + transName(m.group(2), u) + " 時被殺死了"),
        new PatternRule("^(.*?)(?: was)? killed$",
            (m, u) -> transName(m.group(1), u) + " 被殺死了"),
        new PatternRule("^(.*?)(?: was)? burned to a crisp$",
            (m, u) -> transName(m.group(1), u) + " 被燒成了灰燼"),
        new PatternRule("^(.*?)(?: was)? doomed to fall by (.*)$",
            (m, u) -> transName(m.group(1), u) + " 在與 " + transName(m.group(2), u) + " 戰鬥時墜落身亡"),
        new PatternRule("^(.*?)(?: was)? doomed to fall$",
            (m, u) -> transName(m.group(1), u) + " 墜落身亡"),
        new PatternRule("^(.*) was pricked to death$",
            (m, u) -> transName(m.group(1), u) + " 被仙人掌刺死了"),
        new PatternRule("^(.*) drowned$",
            (m, u) -> transName(m.group(1), u) + " 淹死了"),
        new PatternRule("^(.*) experienced kinetic energy$",
            (m, u) -> transName(m.group(1), u) + " 撞牆身亡"),
        new PatternRule("^(.*) blew up$",
            (m, u) -> transName(m.group(1), u) + " 爆炸了"),
        new PatternRule("^(.*) was killed by \\[Intentional Game Design\\]$",
            (m, u) -> transName(m.group(1), u) + " 被 [故意設計的遊戲機制] 殺死了 (例如在下界/終界睡覺)"),
        new PatternRule("^(.*) hit the ground too hard$",
            (m, u) -> transName(m.group(1), u) + " 摔得太重了"),
        new PatternRule("^(.*) fell from a high place$",
            (m, u) -> transName(m.group(1), u) + " 從高處摔了下來"),
        new PatternRule("^(.*) fell off a ladder$",
            (m, u) -> transName(m.group(1), u) + " 從梯子摔了下來"),
        new PatternRule("^(.*) fell off some vines$",
            (m, u) -> transName(m.group(1), u) + " 從藤蔓摔了下來"),
        new PatternRule("^(.*) fell off some weeping vines$",
            (m, u) -> transName(m.group(1), u) + " 從垂淚藤摔了下來"),
        new PatternRule("^(.*) fell off some twisting vines$",
            (m, u) -> transName(m.group(1), u) + " 從纏繞藤摔了下來"),
        new PatternRule("^(.*) fell while climbing$",
            (m, u) -> transName(m.group(1), u) + " 在攀爬時摔了下來"),
        new PatternRule("^(.*) fell off scaffolding$",
            (m, u) -> transName(m.group(1), u) + " 從鷹架摔了下來"),
        new PatternRule("^(.*) was impaled on a stalagmite$",
            (m, u) -> transName(m.group(1), u) + " 被石筍刺穿了"),
        new PatternRule("^(.*) was skewered by a falling stalactite$",
            (m, u) -> transName(m.group(1), u) + " 被掉落的鐘乳石刺穿了"),
        new PatternRule("^(.*) was squashed by a falling anvil$",
            (m, u) -> transName(m.group(1), u) + " 被掉落的鐵砧砸扁了"),
        new PatternRule("^(.*) went up in flames$",
            (m, u) -> transName(m.group(1), u) + " 燒起來了"),
        new PatternRule("^(.*) burned to death$",
            (m, u) -> transName(m.group(1), u) + " 被燒死了"),
        new PatternRule("^(.*) went off with a bang$",
            (m, u) -> transName(m.group(1), u) + " 因煙火爆炸而死亡"),
        new PatternRule("^(.*) tried to swim in lava$",
            (m, u) -> transName(m.group(1), u) + " 試圖在岩漿中游泳"),
        new PatternRule("^(.*) was struck by lightning$",
            (m, u) -> transName(m.group(1), u) + " 被雷劈死了"),
        new PatternRule("^(.*) discovered the floor was lava$",
            (m, u) -> transName(m.group(1), u) + " 發現地面是岩漿"),
        new PatternRule("^(.*) was killed by magic$",
            (m, u) -> transName(m.group(1), u) + " 被魔法殺死了"),
        new PatternRule("^(.*) froze to death$",
            (m, u) -> transName(m.group(1), u) + " 被凍死了"),
        new PatternRule("^(.*) starved to death$",
            (m, u) -> transName(m.group(1), u) + " 餓死了"),
        new PatternRule("^(.*) suffocated in a wall$",
            (m, u) -> transName(m.group(1), u) + " 在牆中窒息而死"),
        new PatternRule("^(.*) was squished too much$",
            (m, u) -> transName(m.group(1), u) + " 被擠壓死了"),
        new PatternRule("^(.*) was poked to death by a sweet berry bush$",
            (m, u) -> transName(m.group(1), u) + " 被甜莓灌木戳死了"),
        new PatternRule("^(.*) fell out of the world$",
            (m, u) -> transName(m.group(1), u) + " 掉出了世界外"),
        new PatternRule("^(.*) withered away$",
            (m, u) -> transName(m.group(1), u) + " 凋零而死"),
        new PatternRule("^(.*) was stung to death$",
            (m, u) -> transName(m.group(1), u) + " 被蜜蜂螫死了"),
        new PatternRule("^(.*) was obliterated by a sonically-charged shriek$",
            (m, u) -> transName(m.group(1), u) + " 被監守者的音波尖叫粉碎了"),
        new PatternRule("^(.*) was shot by a skull from Wither$",
            (m, u) -> transName(m.group(1), u) + " 被凋零怪的凋零之首射殺了"),
        new PatternRule("^(.*) died$",
            (m, u) -> transName(m.group(1), u) + " 死亡了")
    };

    public static String translate(String details, String username) {
        if (details == null || details.isEmpty()) {
            return username + " 死亡了";
        }
        for (PatternRule rule : RULES) {
            Matcher m = rule.pattern.matcher(details);
            if (m.find()) {
                return rule.formatter.format(m, username);
            }
        }
        return details.replace(username, "**" + username + "**");
    }
}
