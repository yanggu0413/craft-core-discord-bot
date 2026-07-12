package com.craftcore.event;

import com.craftcore.shop.ShopManager;
import com.craftcore.shop.ShopGuiManager;
import net.fabricmc.fabric.api.event.player.AttackBlockCallback;
import net.fabricmc.fabric.api.event.player.UseBlockCallback;
import net.fabricmc.fabric.api.event.player.PlayerBlockBreakEvents;
import net.fabricmc.fabric.api.message.v1.ServerMessageEvents;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.ChestBlock;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.entity.SignBlockEntity;
import net.minecraft.world.entity.Display;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundSource;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.network.chat.Component;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.core.BlockPos;
import net.minecraft.world.phys.AABB;
import net.minecraft.core.Direction;
import net.minecraft.world.level.Level;

public class ChestShopEventHandler {

    private static boolean isOp(Player player) {
        if (player instanceof ServerPlayer serverPlayer) {
            return serverPlayer.createCommandSourceStack().permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER);
        }
        return false;
    }

    public static InteractionResult handleAttackBlock(Player player, Level world, InteractionHand hand, BlockPos pos, Direction direction) {
        if (world.isClientSide() || hand != InteractionHand.MAIN_HAND) {
            return InteractionResult.PASS;
        }

        var state = world.getBlockState(pos);
        if (state.getBlock() instanceof ChestBlock) {
            String coords = pos.getX() + "," + pos.getY() + "," + pos.getZ();
            String dimension = world.dimension().identifier().toString();
            String key = dimension + ":" + coords;
            ShopManager.Shop shop = ShopManager.getShop(key);
            BlockPos targetPos = pos;

            if (shop == null) {
                net.minecraft.world.level.block.state.properties.ChestType chestType = state.getValue(ChestBlock.TYPE);
                if (chestType == net.minecraft.world.level.block.state.properties.ChestType.LEFT || chestType == net.minecraft.world.level.block.state.properties.ChestType.RIGHT) {
                    Direction facing = state.getValue(ChestBlock.FACING);
                    Direction dirToAttached = (chestType == net.minecraft.world.level.block.state.properties.ChestType.LEFT) 
                        ? facing.getClockWise() 
                        : facing.getCounterClockWise();
                    BlockPos neighborPos = pos.relative(dirToAttached);
                    String neighborKey = dimension + ":" + neighborPos.getX() + "," + neighborPos.getY() + "," + neighborPos.getZ();
                    shop = ShopManager.getShop(neighborKey);
                    if (shop != null) {
                        targetPos = neighborPos;
                    }
                }
            }

            if (shop != null) {
                boolean isOwner = shop.player.equals(player.getName().getString()) || isOp(player);
                if (isOwner) {
                    return InteractionResult.PASS;
                } else {
                    player.sendSystemMessage(Component.literal("§c[Craft-Core] You cannot break this chest shop!"));
                    player.playSound(SoundEvents.CHEST_LOCKED, 1.0f, 1.0f);

                    // Enter transaction flow (Requirement 5)
                    net.minecraft.world.item.Item itemObj = net.minecraft.core.registries.BuiltInRegistries.ITEM.getValue(net.minecraft.resources.Identifier.parse(shop.item));
                    if (itemObj == net.minecraft.world.item.Items.AIR) {
                        player.sendSystemMessage(Component.literal("§c[Craft-Core] Internal Error: Item not found!"));
                        return InteractionResult.FAIL;
                    }

                    int stock = 0;
                    int space = 0;
                    int maxStack = itemObj.getDefaultMaxStackSize();
                    BlockEntity be = world.getBlockEntity(targetPos);
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

                    boolean sellActive = shop.sellPrice > 0;
                    boolean buyActive = shop.buyPrice > 0;

                    if (!sellActive && !buyActive) {
                        player.sendSystemMessage(Component.literal("§c[Craft-Core] This shop has no active prices."));
                        return InteractionResult.FAIL;
                    }

                    // Print Status Dashboard
                    player.sendSystemMessage(Component.literal("§6=================== 商店交易 ==================="));
                    Component itemLocName = Component.translatable(itemObj.getDescriptionId());
                    player.sendSystemMessage(Component.literal("§f商品名稱: ").append(itemLocName));
                    player.sendSystemMessage(Component.literal("§f商店主人: " + shop.player));
                    if (sellActive) {
                        player.sendSystemMessage(Component.literal("§a[出售商品] §f-> 價格: §e$" + shop.sellPrice + "§f (庫存: " + stock + ")"));
                    }
                    if (buyActive) {
                        player.sendSystemMessage(Component.literal("§b[收購商品] §f-> 收購價: §e$" + shop.buyPrice + "§f (可收購空間: " + space + ")"));
                    }
                    player.sendSystemMessage(Component.literal("§6---------------------------------------------"));

                    ShopManager.BuyingSession session = new ShopManager.BuyingSession(shop.id);
                    if (sellActive && buyActive) {
                        session.mode = "none";
                        session.step = 0;
                        ShopManager.addBuyingSession(player.getName().getString(), session);

                        player.sendSystemMessage(Component.literal("§e★ 請選擇您的操作："));
                        player.sendSystemMessage(Component.literal("§f- 請在聊天欄輸入「§a買§f」開始向商店購買商品。"));
                        player.sendSystemMessage(Component.literal("§f- 請在聊天欄輸入「§b賣§f」將背包中的物品賣給商店。"));
                        player.sendSystemMessage(Component.literal("§f- 輸入「§c取消§f」結束交易。"));
                        player.sendSystemMessage(Component.literal("§6============================================"));
                    } else if (sellActive) {
                        session.mode = "buy";
                        session.step = 1;
                        ShopManager.addBuyingSession(player.getName().getString(), session);

                        player.sendSystemMessage(Component.literal("§b[Craft-Core] §f您已選擇【購買】。請在聊天欄輸入欲購買的「§a數量§f」（如: 64），或輸入「取消」取消："));
                    } else {
                        session.mode = "sell";
                        session.step = 1;
                        ShopManager.addBuyingSession(player.getName().getString(), session);

                        player.sendSystemMessage(Component.literal("§b[Craft-Core] §f您已選擇【出售】。請在聊天欄輸入欲出售的「§b數量§f」（如: 32），或輸入「取消」取消："));
                    }

                    return InteractionResult.FAIL;
                }
            } else {
                String username = player.getName().getString();
                if (ShopManager.isInActivationState(username)) {
                    ItemStack mainHand = player.getMainHandItem();
                    if (!mainHand.isEmpty()) {
                        ShopManager.removeActivationState(username);
                        String itemId = net.minecraft.core.registries.BuiltInRegistries.ITEM.getKey(mainHand.getItem()).toString();
                        ShopManager.addCreationSession(username, key, itemId, true);

                        player.sendSystemMessage(Component.literal("§b[Craft-Core] §e【步驟 1/2】設定出售價格"));
                        player.sendSystemMessage(Component.literal("§f- 請在聊天欄輸入「§a出售價格§f」（玩家買你商品的單價，如: 100）。"));
                        player.sendSystemMessage(Component.literal("§f- 若不提供出售，請輸入「§c0§f」或「§cnone§f」。"));
                        player.sendSystemMessage(Component.literal("§f- 輸入「§c取消§f」可放棄建立。"));
                        return InteractionResult.FAIL;
                    }
                }
            }
        }
        return InteractionResult.PASS;
    }

    public static boolean handleBlockBreak(Level world, Player player, BlockPos pos, BlockState state, BlockEntity blockEntity) {
        if (world.isClientSide()) {
            return true;
        }

        // Add protection for AbstractSignBlock
        if (state.getBlock() instanceof net.minecraft.world.level.block.SignBlock) {
            String dimension = world.dimension().identifier().toString();
            for (Direction dir : Direction.values()) {
                BlockPos adjacentPos = pos.relative(dir);
                var adjacentState = world.getBlockState(adjacentPos);
                if (adjacentState.getBlock() instanceof ChestBlock) {
                    String adjCoords = adjacentPos.getX() + "," + adjacentPos.getY() + "," + adjacentPos.getZ();
                    String adjKey = dimension + ":" + adjCoords;
                    ShopManager.Shop shop = ShopManager.getShop(adjKey);
                    if (shop == null) {
                        net.minecraft.world.level.block.state.properties.ChestType chestType = adjacentState.getValue(ChestBlock.TYPE);
                        if (chestType == net.minecraft.world.level.block.state.properties.ChestType.LEFT || chestType == net.minecraft.world.level.block.state.properties.ChestType.RIGHT) {
                            Direction facing = adjacentState.getValue(ChestBlock.FACING);
                            Direction dirToAttached = (chestType == net.minecraft.world.level.block.state.properties.ChestType.LEFT) 
                                ? facing.getClockWise() 
                                : facing.getCounterClockWise();
                            BlockPos neighborPos = adjacentPos.relative(dirToAttached);
                            String neighborKey = dimension + ":" + neighborPos.getX() + "," + neighborPos.getY() + "," + neighborPos.getZ();
                            shop = ShopManager.getShop(neighborKey);
                        }
                    }

                    if (shop != null) {
                        boolean isOwner = shop.player.equals(player.getName().getString()) || isOp(player);
                        if (!isOwner) {
                            player.sendSystemMessage(Component.literal("§c[Craft-Core] You cannot break this shop sign!"));
                            return false;
                        }
                    }
                }
            }
        }

        if (state.getBlock() instanceof ChestBlock) {
            String coords = pos.getX() + "," + pos.getY() + "," + pos.getZ();
            String dimension = world.dimension().identifier().toString();
            String key = dimension + ":" + coords;
            
            ShopManager.Shop shop = ShopManager.getShop(key);
            BlockPos targetPos = pos;
            String targetKey = key;
            
            if (shop == null) {
                net.minecraft.world.level.block.state.properties.ChestType chestType = state.getValue(ChestBlock.TYPE);
                if (chestType == net.minecraft.world.level.block.state.properties.ChestType.LEFT || chestType == net.minecraft.world.level.block.state.properties.ChestType.RIGHT) {
                    Direction facing = state.getValue(ChestBlock.FACING);
                    Direction dirToAttached = (chestType == net.minecraft.world.level.block.state.properties.ChestType.LEFT) 
                        ? facing.getClockWise() 
                        : facing.getCounterClockWise();
                    BlockPos neighborPos = pos.relative(dirToAttached);
                    String neighborKey = dimension + ":" + neighborPos.getX() + "," + neighborPos.getY() + "," + neighborPos.getZ();
                    shop = ShopManager.getShop(neighborKey);
                    if (shop != null) {
                        targetPos = neighborPos;
                        targetKey = neighborKey;
                    }
                }
            }

            if (shop != null) {
                boolean isOwner = shop.player.equals(player.getName().getString()) || isOp(player);
                if (isOwner) {
                    if (world instanceof ServerLevel serverWorld) {
                        ShopGuiManager.cleanupShopVisuals(serverWorld, targetPos);
                    }
                    ShopManager.unregisterShop(targetKey);
                    player.sendSystemMessage(Component.literal("§b[Craft-Core] §fShop deleted."));
                    return true;
                } else {
                    player.sendSystemMessage(Component.literal("§c[Craft-Core] You cannot break this chest shop!"));
                    player.playSound(SoundEvents.CHEST_LOCKED, 1.0f, 1.0f);
                    return false;
                }
            }
        }
        return true;
    }

    public static InteractionResult handleUseBlock(Player player, Level world, InteractionHand hand, BlockHitResult hitResult) {
        if (world.isClientSide() || hand != InteractionHand.MAIN_HAND) {
            return InteractionResult.PASS;
        }

        BlockPos pos = hitResult.getBlockPos();
        var state = world.getBlockState(pos);

        // Check sign edit protection first
        if (state.getBlock() instanceof net.minecraft.world.level.block.SignBlock) {
            String dimension = world.dimension().identifier().toString();
            for (Direction dir : Direction.values()) {
                BlockPos adjacentPos = pos.relative(dir);
                var adjacentState = world.getBlockState(adjacentPos);
                if (adjacentState.getBlock() instanceof ChestBlock) {
                    String adjCoords = adjacentPos.getX() + "," + adjacentPos.getY() + "," + adjacentPos.getZ();
                    String adjKey = dimension + ":" + adjCoords;
                    ShopManager.Shop shop = ShopManager.getShop(adjKey);
                    if (shop == null) {
                        net.minecraft.world.level.block.state.properties.ChestType chestType = adjacentState.getValue(ChestBlock.TYPE);
                        if (chestType == net.minecraft.world.level.block.state.properties.ChestType.LEFT || chestType == net.minecraft.world.level.block.state.properties.ChestType.RIGHT) {
                            Direction facing = adjacentState.getValue(ChestBlock.FACING);
                            Direction dirToAttached = (chestType == net.minecraft.world.level.block.state.properties.ChestType.LEFT) 
                                ? facing.getClockWise() 
                                : facing.getCounterClockWise();
                            BlockPos neighborPos = adjacentPos.relative(dirToAttached);
                            String neighborKey = dimension + ":" + neighborPos.getX() + "," + neighborPos.getY() + "," + neighborPos.getZ();
                            shop = ShopManager.getShop(neighborKey);
                        }
                    }
                    
                    if (shop != null) {
                        boolean isOwner = shop.player.equals(player.getName().getString()) || isOp(player);
                        if (!isOwner) {
                            player.sendSystemMessage(Component.literal("§c[Craft-Core] You cannot edit this shop sign!"));
                            return InteractionResult.FAIL;
                        }
                    }
                }
            }
        }

        if (state.getBlock() instanceof ChestBlock) {
            String coords = pos.getX() + "," + pos.getY() + "," + pos.getZ();
            String dimension = world.dimension().identifier().toString();
            String key = dimension + ":" + coords;
            
            ShopManager.Shop shop = ShopManager.getShop(key);
            if (shop == null) {
                net.minecraft.world.level.block.state.properties.ChestType chestType = state.getValue(ChestBlock.TYPE);
                if (chestType == net.minecraft.world.level.block.state.properties.ChestType.LEFT || chestType == net.minecraft.world.level.block.state.properties.ChestType.RIGHT) {
                    Direction facing = state.getValue(ChestBlock.FACING);
                    Direction dirToAttached = (chestType == net.minecraft.world.level.block.state.properties.ChestType.LEFT) 
                        ? facing.getClockWise() 
                        : facing.getCounterClockWise();
                    BlockPos neighborPos = pos.relative(dirToAttached);
                    String neighborKey = dimension + ":" + neighborPos.getX() + "," + neighborPos.getY() + "," + neighborPos.getZ();
                    shop = ShopManager.getShop(neighborKey);
                }
            }

            if (shop != null) {
                boolean isOwner = shop.player.equals(player.getName().getString()) || isOp(player);
                if (isOwner) {
                    return InteractionResult.PASS;
                } else {
                    player.sendSystemMessage(Component.literal("§c[Craft-Core] You cannot open this chest shop!"));
                    player.playSound(SoundEvents.CHEST_LOCKED, 1.0f, 1.0f);
                    return InteractionResult.FAIL;
                }
            }
        }
        return InteractionResult.PASS;
    }

    public static void register() {
        // 1. Attack block click interaction
        AttackBlockCallback.EVENT.register(ChestShopEventHandler::handleAttackBlock);

        // 2. Block break listener
        PlayerBlockBreakEvents.BEFORE.register(ChestShopEventHandler::handleBlockBreak);

        // 3. Right-click chest interaction
        UseBlockCallback.EVENT.register(ChestShopEventHandler::handleUseBlock);

        // 4. Chat message interception
        ServerMessageEvents.ALLOW_CHAT_MESSAGE.register((message, sender, params) -> {
            String username = sender.getName().getString();
            boolean isBuySession = ShopManager.isBuyingMode(username);
            String shopId = ShopManager.getBuyingSessionShopId(username);

            if (ShopManager.hasCreationSession(username) || ShopManager.hasBuyingSession(username) || ShopManager.hasRatingSession(username)) {
                String chatMessage = message.signedContent();
                ShopManager.ChatInterceptionResult result = ShopManager.handleChatInput(username, chatMessage, sender, (ServerLevel) sender.level());
                if (result.intercepted) {
                    if (result.responseMessage != null) {
                        for (String line : result.responseMessage.split("\n")) {
                            if (line.startsWith("§b[Craft-Core]") || line.startsWith("§f-") || line.startsWith("§e★") || line.startsWith("§6=")) {
                                sender.sendSystemMessage(Component.literal(line));
                            } else {
                                sender.sendSystemMessage(Component.literal("§b[Craft-Core] §f" + line));
                            }
                        }
                    }
                    if (result.success) {
                        sender.playSound(SoundEvents.EXPERIENCE_ORB_PICKUP, 1.0f, 1.0f);
                        if (isBuySession && shopId != null) {
                            net.minecraft.network.chat.MutableComponent prompt = Component.literal("§e[ 點選此處評分商店 ]")
                                .withStyle(style -> style
                                    .withClickEvent(new net.minecraft.network.chat.ClickEvent.RunCommand("/shop rate " + shopId))
                                    .withHoverEvent(new net.minecraft.network.chat.HoverEvent.ShowText(Component.literal("點擊開始評分此商店 (1-5 星)"))));
                            sender.sendSystemMessage(prompt);
                        }
                    } else {
                        sender.playSound(SoundEvents.VILLAGER_NO, 1.0f, 1.0f);
                    }
                    return false;
                }
            }
            return true;
        });
    }
}
