package com.craftcore.backup;

import com.craftcore.data.JsonDataStore;
import com.craftcore.util.FabricPathUtil;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

public class BackupManager {

    public static class BackupConfig {
        public long maxStorageBytes = 100L * 1024L * 1024L * 1024L; // 100 GB
        public int intervalMinutes = 180; // 3 hours
        public boolean autoBackupEnabled = true;
    }

    private static final String CONFIG_FILE = "backup_config.json";
    private static BackupConfig backupConfig;
    private static final DateTimeFormatter TIMESTAMP_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm-ss");
    private static ScheduledExecutorService scheduler = null;
    private static final AtomicBoolean isBackingUp = new AtomicBoolean(false);
    private static MinecraftServer serverInstance = null;

    static {
        loadConfig();
    }

    public static synchronized void loadConfig() {
        backupConfig = JsonDataStore.loadData(CONFIG_FILE, BackupConfig.class, new BackupConfig());
    }

    public static synchronized void saveConfig() {
        JsonDataStore.saveDataAsync(CONFIG_FILE, backupConfig);
    }

    public static synchronized void startAutoBackupLoop(MinecraftServer server) {
        serverInstance = server;
        if (scheduler == null || scheduler.isShutdown()) {
            scheduler = Executors.newSingleThreadScheduledExecutor();
            int interval = backupConfig.intervalMinutes > 0 ? backupConfig.intervalMinutes : 180;
            scheduler.scheduleAtFixedRate(() -> {
                try {
                    if (backupConfig.autoBackupEnabled) {
                        performBackupAsync(false, "Auto-Scheduler");
                    }
                } catch (Throwable t) {
                    System.err.println("[CraftCore Backup] Auto backup error: " + t.getMessage());
                }
            }, interval, interval, TimeUnit.MINUTES);
            System.out.println("[CraftCore Backup] Auto-backup loop started (" + interval + "-min interval, 100GB cap).");
        }
    }

    public static synchronized void stopAutoBackupLoop() {
        if (scheduler != null && !scheduler.isShutdown()) {
            scheduler.shutdown();
            scheduler = null;
            System.out.println("[CraftCore Backup] Auto-backup loop stopped.");
        }
    }

    public static boolean isBackingUp() {
        return isBackingUp.get();
    }

    public static void performBackupAsync(boolean isManual, String triggerSource) {
        if (!isBackingUp.compareAndSet(false, true)) {
            broadcastToAdmins("§c[Craft-Core 備份] 警告：目前已有備份作業正在執行中，請稍後再試！");
            return;
        }

        if (serverInstance != null) {
            serverInstance.execute(() -> {
                try {
                    serverInstance.saveEverything(true, true, true);
                } catch (Exception e) {
                    System.err.println("[CraftCore Backup] World save flush exception: " + e.getMessage());
                }
            });
        }

        Executors.newSingleThreadExecutor().submit(() -> {
            try {
                Path rootDir = FabricPathUtil.getGameDir();
                Path backupDir = rootDir.resolve("backups");
                if (!Files.exists(backupDir)) {
                    Files.createDirectories(backupDir);
                }

                String timestamp = LocalDateTime.now().format(TIMESTAMP_FORMAT);
                String archiveName = "world_backup_" + timestamp + ".7z";
                Path archivePath = backupDir.resolve(archiveName);

                broadcastToAdmins("§b[Craft-Core 備份] §a開始執行 7z 增量地圖備份 (-mx=3)... 觸發來源：" + triggerSource);
                System.out.println("[CraftCore Backup] Starting 7z incremental backup: " + archiveName + " by " + triggerSource);

                Path worldDir = rootDir.resolve("world");
                if (!Files.exists(worldDir)) {
                    broadcastToAdmins("§c[Craft-Core 備份] 失敗：找不到 world 地圖資料夾！");
                    return;
                }

                File[] existingArchives = backupDir.toFile().listFiles((d, name) -> name.endsWith(".7z"));
                if (existingArchives != null && existingArchives.length > 0) {
                    Arrays.sort(existingArchives, Comparator.comparingLong(File::lastModified).reversed());
                    File latest = existingArchives[0];
                    try {
                        Files.copy(latest.toPath(), archivePath);
                    } catch (Exception ignored) {}
                }

                ProcessBuilder pb = new ProcessBuilder(
                        "7z", "u",
                        archivePath.toAbsolutePath().toString(),
                        worldDir.toAbsolutePath().toString(),
                        "-t7z", "-m0=lzma2", "-mx=3"
                );
                pb.directory(rootDir.toFile());

                Process process = pb.start();
                int exitCode = process.waitFor();

                if (exitCode == 0 && Files.exists(archivePath)) {
                    long sizeBytes = Files.size(archivePath);
                    double sizeMB = sizeBytes / (1024.0 * 1024.0);
                    String msg = String.format("§b[Craft-Core 備份] §a地圖增量備份成功！檔案：%s (%.1f MB)", archiveName, sizeMB);
                    broadcastToAdmins(msg);
                    System.out.println("[CraftCore Backup] Successfully created: " + archiveName + " (" + sizeMB + " MB)");

                    enforceStorageCap(backupDir);
                } else {
                    broadcastToAdmins("§c[Craft-Core 備份] 失敗：7z 執行異常 (Exit code: " + exitCode + ")，請確認系統已安裝 7z。");
                    System.err.println("[CraftCore Backup] 7z process failed with exit code: " + exitCode);
                }
            } catch (Exception e) {
                broadcastToAdmins("§c[Craft-Core 備份] 異常錯誤：" + e.getMessage());
                System.err.println("[CraftCore Backup] Error during backup: " + e.getMessage());
            } finally {
                isBackingUp.set(false);
            }
        });
    }

    private static void enforceStorageCap(Path backupDir) {
        try {
            File dir = backupDir.toFile();
            File[] files = dir.listFiles((d, name) -> name.endsWith(".7z"));
            if (files == null || files.length == 0) return;

            long totalBytes = Arrays.stream(files).mapToLong(File::length).sum();
            long maxCap = backupConfig.maxStorageBytes > 0 ? backupConfig.maxStorageBytes : (100L * 1024L * 1024L * 1024L);
            if (totalBytes > maxCap) {
                Arrays.sort(files, Comparator.comparingLong(File::lastModified));

                for (File f : files) {
                    if (totalBytes <= maxCap) break;
                    long fileSize = f.length();
                    String fileName = f.getName();
                    if (f.delete()) {
                        totalBytes -= fileSize;
                        System.out.println("[CraftCore Backup] Deleted oldest backup due to cap: " + fileName);
                        broadcastToAdmins("§e[Craft-Core 備份] 已刪除最早的舊備份檔 (容量管控)：" + fileName);
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("[CraftCore Backup] Failed to enforce storage cap: " + e.getMessage());
        }
    }

    private static void broadcastToAdmins(String message) {
        if (serverInstance != null) {
            serverInstance.execute(() -> {
                for (ServerPlayer player : serverInstance.getPlayerList().getPlayers()) {
                    if (player.createCommandSourceStack().permissions().hasPermission(net.minecraft.server.permissions.Permissions.COMMANDS_OWNER)) {
                        player.sendSystemMessage(Component.literal(message));
                    }
                }
            });
        }
    }
}
