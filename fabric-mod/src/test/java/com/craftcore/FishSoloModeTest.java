package com.craftcore;

import com.craftcore.commands.FishCommand;
import com.craftcore.fish.FishingContestManager;
import com.mojang.brigadier.CommandDispatcher;
import net.minecraft.commands.CommandSourceStack;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class FishSoloModeTest {

    @BeforeAll
    public static void beforeAll() {
        try {
            net.minecraft.SharedConstants.tryDetectVersion();
            net.minecraft.server.Bootstrap.bootStrap();
        } catch (Throwable ignored) {}
    }

    @Test
    public void testFishSoloSubcommandRegistration() {
        CommandDispatcher<CommandSourceStack> dispatcher = new CommandDispatcher<>();
        FishCommand.register(dispatcher);
        assertNotNull(dispatcher.getRoot().getChild("fish").getChild("solo"));
    }
}
