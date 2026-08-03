package com.craftcore.util;

import java.nio.file.Path;

public class FabricPathUtil {
    public static Path getConfigDir() {
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

    public static Path getShopConfigDir() {
        return getConfigDir().resolve("craft-core-shop");
    }
}
