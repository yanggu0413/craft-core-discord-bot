package com.craftcore;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class CommandCapturerTest {

    @Test
    public void testBrigadierStringParsing() throws Exception {
        com.mojang.brigadier.CommandDispatcher<Object> dispatcher = new com.mojang.brigadier.CommandDispatcher<>();
        final String[] parsedUsername = new String[1];
        dispatcher.register(com.mojang.brigadier.builder.LiteralArgumentBuilder.literal("addmoney")
            .then(com.mojang.brigadier.builder.RequiredArgumentBuilder.argument("username", com.mojang.brigadier.arguments.StringArgumentType.string())
                .then(com.mojang.brigadier.builder.RequiredArgumentBuilder.argument("amount", com.mojang.brigadier.arguments.DoubleArgumentType.doubleArg())
                    .executes(context -> {
                        parsedUsername[0] = com.mojang.brigadier.arguments.StringArgumentType.getString(context, "username");
                        return 1;
                    })
                )
            )
        );

        dispatcher.execute("addmoney \"im_little_rory\" 293", new Object());
        assertEquals("im_little_rory", parsedUsername[0]);

        dispatcher.execute("addmoney im_little_rory 293", new Object());
        assertEquals("im_little_rory", parsedUsername[0]);
    }
}
