package com.craftcore;

import com.craftcore.config.ConfigManager;
import com.craftcore.data.AsyncSaveExecutor;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class CraftCoreLibsMod implements ModInitializer {
    public static final String MOD_ID = "craft-core-libs";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    @Override
    public void onInitialize() {
        LOGGER.info("Initializing Craft-Core Libs (Compulsory Core Library)");

        // Initialize Central Config & Rebranding Engine
        ConfigManager.loadConfig();

        // Register Server Lifecycle Stopping & JVM Shutdown hooks for AsyncSaveExecutor
        ServerLifecycleEvents.SERVER_STOPPING.register(server -> {
            LOGGER.info("[CraftCore-Libs] Flushing async save executor...");
            AsyncSaveExecutor.flush();
        });

        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            LOGGER.info("[CraftCore-Libs] Shutting down async save executor...");
            AsyncSaveExecutor.shutdown();
        }));
    }
}
