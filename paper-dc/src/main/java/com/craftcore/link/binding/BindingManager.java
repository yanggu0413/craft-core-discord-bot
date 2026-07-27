package com.craftcore.link.binding;

import com.craftcore.link.CraftCoreLink;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;

import java.io.*;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class BindingManager {

    public static class UserBinding {
        private String discordId;
        private String mcUuid;
        private String mcUsername;
        private long boundAt;

        public UserBinding(String discordId, String mcUuid, String mcUsername, long boundAt) {
            this.discordId = discordId;
            this.mcUuid = mcUuid;
            this.mcUsername = mcUsername;
            this.boundAt = boundAt;
        }

        public String getDiscordId() { return discordId; }
        public String getMcUuid() { return mcUuid; }
        public String getMcUsername() { return mcUsername; }
        public long getBoundAt() { return boundAt; }
    }

    public static class TempCode {
        private String code;
        private String mcUuid;
        private String mcUsername;
        private long createdAt;

        public TempCode(String code, String mcUuid, String mcUsername, long createdAt) {
            this.code = code;
            this.mcUuid = mcUuid;
            this.mcUsername = mcUsername;
            this.createdAt = createdAt;
        }

        public String getCode() { return code; }
        public String getMcUuid() { return mcUuid; }
        public String getMcUsername() { return mcUsername; }
        public long getCreatedAt() { return createdAt; }

        public boolean isExpired() {
            return System.currentTimeMillis() - createdAt > 5 * 60 * 1000L;
        }
    }

    public static class DmRateLimit {
        private int count = 0;
        private long cooldownUntil = 0;

        public int getCount() { return count; }
        public long getCooldownUntil() { return cooldownUntil; }
        public void increment() { this.count++; }
        public void reset() { this.count = 0; }
        public void setCooldown(long until) { this.cooldownUntil = until; }
    }

    private final CraftCoreLink plugin;
    private final File bindingsFile;
    private final Gson gson = new GsonBuilder().setPrettyPrinting().create();

    // Key: Discord ID -> UserBinding
    private final Map<String, UserBinding> bindingsByDiscordId = new ConcurrentHashMap<>();
    // Key: MC UUID -> UserBinding
    private final Map<String, UserBinding> bindingsByMcUuid = new ConcurrentHashMap<>();
    // Key: Temp Code -> TempCode
    private final Map<String, TempCode> tempCodes = new ConcurrentHashMap<>();
    // Key: Discord ID -> DmRateLimit
    private final Map<String, DmRateLimit> rateLimits = new ConcurrentHashMap<>();

    public BindingManager(CraftCoreLink plugin) {
        this.plugin = plugin;
        this.bindingsFile = new File(plugin.getDataFolder(), "bindings.json");
        loadBindings();
    }

    public synchronized void loadBindings() {
        if (!bindingsFile.exists()) {
            saveBindings();
            return;
        }
        try (Reader reader = new InputStreamReader(new FileInputStream(bindingsFile), StandardCharsets.UTF_8)) {
            Type listType = new TypeToken<List<UserBinding>>() {}.getType();
            List<UserBinding> list = gson.fromJson(reader, listType);
            bindingsByDiscordId.clear();
            bindingsByMcUuid.clear();
            if (list != null) {
                for (UserBinding binding : list) {
                    bindingsByDiscordId.put(binding.getDiscordId(), binding);
                    bindingsByMcUuid.put(binding.getMcUuid(), binding);
                }
            }
        } catch (Exception e) {
            plugin.getLogger().severe("Failed to load bindings.json: " + e.getMessage());
        }
    }

    public synchronized void saveBindings() {
        try {
            if (!plugin.getDataFolder().exists()) {
                plugin.getDataFolder().mkdirs();
            }
            try (Writer writer = new OutputStreamWriter(new FileOutputStream(bindingsFile), StandardCharsets.UTF_8)) {
                List<UserBinding> list = new ArrayList<>(bindingsByDiscordId.values());
                gson.toJson(list, writer);
            }
        } catch (Exception e) {
            plugin.getLogger().severe("Failed to save bindings.json: " + e.getMessage());
        }
    }

    public String generateCode(String mcUuid, String mcUsername) {
        // Clear old codes for this UUID
        tempCodes.values().removeIf(code -> code.getMcUuid().equals(mcUuid) || code.isExpired());

        Random random = new Random();
        String code;
        do {
            code = String.format("%06d", random.nextInt(1000000));
        } while (tempCodes.containsKey(code));

        TempCode tempCode = new TempCode(code, mcUuid, mcUsername, System.currentTimeMillis());
        tempCodes.put(code, tempCode);
        return code;
    }

    public TempCode getTempCode(String code) {
        TempCode tc = tempCodes.get(code);
        if (tc != null && tc.isExpired()) {
            tempCodes.remove(code);
            return null;
        }
        return tc;
    }

    public void removeTempCode(String code) {
        tempCodes.remove(code);
    }

    public synchronized UserBinding bindUser(String discordId, String mcUuid, String mcUsername) {
        UserBinding binding = new UserBinding(discordId, mcUuid, mcUsername, System.currentTimeMillis());
        bindingsByDiscordId.put(discordId, binding);
        bindingsByMcUuid.put(mcUuid, binding);
        saveBindings();
        return binding;
    }

    public UserBinding getBindingByDiscordId(String discordId) {
        return bindingsByDiscordId.get(discordId);
    }

    public UserBinding getBindingByMcUuid(String mcUuid) {
        return bindingsByMcUuid.get(mcUuid);
    }

    public DmRateLimit getRateLimit(String discordId) {
        return rateLimits.computeIfAbsent(discordId, k -> new DmRateLimit());
    }

    public void removeRateLimit(String discordId) {
        rateLimits.remove(discordId);
    }
}
