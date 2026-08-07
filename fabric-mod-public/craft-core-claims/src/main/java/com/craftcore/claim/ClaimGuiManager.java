package com.craftcore.claim;

import com.craftcore.gui.ReadOnlyMenuHandler;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.permissions.Permissions;
import net.minecraft.world.SimpleContainer;
import net.minecraft.world.SimpleMenuProvider;
import net.minecraft.world.inventory.ContainerInput;
import net.minecraft.world.inventory.MenuType;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.component.ItemLore;
import net.minecraft.world.item.component.ResolvableProfile;

import java.util.ArrayList;
import java.util.List;

public class ClaimGuiManager {

    private static Item getItem(String id) {
        return BuiltInRegistries.ITEM.getValue(Identifier.parse(id));
    }

    private static ItemStack createGuiItem(Item item, String displayName, List<String> loreLines) {
        ItemStack stack = new ItemStack(item != null ? item : Items.PAPER);
        stack.set(DataComponents.CUSTOM_NAME, Component.literal(displayName));
        if (loreLines != null && !loreLines.isEmpty()) {
            List<Component> components = new ArrayList<>();
            for (String line : loreLines) {
                components.add(Component.literal(line));
            }
            stack.set(DataComponents.LORE, new ItemLore(components));
        }
        return stack;
    }

    public static void fillBackground(SimpleContainer container) {
        ItemStack border = createGuiItem(getItem("minecraft:gray_stained_glass_pane"), " ", null);
        for (int i = 0; i < container.getContainerSize(); i++) {
            container.setItem(i, border.copy());
        }
    }

    private static void clearInnerGrid(SimpleContainer container) {
        fillBackground(container);
        int[] innerSlots = {
                10, 11, 12, 13, 14, 15, 16,
                19, 20, 21, 22, 23, 24, 25,
                28, 29, 30, 31, 32, 33, 34,
                37, 38, 39, 40, 41, 42, 43
        };
        for (int s : innerSlots) {
            container.setItem(s, ItemStack.EMPTY);
        }
    }

    public static void openClaimMenu(ServerPlayer player) {
        if (player == null) return;
        String username = player.getName().getString();
        boolean isOp = player.createCommandSourceStack().permissions().hasPermission(Permissions.COMMANDS_OWNER);

        SimpleContainer container = new SimpleContainer(54);
        fillBackground(container);

        container.setItem(45, createGuiItem(Items.ARROW, "§a⬅ 返回主選單", List.of("§7點擊返回 /menu 大廳")));
        container.setItem(49, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉此介面")));

        // Auto-detect player standing claim
        ClaimManager.Claim standingClaim = ClaimManager.getClaimAt(player.blockPosition(), player.level());
        if (standingClaim != null && (standingClaim.owner.equalsIgnoreCase(username) || isOp)) {
            container.setItem(4, createGuiItem(Items.BEACON, "§a🛡 當前站立領地: " + (standingClaim.name != null ? standingClaim.name : standingClaim.id), List.of(
                    "§7您正站在此領地範圍內",
                    "§7- 大小: " + standingClaim.chunks + " 區塊",
                    "§7- 擁有者: " + standingClaim.owner,
                    "",
                    "§e[點擊進入詳細領地管理 GUI]"
            )));
        } else if (standingClaim != null) {
            container.setItem(4, createGuiItem(getItem("minecraft:red_stained_glass_pane"), "§c🛡 當前位置: " + standingClaim.owner + " 的領地", List.of(
                    "§7您正站在其他玩家的領地內",
                    "§7無法進行管理者控制"
            )));
        } else {
            container.setItem(4, createGuiItem(Items.MAP, "§7🛡 當前位置: 野外 (無領地)", List.of(
                    "§7手持圈地神杖選取對角點後",
                    "§7輸入 /claim 即可創建並購買劃分領地"
            )));
        }

        container.setItem(20, createGuiItem(Items.WOODEN_HOE, "§6🪄 領地劃分神杖 (/claim tool)", List.of(
                "§7點擊一鍵免費領取領地圈地神杖 (木鋤)",
                "§e- 左鍵點擊方塊: 設置點 1 (Pos1)",
                "§e- 右鍵點擊方塊: 設置點 2 (Pos2)",
                "",
                "§a[點擊直接領取神杖]"
        )));

        boolean hudEnabled = ClaimManager.isHudEnabled(player.getUUID());
        container.setItem(22, createGuiItem(Items.COMPASS, "§e🧭 ActionBar 領地抬頭提示 " + (hudEnabled ? "§a[已開啟]" : "§c[已關閉]"), List.of(
                "§7在快捷欄與血條正上方動態顯示",
                "§7您目前所在領地與領主資訊",
                "",
                "§e[點擊切換開啟 / 關閉 (指令: /claim hud)]"
        )));

        container.setItem(24, createGuiItem(Items.EMERALD, "§a💰 購買圈選領地 (/claim)", List.of(
                "§7圈選完成後，點擊創建並購買此領地",
                "",
                "§a[點擊購買領地 (/claim)]"
        )));

        container.setItem(26, createGuiItem(Items.TRIPWIRE_HOOK, "§6🔒 密碼箱控制台 (/padlock)", List.of(
                "§7設定、修改或解鎖您正前方的箱子密碼鎖",
                "",
                "§e[點擊開啟密碼箱控制 GUI]"
        )));

        List<ClaimManager.Claim> myClaims = ClaimManager.getPlayerClaims(username);
        int[] claimSlots = { 28, 29, 30, 31, 32, 33, 34 };
        int claimIdx = 0;
        for (ClaimManager.Claim c : myClaims) {
            if (claimIdx >= claimSlots.length) break;
            container.setItem(claimSlots[claimIdx++], createGuiItem(Items.GRASS_BLOCK, "§e🏠 領地: " + (c.name != null ? c.name : c.id), List.of(
                    "§7維度: " + c.dimension,
                    "§7大小: " + c.chunks + " 區塊",
                    "§7防護: PvP[" + (c.pvp ? "§a開啟" : "§c關閉") + "], 防爆[" + (c.explosion_protection ? "§a開啟" : "§c關閉") + "]",
                    "",
                    "§e[點擊開啟詳細管理 GUI]"
            )));
        }

        player.openMenu(new SimpleMenuProvider((containerId, playerInventory, p) ->
                new ReadOnlyMenuHandler(MenuType.GENERIC_9x6, containerId, playerInventory, container, 6) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            MinecraftServer server = sp.level().getServer();
                            if (server == null) return;

                            if (slotId == 45) { sp.closeContainer(); server.getCommands().performPrefixedCommand(sp.createCommandSourceStack(), "menu"); return; }
                            if (slotId == 49) { sp.closeContainer(); return; }
                            if (slotId == 20) { sp.closeContainer(); server.getCommands().performPrefixedCommand(sp.createCommandSourceStack(), "claim tool"); return; }
                            if (slotId == 22) {
                                boolean enabled = ClaimManager.toggleHud(sp.getUUID());
                                sp.sendSystemMessage(Component.literal("§b[Craft-Core] " + (enabled ? "§a已開啟快捷欄上方領地提示 (ActionBar)！" : "§c已關閉快捷欄上方領地提示 (ActionBar)。")));
                                openClaimMenu(sp);
                                return;
                            }
                            if (slotId == 24) { sp.closeContainer(); server.getCommands().performPrefixedCommand(sp.createCommandSourceStack(), "claim"); return; }
                            if (slotId == 26) { sp.closeContainer(); server.getCommands().performPrefixedCommand(sp.createCommandSourceStack(), "padlock"); return; }

                            if (slotId == 4 && standingClaim != null && (standingClaim.owner.equalsIgnoreCase(username) || isOp)) {
                                openClaimDetailGui(sp, standingClaim);
                                return;
                            }

                            ItemStack clickedStack = container.getItem(slotId);
                            if (clickedStack != null && clickedStack.has(DataComponents.CUSTOM_NAME)) {
                                String name = clickedStack.get(DataComponents.CUSTOM_NAME).getString();
                                if (name.startsWith("§e🏠 領地: ")) {
                                    String claimName = name.replace("§e🏠 領地: ", "").trim();
                                    for (ClaimManager.Claim c : myClaims) {
                                        if (claimName.equals(c.name) || claimName.equals(c.id)) {
                                            openClaimDetailGui(sp, c);
                                            return;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }, Component.literal("§1🛡 領地與保險箱選單")));
    }

    public static void openClaimDetailGui(ServerPlayer player, ClaimManager.Claim claim) {
        if (player == null || claim == null) return;
        SimpleContainer container = new SimpleContainer(54);
        fillBackground(container);

        // Slot 11: 👥 成員權限設定
        List<String> trusted = claim.permissions != null && claim.permissions.build != null ? claim.permissions.build : List.of();
        String trustedStr = trusted.isEmpty() ? "§7(無)" : "§e" + String.join(", ", trusted);
        container.setItem(11, createGuiItem(Items.PLAYER_HEAD, "§a👥 成員權限設定", List.of(
                "§7目前信任成員: " + trustedStr,
                "",
                "§e[點擊開啟信任成員管理 GUI]"
        )));

        // Slot 13: 🚩 安全旗幟開關
        container.setItem(13, createGuiItem(Items.REDSTONE_TORCH, "§6🚩 安全旗幟開關", List.of(
                "§7- 玩家 PvP: " + (claim.pvp ? "§a[開啟 - 允許 PvP]" : "§c[關閉 - 禁止 PvP]"),
                "§7- 生物生成: " + (claim.mob_spawn ? "§a[開啟 - 允許怪物生成]" : "§c[關閉 - 禁止怪物生成]"),
                "§7- 爆炸保護: " + (claim.explosion_protection ? "§a[開啟 - 100% 防爆]" : "§c[關閉 - 允許爆炸]"),
                "",
                "§e- 點擊左鍵: 切換 PvP 模式",
                "§e- 點擊右鍵: 切換 生物生成 模式",
                "§e- 點擊 Q 鍵: 切換 爆炸保護 模式"
        )));

        // Slot 15: 🔓 公共容器存取控制
        container.setItem(15, createGuiItem(Items.CHEST, "§b🔓 公共容器存取控制", List.of(
                "§7當前狀態: " + (claim.public_containers ? "§a[開啟 - 所有人均可開啟]" : "§c[關閉 - 僅限成員/擁有者]"),
                "",
                "§e[點擊切換公開容器存取權限]"
        )));

        // Slot 17: 🗑 刪除/放棄領地
        container.setItem(17, createGuiItem(Items.TNT, "§c🗑 刪除/放棄領地", List.of(
                "§7警告: 刪除此領地將解除該區域的所有保護",
                "",
                "§c[點擊確認刪除並放棄該領地]"
        )));

        container.setItem(45, createGuiItem(Items.ARROW, "§a⬅ 返回主選單", List.of("§7點擊返回 /menu 大廳")));
        container.setItem(49, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉此介面")));

        player.openMenu(new SimpleMenuProvider((containerId, playerInventory, p) ->
                new ReadOnlyMenuHandler(MenuType.GENERIC_9x6, containerId, playerInventory, container, 6) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            if (slotId == 45) {
                                MinecraftServer server = sp.level().getServer();
                                if (server != null) server.getCommands().performPrefixedCommand(sp.createCommandSourceStack(), "menu");
                                return;
                            }
                            if (slotId == 49) { sp.closeContainer(); return; }

                            if (slotId == 11) {
                                openClaimMembersGui(sp, claim);
                                return;
                            }
                            if (slotId == 13) {
                                if (button == 0 && clickType != ContainerInput.THROW) {
                                    claim.pvp = !claim.pvp;
                                    sp.sendSystemMessage(Component.literal("§a[領地] 已將 PvP 旗幟切換為: " + (claim.pvp ? "§e[開啟 - 允許 PvP]" : "§c[關閉 - 禁止 PvP]")));
                                } else if (button == 1 && clickType != ContainerInput.THROW) {
                                    claim.mob_spawn = !claim.mob_spawn;
                                    sp.sendSystemMessage(Component.literal("§a[領地] 已將生物生成旗幟切換為: " + (claim.mob_spawn ? "§e[開啟 - 允許怪物生成]" : "§c[關閉 - 禁止怪物生成]")));
                                } else if (clickType == ContainerInput.THROW) {
                                    claim.explosion_protection = !claim.explosion_protection;
                                    sp.sendSystemMessage(Component.literal("§a[領地] 已將爆炸保護旗幟切換為: " + (claim.explosion_protection ? "§e[開啟 - 100% 防爆]" : "§c[關閉 - 允許爆炸]")));
                                }
                                ClaimManager.save();
                                openClaimDetailGui(sp, claim);
                                return;
                            }
                            if (slotId == 15) {
                                claim.public_containers = !claim.public_containers;
                                ClaimManager.save();
                                sp.sendSystemMessage(Component.literal("§a[領地] 已將公共容器存取切換為: " + (claim.public_containers ? "§e[開啟 - 所有人可開啟]" : "§c[關閉 - 僅限成員]")));
                                openClaimDetailGui(sp, claim);
                                return;
                            }
                            if (slotId == 17) {
                                ClaimManager.removeClaim(claim.getId());
                                sp.sendSystemMessage(Component.literal("§a[領地] 已成功刪除與放棄領地 " + (claim.name != null ? claim.name : claim.id) + "！"));
                                openClaimMenu(sp);
                                return;
                            }
                        }
                    }
                }, Component.literal("§1🛡 領地詳細管理: " + (claim.name != null ? claim.name : claim.id))));
    }

    public static void openClaimMembersGui(ServerPlayer player, ClaimManager.Claim claim) {
        if (player == null || claim == null) return;
        SimpleContainer container = new SimpleContainer(54);
        clearInnerGrid(container);

        container.setItem(45, createGuiItem(Items.ARROW, "§a⬅ 返回領地管理", List.of("§7點擊返回領地詳細管理 GUI")));
        container.setItem(49, createGuiItem(Items.BARRIER, "§c❌ 關閉選單", List.of("§7點擊關閉此介面")));

        MinecraftServer server = player.level().getServer();
        if (server != null) {
            List<ServerPlayer> players = server.getPlayerList().getPlayers();
            int[] memberSlots = {
                    10, 11, 12, 13, 14, 15, 16,
                    19, 20, 21, 22, 23, 24, 25,
                    28, 29, 30, 31, 32, 33, 34
            };
            int idx = 0;
            for (ServerPlayer target : players) {
                if (idx >= memberSlots.length) break;
                String targetName = target.getName().getString();
                if (targetName.equalsIgnoreCase(claim.owner)) continue;

                boolean isTrusted = claim.permissions != null && claim.permissions.build != null && claim.permissions.build.contains(targetName);
                if (isTrusted) {
                    container.setItem(memberSlots[idx++], createGuiItem(Items.PLAYER_HEAD, "§a✔ 信任成員: " + targetName, List.of(
                            "§7狀態: §a已信任 (擁有建置與存取權限)",
                            "",
                            "§c[點擊取消信任 (Untrust)]"
                    )));
                } else {
                    container.setItem(memberSlots[idx++], createGuiItem(Items.PLAYER_HEAD, "§7👤 在線玩家: " + targetName, List.of(
                            "§7狀態: §c未信任",
                            "",
                            "§a[點擊新增信任 (Trust)]"
                    )));
                }
            }
        }

        player.openMenu(new SimpleMenuProvider((containerId, playerInventory, p) ->
                new ReadOnlyMenuHandler(MenuType.GENERIC_9x6, containerId, playerInventory, container, 6) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            if (slotId == 45) { openClaimDetailGui(sp, claim); return; }
                            if (slotId == 49) { sp.closeContainer(); return; }

                            ItemStack clickedStack = container.getItem(slotId);
                            if (clickedStack != null && clickedStack.has(DataComponents.CUSTOM_NAME)) {
                                String name = clickedStack.get(DataComponents.CUSTOM_NAME).getString();
                                String targetName = null;
                                if (name.startsWith("§a✔ 信任成員: ")) {
                                    targetName = name.replace("§a✔ 信任成員: ", "").trim();
                                    openMemberPermissionsGui(sp, claim, targetName);
                                    return;
                                } else if (name.startsWith("§7👤 在線玩家: ")) {
                                    targetName = name.replace("§7👤 在線玩家: ", "").trim();
                                    if (claim.permissions == null) claim.permissions = new ClaimManager.Claim.Permissions();
                                    if (claim.permissions.build == null) claim.permissions.build = new ArrayList<>();
                                    if (claim.permissions.breakBlocks == null) claim.permissions.breakBlocks = new ArrayList<>();
                                    if (claim.permissions.containers == null) claim.permissions.containers = new ArrayList<>();
                                    if (claim.permissions.interact == null) claim.permissions.interact = new ArrayList<>();

                                    if (!claim.permissions.build.contains(targetName)) claim.permissions.build.add(targetName);
                                    if (!claim.permissions.breakBlocks.contains(targetName)) claim.permissions.breakBlocks.add(targetName);
                                    if (!claim.permissions.containers.contains(targetName)) claim.permissions.containers.add(targetName);
                                    if (!claim.permissions.interact.contains(targetName)) claim.permissions.interact.add(targetName);

                                    ClaimManager.save();
                                    sp.sendSystemMessage(Component.literal("§a[領地] 已將玩家 §e" + targetName + " §a加入信任成員名單！"));
                                    openMemberPermissionsGui(sp, claim, targetName);
                                    return;
                                }
                            }
                        }
                    }
                }, Component.literal("§1👥 領地成員管理: " + (claim.name != null ? claim.name : claim.id))));
    }

    public static void openMemberPermissionsGui(ServerPlayer player, ClaimManager.Claim claim, String memberName) {
        if (player == null || claim == null || memberName == null) return;
        SimpleContainer container = new SimpleContainer(27);
        fillBackground(container);

        if (claim.permissions == null) claim.permissions = new ClaimManager.Claim.Permissions();
        if (claim.permissions.build == null) claim.permissions.build = new ArrayList<>();
        if (claim.permissions.breakBlocks == null) claim.permissions.breakBlocks = new ArrayList<>();
        if (claim.permissions.containers == null) claim.permissions.containers = new ArrayList<>();
        if (claim.permissions.interact == null) claim.permissions.interact = new ArrayList<>();

        boolean canBuild = claim.permissions.build.contains(memberName);
        boolean canBreak = claim.permissions.breakBlocks.contains(memberName);
        boolean canContainers = claim.permissions.containers.contains(memberName);
        boolean canInteract = claim.permissions.interact.contains(memberName);

        // Header Slot 4
        container.setItem(4, createGuiItem(Items.PLAYER_HEAD, "§6👤 成員細粒度權限設定: §e" + memberName, List.of(
                "§7領地名稱: §f" + (claim.name != null ? claim.name : claim.id),
                "§7獨立控制該成員在您領地內的細部行為權限"
        )));

        // Slot 10: Build
        container.setItem(10, createGuiItem(Items.BRICKS, "§b🧱 放置方塊權限 " + (canBuild ? "§a[已授權]" : "§c[未授權]"), List.of(
                "§7允許此成員在您的領地內放置方塊",
                "",
                "§e[點擊切換 放置方塊權限]"
        )));

        // Slot 12: Break
        container.setItem(12, createGuiItem(Items.DIAMOND_PICKAXE, "§e⛏️ 破壞方塊權限 " + (canBreak ? "§a[已授權]" : "§c[未授權]"), List.of(
                "§7允許此成員在您的領地內挖掘破壞方塊",
                "",
                "§e[點擊切換 破壞方塊權限]"
        )));

        // Slot 14: Containers
        container.setItem(14, createGuiItem(Items.CHEST, "§a📦 開啟箱子與容器權限 " + (canContainers ? "§a[已授權]" : "§c[未授權]"), List.of(
                "§7允許此成員開啟領地內的箱子、漏斗與熔爐",
                "",
                "§e[點擊切換 容器開啟權限]"
        )));

        // Slot 16: Interact
        container.setItem(16, createGuiItem(Items.REDSTONE_TORCH, "§d🔴 紅石/門/按鈕互動權限 " + (canInteract ? "§a[已授權]" : "§c[未授權]"), List.of(
                "§7允許此成員開關領地內的門、拉桿、按鈕",
                "",
                "§e[點擊切換 門與按鈕互動權限]"
        )));

        // Slot 22: Kick
        container.setItem(22, createGuiItem(Items.BARRIER, "§c❌ 移除此成員所有權限", List.of(
                "§7將玩家 §e" + memberName + " §7從領地信任名單完全踢除",
                "",
                "§c[點擊一鍵移除成員]"
        )));

        // Slot 26: Return
        container.setItem(26, createGuiItem(Items.ARROW, "§a⬅ 返回成員列表", List.of("§7返回上一頁")));

        player.openMenu(new SimpleMenuProvider((containerId, playerInventory, p) ->
                new ReadOnlyMenuHandler(MenuType.GENERIC_9x3, containerId, playerInventory, container, 3) {
                    @Override
                    public void handleMenuClick(int slotId, int button, ContainerInput clickType, net.minecraft.world.entity.player.Player clicker) {
                        if (clicker instanceof ServerPlayer sp) {
                            if (slotId == 26) { openClaimMembersGui(sp, claim); return; }
                            if (slotId == 10) {
                                if (canBuild) claim.permissions.build.remove(memberName);
                                else claim.permissions.build.add(memberName);
                                ClaimManager.save();
                                openMemberPermissionsGui(sp, claim, memberName);
                                return;
                            }
                            if (slotId == 12) {
                                if (canBreak) claim.permissions.breakBlocks.remove(memberName);
                                else claim.permissions.breakBlocks.add(memberName);
                                ClaimManager.save();
                                openMemberPermissionsGui(sp, claim, memberName);
                                return;
                            }
                            if (slotId == 14) {
                                if (canContainers) claim.permissions.containers.remove(memberName);
                                else claim.permissions.containers.add(memberName);
                                ClaimManager.save();
                                openMemberPermissionsGui(sp, claim, memberName);
                                return;
                            }
                            if (slotId == 16) {
                                if (canInteract) claim.permissions.interact.remove(memberName);
                                else claim.permissions.interact.add(memberName);
                                ClaimManager.save();
                                openMemberPermissionsGui(sp, claim, memberName);
                                return;
                            }
                            if (slotId == 22) {
                                claim.permissions.build.remove(memberName);
                                claim.permissions.breakBlocks.remove(memberName);
                                claim.permissions.containers.remove(memberName);
                                claim.permissions.interact.remove(memberName);
                                ClaimManager.save();
                                sp.sendSystemMessage(Component.literal("§c[領地] 已成功移除玩家 §e" + memberName + " §c的所有信任權限！"));
                                openClaimMembersGui(sp, claim);
                                return;
                            }
                        }
                    }
                }, Component.literal("§1👥 成員細粒度權限: " + memberName)));
    }
}
