package com.craftcore.util;

import java.nio.file.Path;

public class FabricPathUtil {
    private static Path customConfigDir = null;

    public static void setCustomConfigDir(Path path) {
        customConfigDir = path;
    }

    public static Path getConfigDir() {
        if (customConfigDir != null) {
            return customConfigDir;
        }
        try {
            Class<?> loaderClass = Class.forName("net.fabricmc.loader.api.FabricLoader");
            Object loader = loaderClass.getMethod("getInstance").invoke(null);
            return (Path) loaderClass.getMethod("getConfigDir").invoke(loader);
        } catch (Throwable t) {
            return Path.of("config");
        }
    }

    public static Path getGameDir() {
        try {
            Class<?> loaderClass = Class.forName("net.fabricmc.loader.api.FabricLoader");
            Object loader = loaderClass.getMethod("getInstance").invoke(null);
            return (Path) loaderClass.getMethod("getGameDir").invoke(loader);
        } catch (Throwable t) {
            return Path.of(".");
        }
    }

    public static Path getCraftCoreConfigDir() {
        return getConfigDir().resolve("craft-core");
    }

    public static Path getCraftCoreDataDir() {
        return getCraftCoreConfigDir().resolve("data");
    }

    public static Path getDataDir() {
        return getCraftCoreDataDir();
    }

    public static Path getConfigFile(String filename) {
        return getCraftCoreConfigDir().resolve(filename);
    }

    public static Path getDataFile(String filename) {
        return getCraftCoreDataDir().resolve(filename);
    }
}
