package com.craftcore.task;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;

public class CraftCoreTaskMod implements ModInitializer {

    @Override
    public void onInitialize() {
        System.out.println("[CraftCoreTask] Initializing Craft-Core Task Module...");
        DailyTaskManager.registerEvents();
        AiDailyTaskManager.loadTasks();
        SidebarManager.register();

        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
            TaskCommand.register(dispatcher);
        });
    }
}
