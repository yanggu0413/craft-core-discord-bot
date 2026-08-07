package com.craftcore.data;

import com.craftcore.util.FabricPathUtil;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.lang.reflect.Type;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

public class JsonDataStore {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    public static Path getDataDir() {
        return FabricPathUtil.getDataDir();
    }

    public static <T> T loadData(String filename, Class<T> clazz, T defaultValue) {
        return loadData(filename, (Type) clazz, defaultValue);
    }

    public static <T> T loadData(String filename, TypeToken<T> typeToken, T defaultValue) {
        return loadData(filename, typeToken.getType(), defaultValue);
    }

    @SuppressWarnings("unchecked")
    public static <T> T loadData(String filename, Type type, T defaultValue) {
        Path filePath = getDataDir().resolve(filename);
        if (!Files.exists(filePath)) {
            return defaultValue;
        }

        try (BufferedReader reader = Files.newBufferedReader(filePath)) {
            T data = GSON.fromJson(reader, type);
            return data != null ? data : defaultValue;
        } catch (Exception e) {
            System.err.println("[CraftCore-Libs] Corrupted data file detected: " + filename + " - " + e.getMessage());
            backupCorruptedFile(filePath);
            return defaultValue;
        }
    }

    public static <T> void saveDataAsync(String filename, T data) {
        if (data == null) {
            return;
        }
        // Snapshot to JSON string on calling thread to avoid ConcurrentModificationException during async save
        final String jsonContent = GSON.toJson(data);
        AsyncSaveExecutor.submit(() -> writeToFileAtomic(filename, jsonContent));
    }

    public static <T> void saveDataSync(String filename, T data) {
        if (data == null) {
            return;
        }
        final String jsonContent = GSON.toJson(data);
        writeToFileAtomic(filename, jsonContent);
    }

    private static void writeToFileAtomic(String filename, String jsonContent) {
        try {
            Path dataDir = getDataDir();
            Path targetPath = dataDir.resolve(filename);
            Path tmpPath = dataDir.resolve(filename + ".tmp");

            if (targetPath.getParent() != null) {
                Files.createDirectories(targetPath.getParent());
            }

            try (BufferedWriter writer = Files.newBufferedWriter(tmpPath)) {
                writer.write(jsonContent);
                writer.flush();
            }

            try {
                Files.move(tmpPath, targetPath, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } catch (IOException e) {
                Files.move(tmpPath, targetPath, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException e) {
            System.err.println("[CraftCore-Libs] Failed to save data file atomic: " + filename + " - " + e.getMessage());
        }
    }

    private static void backupCorruptedFile(Path filePath) {
        try {
            Path parent = filePath.getParent();
            String fileName = filePath.getFileName().toString();
            Path backupPath = parent.resolve(fileName + ".corrupted_" + System.currentTimeMillis());
            Files.move(filePath, backupPath, StandardCopyOption.REPLACE_EXISTING);
            System.err.println("[CraftCore-Libs] Corrupted file backed up to: " + backupPath.getFileName());
        } catch (IOException e) {
            System.err.println("[CraftCore-Libs] Failed to backup corrupted file: " + e.getMessage());
        }
    }
}
