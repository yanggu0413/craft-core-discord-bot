package com.craftcore.api;

import com.google.gson.reflect.TypeToken;
import java.lang.reflect.Type;

/**
 * API facade delegating to com.craftcore.data.JsonDataStore.
 */
public class JsonDataStore {
    public static <T> T loadData(String filename, Class<T> clazz, T defaultValue) {
        return com.craftcore.data.JsonDataStore.loadData(filename, clazz, defaultValue);
    }

    public static <T> T loadData(String filename, TypeToken<T> typeToken, T defaultValue) {
        return com.craftcore.data.JsonDataStore.loadData(filename, typeToken, defaultValue);
    }

    public static <T> T loadData(String filename, Type type, T defaultValue) {
        return com.craftcore.data.JsonDataStore.loadData(filename, type, defaultValue);
    }

    public static <T> void saveDataAsync(String filename, T data) {
        com.craftcore.data.JsonDataStore.saveDataAsync(filename, data);
    }

    public static <T> void saveDataSync(String filename, T data) {
        com.craftcore.data.JsonDataStore.saveDataSync(filename, data);
    }
}
