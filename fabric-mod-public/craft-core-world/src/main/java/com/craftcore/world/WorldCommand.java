package com.craftcore.world;

import com.craftcore.back.BackManager;
import com.craftcore.teleport.TeleportUtil;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.commands.SharedSuggestionProvider;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;

import java.util.ArrayList;
import java.util.List;

public class WorldCommand {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("world")
                .then(Commands.argument("dimension", StringArgumentType.string())
                        .suggests((context, builder) -> {
                            List<String> list = new ArrayList<>();
                            list.add("overworld");
                            list.add("nether");
                            list.add("end");
                            if (context.getSource().getServer() != null) {
                                for (ServerLevel level : context.getSource().getServer().getAllLevels()) {
                                    String dimId = level.dimension().identifier().toString();
                                    if (!list.contains(dimId)) {
                                        list.add(dimId);
                                    }
                                }
                            }
                            return SharedSuggestionProvider.suggest(list, builder);
                        })
                        .executes(context -> handleWorldCommand(context, StringArgumentType.getString(context, "dimension")))
                )
        );
    }

    private static int handleWorldCommand(com.mojang.brigadier.context.CommandContext<CommandSourceStack> context, String inputDim) {
        ServerPlayer player = context.getSource().getPlayer();
        if (player == null) {
            context.getSource().sendSystemMessage(Component.literal("此指令只能由遊戲內玩家執行。"));
            return 0;
        }

        String cleanInput = inputDim.toLowerCase().trim();
        String targetDimId;

        if (cleanInput.equals("overworld") || cleanInput.equals("world") || cleanInput.equals("main")) {
            targetDimId = "minecraft:overworld";
        } else if (cleanInput.equals("nether") || cleanInput.equals("the_nether")) {
            targetDimId = "minecraft:the_nether";
        } else if (cleanInput.equals("end") || cleanInput.equals("the_end")) {
            targetDimId = "minecraft:the_end";
        } else if (!cleanInput.contains(":")) {
            targetDimId = "minecraft:" + cleanInput;
        } else {
            targetDimId = cleanInput;
        }

        String currentDimId = player.level().dimension().identifier().toString();
        if (currentDimId.equalsIgnoreCase(targetDimId)) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 您目前已經在該世界維度中！"));
            return 0;
        }

        ServerLevel destLevel = null;
        if (context.getSource().getServer() != null) {
            for (ServerLevel level : context.getSource().getServer().getAllLevels()) {
                if (level.dimension().identifier().toString().equalsIgnoreCase(targetDimId)) {
                    destLevel = level;
                    break;
                }
            }
        }

        if (destLevel == null) {
            player.sendSystemMessage(Component.literal("§c[Craft-Core] 找不到未載入的世界維度：" + inputDim));
            return 0;
        }

        BackManager.recordLocation(player);
        DimensionLocationManager.recordCurrentDimensionLocation(player);

        DimensionLocationManager.DimPos lastPos = DimensionLocationManager.getLastLocation(player, targetDimId);

        double targetX, targetY, targetZ;
        float targetYaw, targetPitch;

        if (lastPos != null) {
            DimensionLocationManager.DimPos safePos = DimensionLocationManager.findSafePos(destLevel, lastPos);
            targetX = safePos.x;
            targetY = safePos.y;
            targetZ = safePos.z;
            targetYaw = safePos.yaw;
            targetPitch = safePos.pitch;
        } else {
            DimensionLocationManager.DimPos defaultPos = new DimensionLocationManager.DimPos(0.5, 100.0, 0.5, player.getYRot(), player.getXRot());
            DimensionLocationManager.DimPos safePos = DimensionLocationManager.findSafePos(destLevel, defaultPos);
            targetX = safePos.x;
            targetY = safePos.y;
            targetZ = safePos.z;
            targetYaw = safePos.yaw;
            targetPitch = safePos.pitch;
        }

        TeleportUtil.teleport(player, destLevel, targetX, targetY, targetZ, targetYaw, targetPitch);

        String dimDisplayName = switch (targetDimId) {
            case "minecraft:overworld" -> "主世界 (Overworld)";
            case "minecraft:the_nether" -> "地獄 (Nether)";
            case "minecraft:the_end" -> "終界 (End)";
            default -> targetDimId;
        };

        player.sendSystemMessage(Component.literal("§b[Craft-Core] §a成功切換至世界：" + dimDisplayName + "！"));
        return 1;
    }
}
