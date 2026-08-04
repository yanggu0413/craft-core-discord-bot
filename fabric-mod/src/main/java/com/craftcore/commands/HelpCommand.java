package com.craftcore.commands;

import com.mojang.brigadier.CommandDispatcher;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.ClickEvent;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.HoverEvent;
import net.minecraft.network.chat.MutableComponent;
import net.minecraft.server.level.ServerPlayer;

import java.net.URI;

public class HelpCommand {

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("help")
                .executes(context -> executeHelp(context.getSource()))
        );

        dispatcher.register(Commands.literal("docs")
                .executes(context -> executeHelp(context.getSource()))
        );

        dispatcher.register(Commands.literal("guide")
                .executes(context -> executeHelp(context.getSource()))
        );
    }

    private static int executeHelp(CommandSourceStack source) {
        ServerPlayer player = source.getPlayer();

        MutableComponent message = Component.empty()
                .append(Component.literal("§b========================================\n"))
                .append(Component.literal("  §e📖 Craft-Core 官方玩家社群文件指南\n"))
                .append(Component.literal("  §f歡迎參閱伺服器全功能指令、商店市場與領地保護教學！\n\n"))
                .append(Component.literal("  §a👉 點擊此處前往線上說明文件：\n  "))
                .append(Component.literal("§b§nhttps://docs.craft-core.xyz§r\n\n")
                        .withStyle(style -> style
                                .withClickEvent(new ClickEvent.OpenUrl(URI.create("https://docs.craft-core.xyz")))
                                .withHoverEvent(new HoverEvent.ShowText(Component.literal("§a點擊於瀏覽器中直接開啟網頁：https://docs.craft-core.xyz")))
                        )
                )
                .append(Component.literal("  §7(提示：點擊上方藍色連結即可在瀏覽器開啟網站)\n"))
                .append(Component.literal("§b========================================"));

        if (player != null) {
            player.sendSystemMessage(message);
        } else {
            source.sendSuccess(() -> message, false);
        }

        return 1;
    }
}
