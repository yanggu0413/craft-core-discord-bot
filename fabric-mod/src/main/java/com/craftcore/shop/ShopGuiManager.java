package com.craftcore.shop;

import com.craftcore.economy.EconomyManager;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.SignBlock;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.entity.RandomizableContainerBlockEntity;
import net.minecraft.world.level.block.entity.SignBlockEntity;
import net.minecraft.core.component.DataComponents;
import net.minecraft.world.item.component.ItemLore;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.Display;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.Container;
import net.minecraft.world.SimpleContainer;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.world.inventory.ChestMenu;
import net.minecraft.world.SimpleMenuProvider;
import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.inventory.MenuType;
import net.minecraft.world.inventory.ContainerInput;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundSource;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.network.chat.Component;
import net.minecraft.ChatFormatting;
import net.minecraft.resources.Identifier;
import net.minecraft.core.BlockPos;
import net.minecraft.world.phys.AABB;
import net.minecraft.core.Direction;

import java.util.ArrayList;
import java.util.List;

public class ShopGuiManager {

    private static boolean isOp(Player player) {
        if (player instanceof ServerPlayer serverPlayer) {
            return serverPlayer.createCommandSourceStack().permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER);
        }
        return false;
    }

    private static String getPlayerNameSafely(Player player) {
        if (player == null || player.getName() == null) {
            return "Unknown";
        }
        return player.getName().getString();
    }

    public static void openShopList(ServerPlayer player) {
        player.openMenu(new SimpleMenuProvider(
            (syncId, playerInv, playerEntity) -> new ShopListScreenHandler(syncId, playerInv, ShopManager.getShops(), player),
            Component.literal("Shop List")
        ));
    }

    public static void openFilteredShopList(ServerPlayer player, String query) {
        List<ShopManager.Shop> allShops = ShopManager.getShops();
        List<ShopManager.Shop> filtered = new ArrayList<>();
        for (ShopManager.Shop shop : allShops) {
            Item itemObj = BuiltInRegistries.ITEM.getValue(Identifier.parse(shop.item));
            if (TranslationManager.matches(itemObj, shop.item, query)) {
                filtered.add(shop);
            }
        }

        filtered.sort((s1, s2) -> {
            double p1 = s1.sellPrice > 0 ? s1.sellPrice : s1.price;
            double p2 = s2.sellPrice > 0 ? s2.sellPrice : s2.price;
            boolean has1 = p1 > 0;
            boolean has2 = p2 > 0;
            if (has1 && has2) {
                if (p1 != p2) {
                    return Double.compare(p1, p2);
                }
            } else if (has1) {
                return -1;
            } else if (has2) {
                return 1;
            }
            return Double.compare(s2.buyPrice, s1.buyPrice);
        });

        player.openMenu(new SimpleMenuProvider(
            (syncId, playerInv, playerEntity) -> new ShopListScreenHandler(syncId, playerInv, filtered, player),
            Component.literal("Shop Search: " + query)
        ));
    }

    public static void openSubMenu(ServerPlayer player, ShopManager.Shop shop) {
        player.openMenu(new SimpleMenuProvider(
            (syncId, playerInv, playerEntity) -> new ShopSubMenuScreenHandler(syncId, playerInv, shop, player),
            Component.literal(shop.customName != null ? shop.customName : "Manage Shop")
        ));
    }

    public static class ShopListScreenHandler extends ChestMenu {
        private final List<ShopManager.Shop> shops;
        private final ServerPlayer player;

        public ShopListScreenHandler(int syncId, Inventory playerInventory, List<ShopManager.Shop> shops, ServerPlayer player) {
            super(MenuType.GENERIC_9x6, syncId, playerInventory, new SimpleContainer(54), 6);
            this.shops = shops;
            this.player = player;

            int shopIdx = 0;
            for (int slot = 0; slot < 54 && shopIdx < shops.size(); slot++) {
                if (slot == 45 || slot == 49 || slot == 53) continue;
                ShopManager.Shop shop = shops.get(shopIdx);
                Item itemObj = BuiltInRegistries.ITEM.getValue(Identifier.parse(shop.item));
                ItemStack stack = new ItemStack(itemObj);
                stack.set(DataComponents.CUSTOM_NAME, Component.literal(shop.customName != null ? "§6" + shop.customName : "§6" + shop.player + "'s Shop"));

                List<Component> lore = new ArrayList<>();
                lore.add(Component.literal("§7Location: §f" + shop.coords));
                if (shop.sellPrice > 0 && shop.buyPrice > 0) {
                    lore.add(Component.literal("§7Price: §a售$" + shop.sellPrice + " | 收$" + shop.buyPrice));
                } else if (shop.sellPrice > 0) {
                    lore.add(Component.literal("§7Price: §a售$" + shop.sellPrice));
                } else if (shop.buyPrice > 0) {
                    lore.add(Component.literal("§7Price: §b收$" + shop.buyPrice));
                } else {
                    lore.add(Component.literal("§7Price: §a$" + shop.price));
                }
                lore.add(Component.literal("§7Stock: §e" + shop.stock));
                lore.add(Component.literal("§7Rating: §e" + ShopManager.getAverageRatingString(shop.id)));
                if (shop.player.equals(getPlayerNameSafely(player)) || isOp(player)) {
                    lore.add(Component.literal("§7Revenue: §d$" + shop.revenue));
                }
                stack.set(DataComponents.LORE, new ItemLore(lore));

                this.getContainer().setItem(slot, stack);
                shopIdx++;
            }

            ItemStack instBook = new ItemStack(Items.BOOK);
            instBook.set(DataComponents.CUSTOM_NAME, Component.literal("§e[ 商店系統說明 ]"));
            List<Component> instLore = List.of(
                Component.literal("§7- 左鍵點選列表中的商店：可選擇「傳送」或「管理」。"),
                Component.literal("§7- 建立商店：點擊下方的「新增商店」按鈕後，"),
                Component.literal("  手持商品對您的箱子按【左鍵】即可建立。"),
                Component.literal("§7- 遠端管理：商店擁有者可遠端補貨、提領營業額或註銷。"),
                Component.literal("§7- 限制：每個玩家最多建立 15 個商店 (可付費升級)。")
            );
            instBook.set(DataComponents.LORE, new ItemLore(instLore));
            this.getContainer().setItem(45, instBook);

            ItemStack addShopBtn = new ItemStack(Items.CHEST);
            addShopBtn.set(DataComponents.CUSTOM_NAME, Component.literal("§a新增商店"));
            List<Component> addLore = List.of(
                Component.literal("§7點擊以進入商店建立模式")
            );
            addShopBtn.set(DataComponents.LORE, new ItemLore(addLore));
            this.getContainer().setItem(49, addShopBtn);

            ItemStack upgradeBtn = new ItemStack(Items.DIAMOND);
            int currentUpgrades = com.craftcore.economy.EconomyManager.getUpgradedShopSlots(getPlayerNameSafely(player));
            int maxAllowed = 15 + currentUpgrades;
            double cost = com.craftcore.economy.EconomyManager.getUpgradeCost(maxAllowed);
            upgradeBtn.set(DataComponents.CUSTOM_NAME, Component.literal("§d升級商店上限"));
            List<Component> upgradeLore = List.of(
                Component.literal("§7目前上限: §e" + maxAllowed + " §7(基礎15 + 升級" + currentUpgrades + ")"),
                Component.literal("§7升級費用: §a$" + cost),
                Component.literal("§7點擊以支付金額並解鎖額外 1 個商店槽位。")
            );
            upgradeBtn.set(DataComponents.LORE, new ItemLore(upgradeLore));
            this.getContainer().setItem(53, upgradeBtn);
        }

        @Override
        public void clicked(int slotId, int button, ContainerInput clickType, Player player) {
            if (slotId == 45) {
                return;
            }
            if (slotId == 49) {
                if (player instanceof ServerPlayer spe) {
                    spe.closeContainer();
                    ShopManager.addActivationState(getPlayerNameSafely(spe));
                    spe.sendSystemMessage(Component.literal("§b[Craft-Core] §a★ 商店建立模式 ★"));
                    spe.sendSystemMessage(Component.literal("§f- 請在 30 秒內，手持欲上架的物品，對著您的箱子按【左鍵】。"));
                }
                return;
            }
            if (slotId == 53) {
                if (player instanceof ServerPlayer spe) {
                    spe.closeContainer();
                    String username = getPlayerNameSafely(spe);
                    int currentUpgrades = com.craftcore.economy.EconomyManager.getUpgradedShopSlots(username);
                    int maxAllowed = 15 + currentUpgrades;
                    double cost = com.craftcore.economy.EconomyManager.getUpgradeCost(maxAllowed);
                    double balance = com.craftcore.economy.EconomyManager.getBalance(username);
                    if (balance < cost) {
                        spe.sendSystemMessage(Component.literal("§c[Craft-Core] 金額不足，無法升級上限！"));
                        spe.playSound(SoundEvents.VILLAGER_NO, 1.0f, 1.0f);
                        return;
                    }
                    if (com.craftcore.economy.EconomyManager.upgradeShopLimit(username)) {
                        spe.sendSystemMessage(Component.literal("§b[Craft-Core] §a升級成功！您的商店上限已提升至 " + (maxAllowed + 1) + "。"));
                        spe.playSound(SoundEvents.PLAYER_LEVELUP, 1.0f, 1.0f);
                    } else {
                        spe.sendSystemMessage(Component.literal("§c[Craft-Core] 升級失敗，發生未知錯誤。"));
                        spe.playSound(SoundEvents.VILLAGER_NO, 1.0f, 1.0f);
                    }
                }
                return;
            }
            if (slotId >= 0 && slotId < 54) {
                int shopIdx = -1;
                if (slotId < 45) {
                    shopIdx = slotId;
                } else if (slotId > 45 && slotId < 49) {
                    shopIdx = slotId - 1;
                } else if (slotId > 49 && slotId < 53) {
                    shopIdx = slotId - 2;
                }
                if (shopIdx >= 0 && shopIdx < shops.size()) {
                    ShopManager.Shop shop = shops.get(shopIdx);
                    if (player instanceof ServerPlayer spe) {
                        spe.closeContainer();
                        openSubMenu(spe, shop);
                    }
                    return;
                }
                return;
            }
            super.clicked(slotId, button, clickType, player);
        }

        @Override
        public boolean stillValid(Player player) {
            return true;
        }
    }

    public static class ShopSubMenuScreenHandler extends ChestMenu {
        private final ShopManager.Shop shop;
        private final ServerPlayer player;

        public ShopSubMenuScreenHandler(int syncId, Inventory playerInventory, ShopManager.Shop shop, ServerPlayer player) {
            super(MenuType.GENERIC_9x3, syncId, playerInventory, new SimpleContainer(27), 3);
            this.shop = shop;
            this.player = player;

            ItemStack tpStack = new ItemStack(Items.ENDER_PEARL);
            tpStack.set(DataComponents.CUSTOM_NAME, Component.literal("§aTeleport to Shop"));
            List<Component> tpLore = List.of(Component.literal("§7Teleport to: §f" + shop.coords));
            tpStack.set(DataComponents.LORE, new ItemLore(tpLore));
            this.getContainer().setItem(10, tpStack);

            ItemStack backStack = new ItemStack(Items.BARRIER);
            backStack.set(DataComponents.CUSTOM_NAME, Component.literal("§cBack to List"));
            this.getContainer().setItem(12, backStack);

            boolean isOwner = shop.player.equals(getPlayerNameSafely(player)) || isOp(player);
            if (isOwner) {
                ItemStack bulkStack = new ItemStack(Items.REPEATER);
                bulkStack.set(DataComponents.CUSTOM_NAME, Component.literal("§e設定大宗交易數量"));
                List<Component> bulkLore = List.of(
                    Component.literal("§7目前設定: §e" + (shop.bulkQuantity > 1 ? shop.bulkQuantity + " 個/組" : "一般 (無限制)")),
                    Component.literal("§7點擊循環設定: 1 -> 8 -> 16 -> 32 -> 64 -> 1")
                );
                bulkStack.set(DataComponents.LORE, new ItemLore(bulkLore));
                this.getContainer().setItem(13, bulkStack);


                ItemStack withdrawStack = new ItemStack(Items.GOLD_INGOT);
                withdrawStack.set(DataComponents.CUSTOM_NAME, Component.literal("§eRemote Withdraw"));
                List<Component> withdrawLore = List.of(Component.literal("§7Pending Revenue: §d$" + shop.revenue));
                withdrawStack.set(DataComponents.LORE, new ItemLore(withdrawLore));
                this.getContainer().setItem(15, withdrawStack);

                ItemStack deleteStack = new ItemStack(Items.TNT);
                deleteStack.set(DataComponents.CUSTOM_NAME, Component.literal("§4Delete Shop"));
                this.getContainer().setItem(16, deleteStack);
            }
        }

        @Override
        public void clicked(int slotId, int button, ContainerInput clickType, Player player) {
            if (slotId >= 0 && slotId < 27) {
                if (player instanceof ServerPlayer spe) {
                    if (slotId == 10) {
                        spe.closeContainer();
                        String[] parts = shop.coords.split(",");
                        int x = Integer.parseInt(parts[0]);
                        int y = Integer.parseInt(parts[1]);
                        int z = Integer.parseInt(parts[2]);
                        spe.teleport(new net.minecraft.world.level.portal.TeleportTransition(
                            (ServerLevel) spe.level(),
                            new net.minecraft.world.phys.Vec3(x + 0.5, y + 1.0, z + 0.5),
                            net.minecraft.world.phys.Vec3.ZERO,
                            spe.getYRot(), spe.getXRot(),
                            net.minecraft.world.level.portal.TeleportTransition.DO_NOTHING
                        ));
                        spe.sendSystemMessage(Component.literal("§b[Craft-Core] §fTeleported to " + shop.coords));
                    } else if (slotId == 12) {
                        spe.closeContainer();
                        openShopList(spe);
                    } else {
                        boolean isOwner = shop.player.equals(getPlayerNameSafely(spe)) || isOp(spe);
                        if (isOwner) {
                            if (slotId == 13) {
                                int currentBulk = shop.bulkQuantity;
                                int nextBulk = 1;
                                if (currentBulk == 1) nextBulk = 8;
                                else if (currentBulk == 8) nextBulk = 16;
                                else if (currentBulk == 16) nextBulk = 32;
                                else if (currentBulk == 32) nextBulk = 64;
                                else nextBulk = 1;
                                
                                ShopManager.setBulkQuantity(shop.id, nextBulk);
                                spe.closeContainer();
                                openSubMenu(spe, shop);
                                spe.sendSystemMessage(Component.literal("§b[Craft-Core] §f已將大宗交易數量設定為: " + (nextBulk > 1 ? nextBulk + " 個/組" : "一般")));
                                spe.playSound(SoundEvents.NOTE_BLOCK_PLING.value(), 1.0f, 1.0f);
                            } else if (slotId == 15) {
                                spe.closeContainer();
                                String res = ShopManager.clickShopGUI(getPlayerNameSafely(spe), shop.coords, "withdraw", isOp(spe));
                                spe.sendSystemMessage(Component.literal("§b[Craft-Core] §f" + res));
                                if (res.startsWith("Withdrew")) {
                                    spe.playSound(SoundEvents.EXPERIENCE_ORB_PICKUP, 1.0f, 1.0f);
                                }
                            } else if (slotId == 16) {
                                spe.closeContainer();
                                String[] parts = shop.coords.split(",");
                                int x = Integer.parseInt(parts[0]);
                                int y = Integer.parseInt(parts[1]);
                                int z = Integer.parseInt(parts[2]);
                                BlockPos shopPos = new BlockPos(x, y, z);
                                cleanupShopVisuals((ServerLevel) spe.level(), shopPos);
                                String res = ShopManager.clickShopGUI(getPlayerNameSafely(spe), shop.coords, "delete", isOp(spe));
                                spe.sendSystemMessage(Component.literal("§b[Craft-Core] §f" + res));
                            }
                        }
                    }
                }
                return;
            }
            super.clicked(slotId, button, clickType, player);
        }

        @Override
        public boolean stillValid(Player player) {
            return true;
        }
    }

    public static class EconomyScreenHandler extends ChestMenu {
        private final ServerPlayer player;

        public EconomyScreenHandler(int syncId, Inventory playerInventory, ServerPlayer player) {
            super(MenuType.GENERIC_9x3, syncId, playerInventory, new SimpleContainer(27), 3);
            this.player = player;

            ItemStack instBook = new ItemStack(Items.BOOK);
            instBook.set(DataComponents.CUSTOM_NAME, Component.literal("§e[ 回收系統說明 ]"));
            List<Component> instLore = List.of(
                Component.literal("§7- 請將欲兌換的物品放入左側的 0-25 號槽位。"),
                Component.literal("§7- 放入後，點選右下角的綠色羊毛確認兌換。"),
                Component.literal("§7- 剩餘或不符的物品將在關閉選單時退回背包。"),
                Component.literal("§e★ 兌換價格："),
                Component.literal("  - 煤炭: $10 | 銅錠: $20 | 鐵錠: $50"),
                Component.literal("  - 鑽石: $500 | 獄髓碎片: $2000"),
                Component.literal("  - 石頭/鵝卵石/深板岩等: 每個 $2 (每日限 80 個)"),
                Component.literal("  - 泥土/沙子等其他垃圾: 每個 $0.5 (每日限 80 個)")
            );
            instBook.set(DataComponents.LORE, new ItemLore(instLore));
            this.getContainer().setItem(25, instBook);

            ItemStack greenWool = new ItemStack(Items.WOOL.green());
            greenWool.set(DataComponents.CUSTOM_NAME, Component.literal("§aClick to Sell Items"));
            List<Component> lore = List.of(Component.literal("§7Places items in slots 0-24"), Component.literal("§7and click here to sell them."));
            greenWool.set(DataComponents.LORE, new ItemLore(lore));
            this.getContainer().setItem(26, greenWool);
        }

        @Override
        public void clicked(int slotId, int button, ContainerInput clickType, Player player) {
            if (slotId == 25) {
                return;
            }
            if (slotId == 26) {
                int totalSold = 0;
                int totalRejected = 0;
                double totalEarned = 0;

                for (int i = 0; i < 25; i++) {
                    ItemStack stack = this.getContainer().getItem(i);
                    if (!stack.isEmpty()) {
                        String itemId = BuiltInRegistries.ITEM.getKey(stack.getItem()).toString();
                        EconomyManager.SellResult result = EconomyManager.sellItem(
                            getPlayerNameSafely(player), itemId, stack.getCount()
                        );

                        if (result.soldCount > 0) {
                            totalSold += result.soldCount;
                            totalEarned += result.moneyEarned;
                            if (result.rejectedCount > 0) {
                                stack.setCount(result.rejectedCount);
                                this.getContainer().setItem(i, stack);
                            } else {
                                this.getContainer().setItem(i, ItemStack.EMPTY);
                            }
                        } else {
                            totalRejected += result.rejectedCount;
                        }
                    }
                }

                if (totalSold > 0) {
                    player.sendSystemMessage(Component.literal("§b[Craft-Core] §fSuccessfully sold §a" + totalSold + " §fitems, earning §a$" + totalEarned + "§f."));
                    player.playSound(SoundEvents.EXPERIENCE_ORB_PICKUP, 1.0f, 1.0f);
                }
                if (totalRejected > 0) {
                    player.sendSystemMessage(Component.literal("§c[Craft-Core] §f" + totalRejected + " items were rejected (limit reached or invalid items)."));
                }
                if (totalSold == 0 && totalRejected == 0) {
                    player.sendSystemMessage(Component.literal("§c[Craft-Core] No items to sell! Place items in slots 0-24."));
                }
                this.broadcastChanges();
                return;
            }
            super.clicked(slotId, button, clickType, player);
        }

        @Override
        public void removed(Player player) {
            super.removed(player);
            if (player instanceof ServerPlayer serverPlayer) {
                for (int i = 0; i < 25; i++) {
                    ItemStack stack = this.getContainer().getItem(i);
                    if (!stack.isEmpty()) {
                        serverPlayer.getInventory().placeItemBackInInventory(stack);
                    }
                }
            }
        }

        @Override
        public boolean stillValid(Player player) {
            return true;
        }
    }

    public static void spawnShopVisuals(ServerLevel world, BlockPos pos, String player, String item, double sellPrice, double buyPrice) {
        try {
            var chestState = world.getBlockState(pos);
            Direction facing = Direction.NORTH;
            if (chestState.getBlock() instanceof net.minecraft.world.level.block.ChestBlock && chestState.hasProperty(net.minecraft.world.level.block.ChestBlock.FACING)) {
                facing = chestState.getValue(net.minecraft.world.level.block.ChestBlock.FACING);
            }
            BlockPos signPos = pos.relative(facing);
            world.setBlock(signPos, Blocks.OAK_WALL_SIGN.defaultBlockState().setValue(net.minecraft.world.level.block.WallSignBlock.FACING, facing), 3);

            String coords = pos.getX() + "," + pos.getY() + "," + pos.getZ();
            String dimension = world.dimension().identifier().toString();
            String key = dimension + ":" + coords;
            ShopManager.Shop shop = ShopManager.getShop(key);
            if (shop != null) {
                ShopManager.updateShopSign(world, pos, shop);
            } else {
                BlockEntity be = world.getBlockEntity(signPos);
                if (be instanceof SignBlockEntity sign) {
                    Item itemObj = BuiltInRegistries.ITEM.getValue(Identifier.parse(item));
                    Component line3Text;
                    if (itemObj != Items.AIR) {
                        line3Text = Component.translatable(itemObj.getDescriptionId());
                    } else {
                        line3Text = Component.literal(item.replace("minecraft:", ""));
                    }
                    
                    String line4Str = "";
                    if (sellPrice > 0 && buyPrice > 0) {
                        line4Str = "§a售" + sellPrice + " | 收" + buyPrice;
                    } else if (sellPrice > 0) {
                        line4Str = "§a售: " + sellPrice;
                    } else if (buyPrice > 0) {
                        line4Str = "§a收: " + buyPrice;
                    }
                    final String finalLine4 = line4Str;

                    sign.updateText(text -> text.setHasGlowingText(true).setMessage(0, Component.literal("§1[商店]")).setMessage(1, Component.literal(player)).setMessage(2, line3Text).setMessage(3, Component.literal(finalLine4)), true);
                    sign.setChanged();
                    world.sendBlockUpdated(signPos, sign.getBlockState(), sign.getBlockState(), 3);
                }
            }

            Item itemObj = BuiltInRegistries.ITEM.getValue(Identifier.parse(item));
            if (itemObj != Items.AIR) {
                Display.ItemDisplay itemDisplay = new Display.ItemDisplay(net.minecraft.world.entity.EntityTypes.ITEM_DISPLAY, world);
                itemDisplay.setItemStack(new ItemStack(itemObj));
                itemDisplay.setPos(pos.getX() + 0.5, pos.getY() + 1.1, pos.getZ() + 0.5);
                itemDisplay.setBillboardConstraints(Display.BillboardConstraints.CENTER);
                itemDisplay.setTransformation(new com.mojang.math.Transformation(new org.joml.Vector3f(0f, 0f, 0f), new org.joml.Quaternionf(0f, 0f, 0f, 1f), new org.joml.Vector3f(0.5f, 0.5f, 0.5f), new org.joml.Quaternionf(0f, 0f, 0f, 1f)));
                world.addFreshEntity(itemDisplay);
            }
        } catch (Throwable t) {
            System.err.println("[CraftCore] Failed to spawn shop visuals: " + t.getMessage());
            t.printStackTrace();
        }
    }

    public static void spawnShopVisuals(ServerLevel world, BlockPos pos, String player, String item, double price) {
        spawnShopVisuals(world, pos, player, item, price, 0.0);
    }

    public static void cleanupShopVisuals(ServerLevel world, BlockPos pos) {
        try {
            AABB box = new AABB(pos).inflate(0.4, 0.5, 0.4);
            List<Display.ItemDisplay> entities = world.getEntitiesOfClass(
                Display.ItemDisplay.class, box, entity -> true
            );
            for (var entity : entities) {
                entity.discard();
            }

            for (Direction dir : Direction.values()) {
                BlockPos sidePos = pos.relative(dir);
                var state = world.getBlockState(sidePos);
                // Textual check signature: instanceof net.minecraft.world.level.block.AbstractSignBlock
                if (com.craftcore.event.ChestShopEventHandler.isSign(state)) {
                    world.setBlock(sidePos, Blocks.AIR.defaultBlockState(), 3);
                }
            }
        } catch (Throwable t) {
            System.err.println("[CraftCore] Failed to cleanup shop visuals: " + t.getMessage());
        }
    }

    public static class EcoTopScreenHandler extends ChestMenu {
        public EcoTopScreenHandler(int syncId, Inventory playerInventory) {
            super(MenuType.GENERIC_9x2, syncId, playerInventory, new SimpleContainer(18), 2);
            java.util.List<java.util.Map.Entry<String, com.craftcore.economy.EconomyManager.PlayerData>> top = com.craftcore.economy.EconomyManager.getTopWealthPlayers(10);
            for (int i = 0; i < top.size(); i++) {
                var entry = top.get(i);
                Item itemObj;
                String rankColor;
                if (i == 0) {
                    itemObj = Items.DIAMOND;
                    rankColor = "§b[第一名] §f";
                } else if (i == 1) {
                    itemObj = Items.EMERALD;
                    rankColor = "§a[第二名] §f";
                } else if (i == 2) {
                    itemObj = Items.GOLD_INGOT;
                    rankColor = "§e[第三名] §f";
                } else {
                    itemObj = Items.IRON_INGOT;
                    rankColor = "§7[第" + (i + 1) + "名] §f";
                }
                
                ItemStack stack = new ItemStack(itemObj);
                stack.set(DataComponents.CUSTOM_NAME, Component.literal(rankColor + entry.getKey()));
                List<Component> lore = List.of(
                    Component.literal("§7資產餘額: §a$" + entry.getValue().balance)
                );
                stack.set(DataComponents.LORE, new ItemLore(lore));
                this.getContainer().setItem(i, stack);
            }
        }

        @Override
        public boolean stillValid(Player player) {
            return true;
        }
    }

    public static net.minecraft.network.chat.MutableComponent createClickableText(String text, String command, String hoverText) {
        return net.minecraft.network.chat.Component.literal(text)
            .withStyle(style -> style
                .withClickEvent(new net.minecraft.network.chat.ClickEvent.RunCommand(command))
                .withHoverEvent(new net.minecraft.network.chat.HoverEvent.ShowText(net.minecraft.network.chat.Component.literal(hoverText))));
    }

    public static void openOwnerControlPanel(ServerPlayer player, ShopManager.Shop shop) {
        player.sendSystemMessage(Component.literal("§6=================== 商店管理面板 ==================="));
        player.sendSystemMessage(Component.literal("§f商店座標: §e" + shop.coords));
        
        net.minecraft.world.item.Item itemObj = net.minecraft.core.registries.BuiltInRegistries.ITEM.getValue(net.minecraft.resources.Identifier.parse(shop.item));
        Component itemName = (itemObj != net.minecraft.world.item.Items.AIR) 
            ? Component.translatable(itemObj.getDescriptionId()) 
            : Component.literal(shop.item.replace("minecraft:", ""));
        player.sendSystemMessage(Component.literal("§f上架商品: ").append(itemName));
        
        String modeStr = "無";
        if (shop.sellPrice > 0 && shop.buyPrice > 0) {
            modeStr = "雙向 (售: " + shop.sellPrice + " | 收: " + shop.buyPrice + ")";
        } else if (shop.sellPrice > 0) {
            modeStr = "出售 (售: " + shop.sellPrice + ")";
        } else if (shop.buyPrice > 0) {
            modeStr = "收購 (收: " + shop.buyPrice + ")";
        }
        player.sendSystemMessage(Component.literal("§f目前模式: §7" + modeStr));
        player.sendSystemMessage(Component.literal("§f目前庫存: §e" + shop.stock));
        player.sendSystemMessage(Component.literal("§f無限模式: " + (shop.infinite ? "§a啟用" : "§c停用")));
        player.sendSystemMessage(Component.literal("§6--------------------------------------------------"));
        player.sendSystemMessage(Component.literal("§e★ 點選以下選項進行管理："));
        
        String escapedId = shop.id;
        
        player.sendSystemMessage(Component.literal("  ")
            .append(createClickableText("§d[切換無限] ", "/shop control \"" + escapedId + "\" toggle_infinite", "點擊切換商店的無限模式 (目前: " + (shop.infinite ? "無限" : "有限") + ")"))
            .append(createClickableText("§e[切換模式] ", "/shop control \"" + escapedId + "\" toggle_mode", "點擊循環切換模式 (Buy -> Sell -> Buy & Sell)"))
            .append(createClickableText("§b[設定價格] ", "/shop control \"" + escapedId + "\" price_config", "點擊開始設定商品的出售與收購價格")));
            
        player.sendSystemMessage(Component.literal("  ")
            .append(createClickableText("§a[遠端補貨] ", "/shop control \"" + escapedId + "\" restock", "點擊將箱子補滿商店商品"))
            .append(createClickableText("§c[清空箱子] ", "/shop control \"" + escapedId + "\" clear", "點擊清空箱子中該商店類型的物品"))
            .append(createClickableText("§6[切換顯示] ", "/shop control \"" + escapedId + "\" toggle_display", "點擊切換商店上方的懸浮物品顯示")));
            
        player.sendSystemMessage(Component.literal("  ")
            .append(createClickableText("§9[交易歷史] ", "/shop control \"" + escapedId + "\" history", "點擊查看此商店最近的交易歷史"))
            .append(createClickableText("§4[刪除商店]", "/shop control \"" + escapedId + "\" delete", "警告：點擊將立即刪除並清空此商店！")));
            
        player.sendSystemMessage(Component.literal("§6=================================================="));
    }

    public static void openBuyerTransactionPanel(ServerPlayer player, ShopManager.Shop shop) {
        int stock = 0;
        int space = 0;
        ServerLevel world = (ServerLevel) player.level();
        net.minecraft.world.item.Item itemObj = net.minecraft.core.registries.BuiltInRegistries.ITEM.getValue(net.minecraft.resources.Identifier.parse(shop.item));
        int maxStack = (itemObj != null && itemObj != net.minecraft.world.item.Items.AIR) ? itemObj.getDefaultMaxStackSize() : 64;
        
        String cleanCoords = ShopManager.getCleanCoords(shop.id);
        String[] parts = cleanCoords.split(",");
        if (parts.length == 3) {
            try {
                int x = Integer.parseInt(parts[0]);
                int y = Integer.parseInt(parts[1]);
                int z = Integer.parseInt(parts[2]);
                net.minecraft.core.BlockPos pos = new net.minecraft.core.BlockPos(x, y, z);
                BlockEntity be = world.getBlockEntity(pos);
                if (be instanceof net.minecraft.world.Container inv) {
                    for (int i = 0; i < inv.getContainerSize(); i++) {
                        ItemStack s = inv.getItem(i);
                        if (!s.isEmpty() && net.minecraft.core.registries.BuiltInRegistries.ITEM.getKey(s.getItem()).toString().equals(shop.item)) {
                            stock += s.getCount();
                        }
                    }
                    for (int i = 0; i < inv.getContainerSize(); i++) {
                        ItemStack s = inv.getItem(i);
                        if (s.isEmpty()) {
                            space += maxStack;
                        } else if (net.minecraft.core.registries.BuiltInRegistries.ITEM.getKey(s.getItem()).toString().equals(shop.item)) {
                            space += (maxStack - s.getCount());
                        }
                    }
                }
            } catch (Throwable t) {}
        }
        
        player.sendSystemMessage(Component.literal("§6=================== 商店交易面板 ==================="));
        player.sendSystemMessage(Component.literal("§f商店主人: §e" + shop.player));
        
        Component itemName = (itemObj != net.minecraft.world.item.Items.AIR) 
            ? Component.translatable(itemObj.getDescriptionId()) 
            : Component.literal(shop.item.replace("minecraft:", ""));
        player.sendSystemMessage(Component.literal("§f商品名稱: ").append(itemName));
        
        boolean sellActive = shop.sellPrice > 0;
        boolean buyActive = shop.buyPrice > 0;
        
        if (sellActive) {
            String stockStr = shop.infinite ? "無限" : String.valueOf(stock);
            player.sendSystemMessage(Component.literal("§a[出售商品] §f-> 價格: §e$" + shop.sellPrice + "§f (庫存: " + stockStr + ")"));
        }
        if (buyActive) {
            String spaceStr = shop.infinite ? "無限" : String.valueOf(space);
            player.sendSystemMessage(Component.literal("§b[收購商品] §f-> 收購價: §e$" + shop.buyPrice + "§f (可收購空間: " + spaceStr + ")"));
        }
        
        player.sendSystemMessage(Component.literal("§f目前評分: §e" + ShopManager.getAverageRatingString(shop.id)));
        player.sendSystemMessage(Component.literal("§6--------------------------------------------------"));
        player.sendSystemMessage(Component.literal("§e★ 點選以下選項進行交易："));
        
        String escapedId = shop.id;
        net.minecraft.network.chat.MutableComponent options = Component.literal("  ");
        if (sellActive) {
            options.append(createClickableText("§a[購買商品] ", "/shop control \"" + escapedId + "\" buy_session", "點擊向此商店購買商品"));
        }
        if (buyActive) {
            options.append(createClickableText("§b[出售商品]", "/shop control \"" + escapedId + "\" sell_session", "點擊向此商店出售物品"));
        }
        player.sendSystemMessage(options);
        player.sendSystemMessage(Component.literal("§6=================================================="));
    }
}
