package com.craftcore.shop;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class ShopManager {
    private static Path configPath;
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    public static class Shop {
        public String id;
        public String player;
        public String coords; // format: "X,Y,Z"
        public String item;   // item ID
        public double price;  // legacy single price field
        public double sellPrice;
        public double buyPrice;
        public int stock;
        public double revenue;
        public boolean signPlaced = false;
        public boolean displaySpawned = false;
        public String dimension;
        public int bulkQuantity = 1;
        public java.util.List<Integer> ratings = new java.util.ArrayList<>();
        public String customName = null;
        public boolean infinite = false;

        public Shop(String player, String key, String item, double sellPrice, double buyPrice, int stock) {
            String coords;
            String dimension;
            if (key.contains(":")) {
                int idx = key.lastIndexOf(':');
                dimension = key.substring(0, idx);
                coords = key.substring(idx + 1);
            } else {
                dimension = "minecraft:overworld";
                coords = key;
                key = dimension + ":" + coords;
            }
            this.id = key;
            this.dimension = dimension;
            this.player = player;
            this.coords = coords;
            this.item = item;
            this.sellPrice = sellPrice;
            this.buyPrice = buyPrice;
            this.price = sellPrice;
            this.stock = stock;
            this.revenue = 0.0;
            this.bulkQuantity = 1;
        }

        public Shop(String player, String coords, String item, double price, int stock) {
            this(player, coords, item, price, 0.0, stock);
            this.bulkQuantity = 1;
        }
    }

    public static class CreationSession {
        public final String coords;
        public final String item;
        public final long startTime;
        public int step; // 1 = sell price, 2 = buy price
        public double sellPrice;
        public boolean stepByStep = false;

        public CreationSession(String coords, String item) {
            this.coords = coords;
            this.item = item;
            this.startTime = System.currentTimeMillis();
            this.step = 1;
            this.sellPrice = 0.0;
        }
        
        public boolean isExpired() {
            return System.currentTimeMillis() - startTime > 30000;
        }
    }

    public static class BuyingSession {
        public final String coords;
        public final long startTime;
        public String mode; // "none", "buy", "sell"
        public int step; // 0 = choosing mode, 1 = entering quantity

        public BuyingSession(String coords) {
            this.coords = coords;
            this.startTime = System.currentTimeMillis();
            this.mode = "none";
            this.step = 0;
        }

        public boolean isExpired() {
            return System.currentTimeMillis() - startTime > 30000;
        }
    }

    public static class RatingSession {
        public final String shopId;
        public final long startTime;

        public RatingSession(String shopId) {
            this.shopId = shopId;
            this.startTime = System.currentTimeMillis();
        }

        public boolean isExpired() {
            return System.currentTimeMillis() - startTime > 30000;
        }
    }

    public static class PriceConfigSession {
        public final String coords;
        public final long startTime;
        public int step; // 1 = sell price, 2 = buy price
        public double sellPrice;

        public PriceConfigSession(String coords) {
            this.coords = coords;
            this.startTime = System.currentTimeMillis();
            this.step = 1;
            this.sellPrice = 0.0;
        }

        public boolean isExpired() {
            return System.currentTimeMillis() - startTime > 30000;
        }
    }

    public static class ChatInterceptionResult {
        public final boolean intercepted;
        public final String responseMessage;
        public final boolean success;

        public ChatInterceptionResult(boolean intercepted, String responseMessage, boolean success) {
            this.intercepted = intercepted;
            this.responseMessage = responseMessage;
            this.success = success;
        }
    }

    public static class ActivationState {
        public final long startTime;
        public ActivationState() {
            this.startTime = System.currentTimeMillis();
        }
        public boolean isExpired() {
            return System.currentTimeMillis() - startTime > 30000;
        }
    }

    private static Map<String, Shop> shopMap = new ConcurrentHashMap<>();
    private static Map<String, CreationSession> creationSessions = new ConcurrentHashMap<>();
    private static Map<String, BuyingSession> buyingSessions = new ConcurrentHashMap<>();
    private static Map<String, RatingSession> ratingSessions = new ConcurrentHashMap<>();
    private static Map<String, ActivationState> activationStates = new ConcurrentHashMap<>();
    private static Map<String, PriceConfigSession> priceConfigSessions = new ConcurrentHashMap<>();

    public static String getNormalizedKey(String key) {
        if (key == null) return null;
        if (!key.contains(":")) {
            return "minecraft:overworld:" + key;
        }
        return key;
    }

    public static String getCleanCoords(String key) {
        if (key == null) return null;
        if (key.contains(":")) {
            return key.substring(key.lastIndexOf(':') + 1);
        }
        return key;
    }

    public static String getDimensionFromKey(String key) {
        if (key == null) return "minecraft:overworld";
        if (key.contains(":")) {
            return key.substring(0, key.lastIndexOf(':'));
        }
        return "minecraft:overworld";
    }

    public static net.minecraft.server.level.ServerLevel getServerWorld(String dimension) {
        try {
            net.minecraft.server.MinecraftServer server = com.craftcore.event.ServerLifecycleHandler.serverInstance;
            if (server != null) {
                for (net.minecraft.server.level.ServerLevel world : server.getAllLevels()) {
                    if (world.dimension().identifier().toString().equals(dimension)) {
                        return world;
                    }
                }
            }
        } catch (Throwable t) {
            // Safe fallback
        }
        return null;
    }

    public static class TransactionLog {
        public String type;
        public String buyer;
        public String owner;
        public String itemId;
        public int quantity;
        public double totalPrice;
        public long timestamp;

        public TransactionLog(String type, String buyer, String owner, String itemId, int quantity, double totalPrice, long timestamp) {
            this.type = type;
            this.buyer = buyer;
            this.owner = owner;
            this.itemId = itemId;
            this.quantity = quantity;
            this.totalPrice = totalPrice;
            this.timestamp = timestamp;
        }

        public TransactionLog() {}
    }

    private static Path logsConfigPath;
    private static final Map<String, List<TransactionLog>> merchantLogs = new ConcurrentHashMap<>();

    static {
        try {
            configPath = net.fabricmc.loader.api.FabricLoader.getInstance().getConfigDir()
                    .resolve("craft-core-shop").resolve("shops.json");
            logsConfigPath = net.fabricmc.loader.api.FabricLoader.getInstance().getConfigDir()
                    .resolve("craft-core-shop").resolve("logs.json");
        } catch (Throwable e) {
            configPath = Path.of("config", "craft-core-shop", "shops.json");
            logsConfigPath = Path.of("config", "craft-core-shop", "logs.json");
        }
        load();
        loadLogs();
    }

    public static synchronized void setConfigPath(Path path) {
        configPath = path;
        if (path != null) {
            String filename = path.getFileName().toString();
            String logsFilename = filename.replace("shops", "logs");
            if (logsFilename.equals(filename)) {
                logsFilename = "logs.json";
            }
            logsConfigPath = path.getParent().resolve(logsFilename);
        }
        load();
        loadLogs();
    }

    public static synchronized void loadLogs() {
        merchantLogs.clear();
        if (logsConfigPath != null && Files.exists(logsConfigPath)) {
            try (BufferedReader reader = Files.newBufferedReader(logsConfigPath)) {
                Map<String, List<TransactionLog>> loaded = GSON.fromJson(reader, new TypeToken<Map<String, List<TransactionLog>>>(){}.getType());
                if (loaded != null) {
                    for (Map.Entry<String, List<TransactionLog>> entry : loaded.entrySet()) {
                        List<TransactionLog> list = entry.getValue();
                        if (list != null) {
                            if (list.size() > 20) {
                                list = new ArrayList<>(list.subList(list.size() - 20, list.size()));
                            }
                            merchantLogs.put(entry.getKey(), new ArrayList<>(list));
                        }
                    }
                }
            } catch (IOException e) {
                System.err.println("[CraftCore] Failed to load transaction logs: " + e.getMessage());
            }
        }
    }

    public static synchronized void saveLogs() {
        if (logsConfigPath != null) {
            try {
                Files.createDirectories(logsConfigPath.getParent());
                try (BufferedWriter writer = Files.newBufferedWriter(logsConfigPath)) {
                    GSON.toJson(merchantLogs, writer);
                }
            } catch (IOException e) {
                System.err.println("[CraftCore] Failed to save transaction logs: " + e.getMessage());
            }
        }
    }

    public static synchronized void addTransactionLog(TransactionLog log) {
        List<TransactionLog> list = merchantLogs.computeIfAbsent(log.owner, k -> new ArrayList<>());
        list.add(log);
        if (list.size() > 20) {
            list.remove(0);
        }
        saveLogs();
    }

    public static synchronized List<TransactionLog> getMerchantLogs(String merchant) {
        List<TransactionLog> list = merchantLogs.get(merchant);
        if (list == null) {
            return new ArrayList<>();
        }
        return new ArrayList<>(list);
    }

    public static synchronized void load() {
        if (configPath != null && Files.exists(configPath)) {
            try (BufferedReader reader = Files.newBufferedReader(configPath)) {
                Map<String, Shop> loaded = GSON.fromJson(reader, new TypeToken<Map<String, Shop>>(){}.getType());
                if (loaded != null) {
                    shopMap.clear();
                    for (Map.Entry<String, Shop> entry : loaded.entrySet()) {
                        String key = entry.getKey();
                        Shop shop = entry.getValue();
                        String finalKey = key;
                        if (!key.contains(":")) {
                            finalKey = "minecraft:overworld:" + key;
                        }
                        if (shop.dimension == null) {
                            if (finalKey.contains(":")) {
                                int lastColon = finalKey.lastIndexOf(':');
                                shop.dimension = finalKey.substring(0, lastColon);
                                shop.coords = finalKey.substring(lastColon + 1);
                            } else {
                                shop.dimension = "minecraft:overworld";
                                shop.coords = key;
                            }
                        }
                        shop.id = finalKey;
                        if (shop.sellPrice == 0.0 && shop.price > 0.0) {
                            shop.sellPrice = shop.price;
                        }
                        shopMap.put(finalKey, shop);
                    }
                }
            } catch (IOException e) {
                System.err.println("[CraftCore] Failed to load shops: " + e.getMessage());
            }
        }
    }

    public static synchronized void save() {
        if (configPath != null) {
            try {
                Files.createDirectories(configPath.getParent());
                try (BufferedWriter writer = Files.newBufferedWriter(configPath)) {
                    GSON.toJson(shopMap, writer);
                }
            } catch (IOException e) {
                System.err.println("[CraftCore] Failed to save shops: " + e.getMessage());
            }
        }
    }

    public static synchronized void clearAll() {
        shopMap.clear();
        creationSessions.clear();
        buyingSessions.clear();
        ratingSessions.clear();
        priceConfigSessions.clear();
        merchantLogs.clear();
        save();
        saveLogs();
    }

    public static synchronized boolean registerShop(String player, String coords, String item, double sellPrice, double buyPrice, int stock) {
        if (Double.isNaN(sellPrice) || Double.isInfinite(sellPrice)) return false;
        if (Double.isNaN(buyPrice) || Double.isInfinite(buyPrice)) return false;
        
        String key = getNormalizedKey(coords);
        
        long count = shopMap.values().stream().filter(s -> s.player.equals(player)).count();
        boolean isUpdatingExisting = shopMap.containsKey(key) && shopMap.get(key).player.equals(player);
        int maxAllowed = 15 + com.craftcore.economy.EconomyManager.getUpgradedShopSlots(player);
        if (!isUpdatingExisting && count >= maxAllowed) {
            return false;
        }

        Shop shop = new Shop(player, key, item, sellPrice, buyPrice, stock);
        shop.signPlaced = true;
        shop.displaySpawned = true;
        shopMap.put(key, shop);
        save();
        
        try {
            net.minecraft.server.MinecraftServer server = com.craftcore.event.ServerLifecycleHandler.serverInstance;
            if (server != null) {
                net.minecraft.server.level.ServerPlayer sPlayer = server.getPlayerList().getPlayerByName(player);
                if (sPlayer != null) {
                    net.minecraft.server.level.ServerLevel world = (net.minecraft.server.level.ServerLevel) sPlayer.level();
                    String cleanCoords = getCleanCoords(key);
                    String[] parts = cleanCoords.split(",");
                    int x = Integer.parseInt(parts[0]);
                    int y = Integer.parseInt(parts[1]);
                    int z = Integer.parseInt(parts[2]);
                    net.minecraft.core.BlockPos pos = new net.minecraft.core.BlockPos(x, y, z);
                    com.craftcore.shop.ShopGuiManager.spawnShopVisuals(world, pos, player, item, sellPrice, buyPrice);
                }
            }
        } catch (Throwable t) {
            // Safe fallback for JUnit/Mock environments
        }
        return true;
    }

    public static synchronized boolean registerShop(String player, String coords, String item, double price, int stock) {
        return registerShop(player, coords, item, price, 0.0, stock);
    }

    public static synchronized boolean unregisterShop(String coords) {
        String key = getNormalizedKey(coords);
        if (shopMap.containsKey(key)) {
            shopMap.remove(key);
            save();
            
            try {
                net.minecraft.server.MinecraftServer server = com.craftcore.event.ServerLifecycleHandler.serverInstance;
                if (server != null) {
                    String cleanCoords = getCleanCoords(key);
                    String[] parts = cleanCoords.split(",");
                    int x = Integer.parseInt(parts[0]);
                    int y = Integer.parseInt(parts[1]);
                    int z = Integer.parseInt(parts[2]);
                    net.minecraft.core.BlockPos pos = new net.minecraft.core.BlockPos(x, y, z);
                    for (net.minecraft.server.level.ServerLevel world : server.getAllLevels()) {
                        com.craftcore.shop.ShopGuiManager.cleanupShopVisuals(world, pos);
                    }
                }
            } catch (Throwable t) {
                // Safe fallback for JUnit/Mock environments
            }
            return true;
        }
        return false;
    }

    public static synchronized Shop getShop(String coords) {
        return shopMap.get(getNormalizedKey(coords));
    }

    public static synchronized List<Shop> getShops() {
        return new ArrayList<>(shopMap.values());
    }

    public static synchronized void addActivationState(String username) {
        activationStates.put(username, new ActivationState());
    }

    public static synchronized void removeActivationState(String username) {
        activationStates.remove(username);
    }

    public static synchronized boolean isInActivationState(String username) {
        ActivationState state = activationStates.get(username);
        if (state == null) return false;
        if (state.isExpired()) {
            activationStates.remove(username);
            return false;
        }
        return true;
    }

    public static synchronized void addCreationSession(String username, String coords, String item, boolean stepByStep) {
        CreationSession session = new CreationSession(coords, item);
        session.stepByStep = stepByStep;
        creationSessions.put(username, session);
    }

    public static synchronized void addCreationSession(String username, String coords, String item) {
        addCreationSession(username, coords, item, false);
    }

    public static synchronized void addBuyingSession(String username, BuyingSession session) {
        buyingSessions.put(username, session);
    }

    public static synchronized void addBuyingSession(String username, String coords) {
        BuyingSession session = new BuyingSession(coords);
        Shop shop = getShop(coords);
        if (shop != null) {
            if (shop.sellPrice > 0 && shop.buyPrice > 0) {
                session.mode = "none";
                session.step = 0;
            } else if (shop.buyPrice > 0) {
                session.mode = "sell";
                session.step = 1;
            } else {
                session.mode = "buy";
                session.step = 1;
            }
        } else {
            session.mode = "buy";
            session.step = 1;
        }
        buyingSessions.put(username, session);
    }

    public static synchronized boolean hasCreationSession(String username) {
        CreationSession session = creationSessions.get(username);
        if (session != null) {
            if (session.isExpired()) {
                creationSessions.remove(username);
                return false;
            }
            return true;
        }
        return false;
    }

    public static synchronized boolean hasBuyingSession(String username) {
        BuyingSession session = buyingSessions.get(username);
        if (session != null) {
            if (session.isExpired()) {
                buyingSessions.remove(username);
                return false;
            }
            return true;
        }
        return false;
    }

    public static synchronized boolean isBuyingMode(String username) {
        BuyingSession session = buyingSessions.get(username);
        return session != null && "buy".equals(session.mode);
    }

    public static synchronized String getBuyingSessionShopId(String username) {
        BuyingSession session = buyingSessions.get(username);
        return session != null ? session.coords : null;
    }

    public static synchronized void removeCreationSession(String username) {
        creationSessions.remove(username);
    }

    public static synchronized void removeBuyingSession(String username) {
        buyingSessions.remove(username);
    }

    public static synchronized void addRatingSession(String username, String shopId) {
        ratingSessions.put(username, new RatingSession(shopId));
    }

    public static synchronized boolean hasRatingSession(String username) {
        RatingSession session = ratingSessions.get(username);
        if (session != null && session.isExpired()) {
            ratingSessions.remove(username);
            return false;
        }
        return ratingSessions.containsKey(username);
    }

    public static synchronized void removeRatingSession(String username) {
        ratingSessions.remove(username);
    }

    public static synchronized void addPriceConfigSession(String username, String coords) {
        priceConfigSessions.put(username, new PriceConfigSession(coords));
    }

    public static synchronized boolean hasPriceConfigSession(String username) {
        PriceConfigSession session = priceConfigSessions.get(username);
        if (session != null && session.isExpired()) {
            priceConfigSessions.remove(username);
            return false;
        }
        return priceConfigSessions.containsKey(username);
    }

    public static synchronized void removePriceConfigSession(String username) {
        priceConfigSessions.remove(username);
    }

    public static synchronized boolean addShopRating(String shopId, int score) {
        Shop shop = getShop(shopId);
        if (shop == null) return false;
        if (shop.ratings == null) {
            shop.ratings = new java.util.ArrayList<>();
        }
        shop.ratings.add(score);
        save();
        return true;
    }

    public static synchronized double getAverageRating(String shopId) {
        Shop shop = getShop(shopId);
        if (shop == null || shop.ratings == null || shop.ratings.isEmpty()) {
            return 0.0;
        }
        double sum = 0;
        for (int r : shop.ratings) {
            sum += r;
        }
        return sum / shop.ratings.size();
    }

    public static synchronized String getAverageRatingString(String shopId) {
        double avg = getAverageRating(shopId);
        if (avg == 0.0) {
            return "N/A";
        }
        return String.format("%.1f ★", avg);
    }

    public static synchronized boolean canInteract(String username, String coords, boolean isOp) {
        String key = getNormalizedKey(coords);
        
        // Check if the block is a double chest and check neighbor's registration
        String dimension = getDimensionFromKey(key);
        String cleanCoords = getCleanCoords(key);
        String[] parts = cleanCoords.split(",");
        if (parts.length == 3) {
            try {
                int x = Integer.parseInt(parts[0]);
                int y = Integer.parseInt(parts[1]);
                int z = Integer.parseInt(parts[2]);
                net.minecraft.core.BlockPos pos = new net.minecraft.core.BlockPos(x, y, z);
                
                net.minecraft.server.level.ServerLevel world = getServerWorld(dimension);
                if (world != null) {
                    var state = world.getBlockState(pos);
                    if (state.getBlock() instanceof net.minecraft.world.level.block.ChestBlock) {
                        net.minecraft.world.level.block.state.properties.ChestType chestType = state.getValue(net.minecraft.world.level.block.ChestBlock.TYPE);
                        if (chestType == net.minecraft.world.level.block.state.properties.ChestType.LEFT || chestType == net.minecraft.world.level.block.state.properties.ChestType.RIGHT) {
                            net.minecraft.core.Direction facing = state.getValue(net.minecraft.world.level.block.ChestBlock.FACING);
                            net.minecraft.core.Direction dirToAttached = (chestType == net.minecraft.world.level.block.state.properties.ChestType.LEFT) 
                                ? facing.getClockWise() 
                                : facing.getCounterClockWise();
                            net.minecraft.core.BlockPos neighborPos = pos.relative(dirToAttached);
                            String neighborKey = dimension + ":" + neighborPos.getX() + "," + neighborPos.getY() + "," + neighborPos.getZ();
                            
                            Shop neighborShop = getShop(neighborKey);
                            if (neighborShop != null) {
                                if (!(neighborShop.player.equals(username) || isOp)) {
                                    return false;
                                }
                            }
                        }
                    }
                }
            } catch (Throwable t) {
                // Ignore and proceed
            }
        }

        Shop shop = getShop(key);
        if (shop == null) return true; // standard chest
        return shop.player.equals(username) || isOp;
    }

    public static synchronized String clickShopGUI(String username, String coords, String option, boolean isOp) {
        String key = getNormalizedKey(coords);
        Shop shop = getShop(key);
        if (shop == null) return "Shop not found";
        
        boolean isOwner = shop.player.equals(username) || isOp;
        switch (option.toLowerCase()) {
            case "teleport":
                return "Teleported to " + shop.coords;
            case "restock":
                if (!isOwner) return "Permission denied";
                return "Opened remote restock container";
            case "withdraw":
                if (!isOwner) return "Permission denied";
                double rev = shop.revenue;
                if (rev > 0) {
                    shop.revenue = 0;
                    com.craftcore.economy.EconomyManager.addMoney(username, rev);
                    save();
                    return "Withdrew " + rev;
                }
                return "No revenue to withdraw";
            case "delete":
                if (!isOwner) return "Permission denied";
                unregisterShop(key);
                return "Shop deleted";
            default:
                return "Invalid option";
        }
    }

    public static synchronized boolean remoteRestock(String username, String coords, int amount) {
        Shop shop = getShop(coords);
        if (shop == null) return false;
        if (!shop.player.equals(username)) return false;
        shop.stock += amount;
        save();
        return true;
    }

    public static synchronized ChatInterceptionResult handleChatInput(String username, String message) {
        net.minecraft.server.level.ServerPlayer player = null;
        net.minecraft.server.level.ServerLevel world = null;
        try {
            net.minecraft.server.MinecraftServer server = com.craftcore.event.ServerLifecycleHandler.serverInstance;
            if (server != null) {
                player = server.getPlayerList().getPlayerByName(username);
                if (player != null) {
                    world = (net.minecraft.server.level.ServerLevel) player.level();
                }
            }
        } catch (Throwable t) {
            // Ignore mock/test environment errors
        }
        return handleChatInput(username, message, player, world);
    }

    public static synchronized ChatInterceptionResult handleChatInput(String username, String message, net.minecraft.server.level.ServerPlayer player, net.minecraft.server.level.ServerLevel world) {
        CreationSession cSession = creationSessions.get(username);
        if (cSession != null) {
            if (cSession.isExpired()) {
                creationSessions.remove(username);
                return new ChatInterceptionResult(true, "Shop creation timed out.", false);
            }
            if (message.equalsIgnoreCase("cancel") || message.equals("取消")) {
                creationSessions.remove(username);
                return new ChatInterceptionResult(true, "Shop creation cancelled.", false);
            }
            
            if (!cSession.stepByStep) {
                creationSessions.remove(username);
                try {
                    double price = Double.parseDouble(message);
                    if (Double.isNaN(price) || Double.isInfinite(price) || price <= 0) {
                        return new ChatInterceptionResult(true, "Price must be a positive number.", false);
                    }
                    boolean registered = registerShop(username, cSession.coords, cSession.item, price, 0);
                    if (registered) {
                        return new ChatInterceptionResult(true, "Shop created successfully!", true);
                    } else {
                        return new ChatInterceptionResult(true, "Failed to create shop.", false);
                    }
                } catch (NumberFormatException e) {
                    return new ChatInterceptionResult(true, "Invalid price format. Please enter a valid number.", false);
                }
            }
            
            if (cSession.step == 1) {
                double sellPrice = 0.0;
                if (message.equalsIgnoreCase("none") || message.equals("0")) {
                    sellPrice = 0.0;
                } else {
                    try {
                        sellPrice = Double.parseDouble(message);
                        if (Double.isNaN(sellPrice) || Double.isInfinite(sellPrice) || sellPrice < 0) {
                            return new ChatInterceptionResult(true, "Invalid price format. Please enter a valid number.", false);
                        }
                    } catch (NumberFormatException e) {
                        return new ChatInterceptionResult(true, "Invalid price format. Please enter a valid number.", false);
                    }
                }
                cSession.sellPrice = sellPrice;
                cSession.step = 2;
                String step2Prompt = "§e【步驟 2/2】設定收購價格\n" +
                                     "§f- 請在聊天欄輸入「§b收購價格§f」（你向玩家收購商品的單價，如: 50）。\n" +
                                     "§f- 若不提供收購，請輸入「§c0§f」或「§cnone§f」。\n" +
                                     "§f- 輸入「§c取消§f」可放棄建立。";
                return new ChatInterceptionResult(true, step2Prompt, true);
            } else if (cSession.step == 2) {
                double buyPrice = 0.0;
                if (message.equalsIgnoreCase("none") || message.equals("0")) {
                    buyPrice = 0.0;
                } else {
                    try {
                        buyPrice = Double.parseDouble(message);
                        if (Double.isNaN(buyPrice) || Double.isInfinite(buyPrice) || buyPrice < 0) {
                            return new ChatInterceptionResult(true, "Invalid price format. Please enter a valid number.", false);
                        }
                    } catch (NumberFormatException e) {
                        return new ChatInterceptionResult(true, "Invalid price format. Please enter a valid number.", false);
                    }
                }
                
                creationSessions.remove(username);
                if (cSession.sellPrice <= 0.0 && buyPrice <= 0.0) {
                    return new ChatInterceptionResult(true, "Shop creation cancelled.", false);
                }
                
                boolean registered = registerShop(username, cSession.coords, cSession.item, cSession.sellPrice, buyPrice, 0);
                if (registered) {
                    return new ChatInterceptionResult(true, "Shop created successfully!", true);
                } else {
                    return new ChatInterceptionResult(true, "Failed to create shop.", false);
                }
            }
        }
        
        RatingSession rSession = ratingSessions.get(username);
        if (rSession != null) {
            if (rSession.isExpired()) {
                ratingSessions.remove(username);
                return new ChatInterceptionResult(true, "Rating session timed out.", false);
            }
            if (message.equalsIgnoreCase("cancel") || message.equals("取消")) {
                ratingSessions.remove(username);
                return new ChatInterceptionResult(true, "Rating cancelled.", false);
            }
            try {
                int score = Integer.parseInt(message.trim());
                if (score < 1 || score > 5) {
                    return new ChatInterceptionResult(true, "評分失敗：分數必須在 1 到 5 之間，請重新輸入：", false);
                }
                ratingSessions.remove(username);
                if (addShopRating(rSession.shopId, score)) {
                    return new ChatInterceptionResult(true, "§a評分成功！此商店目前的平均分數為 " + getAverageRatingString(rSession.shopId) + "。", true);
                } else {
                    return new ChatInterceptionResult(true, "§c評分失敗，該商店可能已不存在。", false);
                }
            } catch (NumberFormatException e) {
                return new ChatInterceptionResult(true, "§c格式錯誤！請輸入 1 到 5 的整數數字，或輸入「取消」離開：", false);
            }
        }

        PriceConfigSession pSession = priceConfigSessions.get(username);
        if (pSession != null) {
            if (pSession.isExpired()) {
                priceConfigSessions.remove(username);
                return new ChatInterceptionResult(true, "Price configuration timed out.", false);
            }
            if (message.equalsIgnoreCase("cancel") || message.equals("取消")) {
                priceConfigSessions.remove(username);
                return new ChatInterceptionResult(true, "Price configuration cancelled.", false);
            }
            Shop shop = getShop(pSession.coords);
            if (shop == null) {
                priceConfigSessions.remove(username);
                return new ChatInterceptionResult(true, "Shop no longer exists.", false);
            }
            if (pSession.step == 1) {
                double sellPrice = 0.0;
                if (!message.equalsIgnoreCase("none") && !message.equals("0")) {
                    try {
                        sellPrice = Double.parseDouble(message);
                        if (Double.isNaN(sellPrice) || Double.isInfinite(sellPrice) || sellPrice < 0) {
                            return new ChatInterceptionResult(true, "Invalid price format. Please enter a valid number.", false);
                        }
                    } catch (NumberFormatException e) {
                        return new ChatInterceptionResult(true, "Invalid price format. Please enter a valid number.", false);
                    }
                }
                pSession.sellPrice = sellPrice;
                pSession.step = 2;
                String step2Prompt = "§e【步驟 2/2】設定收購價格\n" +
                                     "§f- 請在聊天欄輸入「§b收購價格§f」（你向玩家收購商品的單價，如: 50）。\n" +
                                     "§f- 若不提供收購，請輸入「§c0§f」或「§cnone§f」。\n" +
                                     "§f- 輸入「§c取消§f」可放棄設定。";
                return new ChatInterceptionResult(true, step2Prompt, true);
            } else if (pSession.step == 2) {
                double buyPrice = 0.0;
                if (!message.equalsIgnoreCase("none") && !message.equals("0")) {
                    try {
                        buyPrice = Double.parseDouble(message);
                        if (Double.isNaN(buyPrice) || Double.isInfinite(buyPrice) || buyPrice < 0) {
                            return new ChatInterceptionResult(true, "Invalid price format. Please enter a valid number.", false);
                        }
                    } catch (NumberFormatException e) {
                        return new ChatInterceptionResult(true, "Invalid price format. Please enter a valid number.", false);
                    }
                }
                priceConfigSessions.remove(username);
                if (pSession.sellPrice <= 0.0 && buyPrice <= 0.0) {
                    return new ChatInterceptionResult(true, "Price configuration cancelled. Both prices cannot be 0.", false);
                }
                shop.sellPrice = pSession.sellPrice;
                shop.buyPrice = buyPrice;
                if (shop.sellPrice > 0.0) {
                    shop.price = shop.sellPrice;
                }
                save();
                try {
                    String[] parts = shop.coords.split(",");
                    if (parts.length == 3) {
                        int x = Integer.parseInt(parts[0]);
                        int y = Integer.parseInt(parts[1]);
                        int z = Integer.parseInt(parts[2]);
                        updateShopSign(world, new net.minecraft.core.BlockPos(x, y, z), shop);
                    }
                } catch (Throwable t) {}
                return new ChatInterceptionResult(true, "Prices updated successfully!", true);
            }
        }

        BuyingSession bSession = buyingSessions.get(username);
        if (bSession != null) {
            if (bSession.isExpired()) {
                buyingSessions.remove(username);
                return new ChatInterceptionResult(true, "Purchase timed out.", false);
            }
            if (message.equalsIgnoreCase("cancel") || message.equals("取消")) {
                buyingSessions.remove(username);
                return new ChatInterceptionResult(true, "Transaction cancelled.", false);
            }
            
            Shop shop = getShop(bSession.coords);
            if (shop == null) {
                buyingSessions.remove(username);
                return new ChatInterceptionResult(true, "Shop no longer exists.", false);
            }

            net.minecraft.world.item.Item shopItem = null;
            net.minecraft.world.Container chestInv = null;
            if (world != null) {
                String[] parts = shop.coords.split(",");
                int x = Integer.parseInt(parts[0]);
                int y = Integer.parseInt(parts[1]);
                int z = Integer.parseInt(parts[2]);
                net.minecraft.core.BlockPos shopPos = new net.minecraft.core.BlockPos(x, y, z);
                net.minecraft.world.level.block.entity.BlockEntity be = world.getBlockEntity(shopPos);
                if (be instanceof net.minecraft.world.Container) {
                    chestInv = (net.minecraft.world.Container) be;
                }
                try {
                    shopItem = net.minecraft.core.registries.BuiltInRegistries.ITEM.getValue(net.minecraft.resources.Identifier.parse(shop.item));
                } catch (Throwable t) {
                    // Fallback if registries are not initialized in mock test environment
                }
            }

            if (bSession.step == 0) {
                if (message.equals("買")) {
                    bSession.mode = "buy";
                    bSession.step = 1;
                    String buyPrompt = "§f您已選擇【購買】。請在聊天欄輸入欲購買的「§a數量§f」（如: 64），或輸入「取消」取消：";
                    return new ChatInterceptionResult(true, buyPrompt, true);
                } else if (message.equals("賣")) {
                    bSession.mode = "sell";
                    bSession.step = 1;
                    String sellPrompt = "§f您已選擇【出售】。請在聊天欄輸入欲出售的「§b數量§f」（如: 32），或輸入「取消」取消：";
                    return new ChatInterceptionResult(true, sellPrompt, true);
                } else {
                    return new ChatInterceptionResult(true, "Invalid choice. Please enter 「買」 or 「賣」, or 「取消」 to abort.", false);
                }
            }
            
            if (bSession.step == 1) {
                if (world != null) {
                    String cleanCoords = getCleanCoords(shop.id);
                    String[] parts = cleanCoords.split(",");
                    if (parts.length == 3) {
                        try {
                            int x = Integer.parseInt(parts[0]);
                            int y = Integer.parseInt(parts[1]);
                            int z = Integer.parseInt(parts[2]);
                            net.minecraft.core.BlockPos shopPos = new net.minecraft.core.BlockPos(x, y, z);
                            var state = world.getBlockState(shopPos);
                            if (!(state.getBlock() instanceof net.minecraft.world.level.block.ChestBlock)) {
                                com.craftcore.shop.ShopGuiManager.cleanupShopVisuals(world, shopPos);
                                unregisterShop(shop.id);
                                buyingSessions.remove(username);
                                return new ChatInterceptionResult(true, "Transaction cancelled: Shop chest was broken.", false);
                            }
                        } catch (Throwable t) {
                            // Proceed if coords parsing fails
                        }
                    }
                }

                boolean isAll = message.equalsIgnoreCase("all") || message.equals("全部");
                int quantity = 0;
                if (isAll) {
                    if (bSession.mode.equals("buy")) {
                        double activePrice = shop.sellPrice > 0 ? shop.sellPrice : shop.price;
                        double buyerBalance = com.craftcore.economy.EconomyManager.getBalance(username);
                        int maxFromBalance = (int) (buyerBalance / activePrice);
                        
                        int stockVal = Integer.MAX_VALUE;
                        if (!shop.infinite) {
                            if (chestInv != null) {
                                int actualStock = 0;
                                for (int i = 0; i < chestInv.getContainerSize(); i++) {
                                    net.minecraft.world.item.ItemStack stack = chestInv.getItem(i);
                                    if (!stack.isEmpty() && net.minecraft.core.registries.BuiltInRegistries.ITEM.getKey(stack.getItem()).toString().equals(shop.item)) {
                                        actualStock += stack.getCount();
                                    }
                                }
                                stockVal = actualStock;
                            } else {
                                stockVal = shop.stock;
                            }
                        }
                        
                        int playerSpace = Integer.MAX_VALUE;
                        if (player != null && shopItem != null) {
                            int spaceVal = 0;
                            int maxStack = shopItem.getDefaultMaxStackSize();
                            for (int i = 0; i < 36; i++) {
                                net.minecraft.world.item.ItemStack s = player.getInventory().getItem(i);
                                if (s.isEmpty()) {
                                    spaceVal += maxStack;
                                } else if (net.minecraft.core.registries.BuiltInRegistries.ITEM.getKey(s.getItem()).toString().equals(shop.item)) {
                                    spaceVal += (maxStack - s.getCount());
                                }
                            }
                            playerSpace = spaceVal;
                        }
                        
                        quantity = Math.min(maxFromBalance, Math.min(stockVal, playerSpace));
                        if (shop.bulkQuantity > 1) {
                            quantity = (quantity / shop.bulkQuantity) * shop.bulkQuantity;
                        }
                        if (quantity <= 0) {
                            return new ChatInterceptionResult(true, "Cannot resolve 'all' quantity (insufficient funds, stock, or inventory space).", false);
                        }
                    } else if (bSession.mode.equals("sell")) {
                        int maxFromOwnerBalance = Integer.MAX_VALUE;
                        if (!shop.infinite) {
                            double ownerBalance = com.craftcore.economy.EconomyManager.getBalance(shop.player);
                            maxFromOwnerBalance = (int) (ownerBalance / shop.buyPrice);
                        }
                        
                        int chestSpace = Integer.MAX_VALUE;
                        if (!shop.infinite) {
                            if (chestInv != null && shopItem != null) {
                                int spaceVal = 0;
                                int maxStack = shopItem.getDefaultMaxStackSize();
                                for (int i = 0; i < chestInv.getContainerSize(); i++) {
                                    net.minecraft.world.item.ItemStack s = chestInv.getItem(i);
                                    if (s.isEmpty()) {
                                        spaceVal += maxStack;
                                    } else if (net.minecraft.core.registries.BuiltInRegistries.ITEM.getKey(s.getItem()).toString().equals(shop.item)) {
                                        spaceVal += (maxStack - s.getCount());
                                    }
                                }
                                chestSpace = spaceVal;
                            }
                        }
                        
                        int playerItemCount = 0;
                        if (player != null) {
                            for (int i = 0; i < 36; i++) {
                                net.minecraft.world.item.ItemStack stack = player.getInventory().getItem(i);
                                if (!stack.isEmpty() && net.minecraft.core.registries.BuiltInRegistries.ITEM.getKey(stack.getItem()).toString().equals(shop.item)) {
                                    playerItemCount += stack.getCount();
                                }
                            }
                        }
                        
                        quantity = Math.min(maxFromOwnerBalance, Math.min(chestSpace, playerItemCount));
                        if (shop.bulkQuantity > 1) {
                            quantity = (quantity / shop.bulkQuantity) * shop.bulkQuantity;
                        }
                        if (quantity <= 0) {
                            return new ChatInterceptionResult(true, "Cannot resolve 'all' quantity (insufficient shop funds, chest space, or item count).", false);
                        }
                    }
                } else {
                    try {
                        quantity = Integer.parseInt(message);
                        if (quantity <= 0) {
                            return new ChatInterceptionResult(true, "Quantity must be a positive integer.", false);
                        }
                    } catch (NumberFormatException e) {
                        return new ChatInterceptionResult(true, "Invalid quantity format. Please enter a valid integer.", false);
                    }
                }

                buyingSessions.remove(username);

                if (bSession.mode.equals("buy")) {
                    if (shop.bulkQuantity > 1 && quantity % shop.bulkQuantity != 0) {
                        return new ChatInterceptionResult(true, "Quantity must be a multiple of " + shop.bulkQuantity + ".", false);
                    }
                    double activePrice = shop.sellPrice > 0 ? shop.sellPrice : shop.price;
                    if (activePrice <= 0) {
                        return new ChatInterceptionResult(true, "This shop is not selling items.", false);
                    }
                    double totalCost = activePrice * quantity;
                    double buyerBalance = com.craftcore.economy.EconomyManager.getBalance(username);
                    if (buyerBalance < totalCost) {
                        return new ChatInterceptionResult(true, "Insufficient funds.", false);
                    }

                    double tax = totalCost * 0.05;
                    double netRevenue = totalCost - tax;

                    if (shop.infinite) {
                        int playerSpace = Integer.MAX_VALUE;
                        if (player != null && shopItem != null) {
                            int spaceVal = 0;
                            int maxStack = shopItem.getDefaultMaxStackSize();
                            for (int i = 0; i < 36; i++) {
                                net.minecraft.world.item.ItemStack s = player.getInventory().getItem(i);
                                if (s.isEmpty()) {
                                    spaceVal += maxStack;
                                } else if (net.minecraft.core.registries.BuiltInRegistries.ITEM.getKey(s.getItem()).toString().equals(shop.item)) {
                                    spaceVal += (maxStack - s.getCount());
                                }
                            }
                            playerSpace = spaceVal;
                        }
                        if (playerSpace < quantity) {
                            return new ChatInterceptionResult(true, "Not enough space in your inventory.", false);
                        }

                        com.craftcore.economy.EconomyManager.removeMoney(username, totalCost);
                        if (player != null && shopItem != null) {
                            int maxStack = shopItem.getDefaultMaxStackSize();
                            int remainingToAdd = quantity;
                            for (int i = 0; i < 36 && remainingToAdd > 0; i++) {
                                net.minecraft.world.item.ItemStack s = player.getInventory().getItem(i);
                                if (!s.isEmpty() && net.minecraft.core.registries.BuiltInRegistries.ITEM.getKey(s.getItem()).toString().equals(shop.item)) {
                                    int count = s.getCount();
                                    int canAdd = maxStack - count;
                                    if (canAdd > 0) {
                                        int toAdd = Math.min(canAdd, remainingToAdd);
                                        s.setCount(count + toAdd);
                                        remainingToAdd -= toAdd;
                                    }
                                }
                            }
                            for (int i = 0; i < 36 && remainingToAdd > 0; i++) {
                                net.minecraft.world.item.ItemStack s = player.getInventory().getItem(i);
                                if (s.isEmpty()) {
                                    int toAdd = Math.min(maxStack, remainingToAdd);
                                    player.getInventory().setItem(i, new net.minecraft.world.item.ItemStack(shopItem, toAdd));
                                    remainingToAdd -= toAdd;
                                }
                            }
                            player.getInventory().setChanged();
                        }
                    } else {
                        if (chestInv != null && shopItem != null) {
                            int actualStock = 0;
                            for (int i = 0; i < chestInv.getContainerSize(); i++) {
                                net.minecraft.world.item.ItemStack stack = chestInv.getItem(i);
                                if (!stack.isEmpty() && net.minecraft.core.registries.BuiltInRegistries.ITEM.getKey(stack.getItem()).toString().equals(shop.item)) {
                                    actualStock += stack.getCount();
                                }
                            }
                            if (actualStock < quantity) {
                                return new ChatInterceptionResult(true, "Not enough stock in shop.", false);
                            }

                            int playerSpace = 0;
                            int maxStack = shopItem.getDefaultMaxStackSize();
                            for (int i = 0; i < 36; i++) {
                                net.minecraft.world.item.ItemStack s = player.getInventory().getItem(i);
                                if (s.isEmpty()) {
                                    playerSpace += maxStack;
                                } else if (net.minecraft.core.registries.BuiltInRegistries.ITEM.getKey(s.getItem()).toString().equals(shop.item)) {
                                    playerSpace += (maxStack - s.getCount());
                                }
                            }
                            if (playerSpace < quantity) {
                                return new ChatInterceptionResult(true, "Not enough space in your inventory.", false);
                            }

                            com.craftcore.economy.EconomyManager.removeMoney(username, totalCost);
                            shop.revenue += netRevenue;

                            int remainingToRemove = quantity;
                            for (int i = 0; i < chestInv.getContainerSize() && remainingToRemove > 0; i++) {
                                net.minecraft.world.item.ItemStack s = chestInv.getItem(i);
                                if (!s.isEmpty() && net.minecraft.core.registries.BuiltInRegistries.ITEM.getKey(s.getItem()).toString().equals(shop.item)) {
                                    int count = s.getCount();
                                    if (count <= remainingToRemove) {
                                        remainingToRemove -= count;
                                        chestInv.setItem(i, net.minecraft.world.item.ItemStack.EMPTY);
                                    } else {
                                        s.setCount(count - remainingToRemove);
                                        remainingToRemove = 0;
                                    }
                                }
                            }
                            chestInv.setChanged();

                            int remainingToAdd = quantity;
                            for (int i = 0; i < 36 && remainingToAdd > 0; i++) {
                                net.minecraft.world.item.ItemStack s = player.getInventory().getItem(i);
                                if (!s.isEmpty() && net.minecraft.core.registries.BuiltInRegistries.ITEM.getKey(s.getItem()).toString().equals(shop.item)) {
                                    int count = s.getCount();
                                    int canAdd = maxStack - count;
                                    if (canAdd > 0) {
                                        int toAdd = Math.min(canAdd, remainingToAdd);
                                        s.setCount(count + toAdd);
                                        remainingToAdd -= toAdd;
                                    }
                                }
                            }
                            for (int i = 0; i < 36 && remainingToAdd > 0; i++) {
                                net.minecraft.world.item.ItemStack s = player.getInventory().getItem(i);
                                if (s.isEmpty()) {
                                    int toAdd = Math.min(maxStack, remainingToAdd);
                                    player.getInventory().setItem(i, new net.minecraft.world.item.ItemStack(shopItem, toAdd));
                                    remainingToAdd -= toAdd;
                                }
                            }
                            player.getInventory().setChanged();

                            int newStock = 0;
                            for (int i = 0; i < chestInv.getContainerSize(); i++) {
                                net.minecraft.world.item.ItemStack stack = chestInv.getItem(i);
                                if (!stack.isEmpty() && net.minecraft.core.registries.BuiltInRegistries.ITEM.getKey(stack.getItem()).toString().equals(shop.item)) {
                                    newStock += stack.getCount();
                                }
                            }
                            shop.stock = newStock;
                            save();
                        } else {
                            if (shop.stock < quantity) {
                                return new ChatInterceptionResult(true, "Not enough stock in shop.", false);
                            }
                            com.craftcore.economy.EconomyManager.removeMoney(username, totalCost);
                            shop.stock -= quantity;
                            shop.revenue += netRevenue;
                            save();
                        }
                    }

                    long now = System.currentTimeMillis();
                    TransactionLog log = new TransactionLog("buy", username, shop.player, shop.item, quantity, totalCost, now);
                    addTransactionLog(log);

                    com.craftcore.websocket.Packet.TransactionLogPayload payload = new com.craftcore.websocket.Packet.TransactionLogPayload(
                        now, shop.coords, username, shop.player, shop.item, quantity, activePrice, tax, netRevenue
                    );
                    try {
                        var ws = com.craftcore.CraftCoreMod.getWSClient();
                        if (ws != null && ws.isAuthenticated()) {
                            ws.send(new com.craftcore.websocket.Packet("transaction_log", payload));
                        }
                    } catch (Throwable t) {
                        // ignore
                    }

                    String receipt = String.format("§a[Craft-Core] 購買成功！\n§b總付金額: $%.2f\n§e營業稅 (5%% 銷毀): $%.2f\n§c賣家實收金額: $%.2f", totalCost, tax, netRevenue);
                    return new ChatInterceptionResult(true, receipt, true);

                } else if (bSession.mode.equals("sell")) {
                    if (shop.bulkQuantity > 1 && quantity % shop.bulkQuantity != 0) {
                        return new ChatInterceptionResult(true, "Quantity must be a multiple of " + shop.bulkQuantity + ".", false);
                    }
                    if (shop.buyPrice <= 0) {
                        return new ChatInterceptionResult(true, "This shop is not buying items.", false);
                    }
                    double totalCost = shop.buyPrice * quantity;
                    if (!shop.infinite) {
                        double ownerBalance = com.craftcore.economy.EconomyManager.getBalance(shop.player);
                        if (ownerBalance < totalCost) {
                            return new ChatInterceptionResult(true, "Shop player has insufficient funds.", false);
                        }
                    }

                    double tax = totalCost * 0.05;
                    double netRevenue = totalCost - tax;

                    if (shop.infinite) {
                        if (player != null && shopItem != null) {
                            int playerItemCount = 0;
                            for (int i = 0; i < 36; i++) {
                                net.minecraft.world.item.ItemStack stack = player.getInventory().getItem(i);
                                if (!stack.isEmpty() && net.minecraft.core.registries.BuiltInRegistries.ITEM.getKey(stack.getItem()).toString().equals(shop.item)) {
                                    playerItemCount += stack.getCount();
                                }
                            }
                            if (playerItemCount < quantity) {
                                return new ChatInterceptionResult(true, "You do not have enough items to sell.", false);
                            }

                            com.craftcore.economy.EconomyManager.addMoney(username, netRevenue);

                            int remainingToRemove = quantity;
                            for (int i = 0; i < 36 && remainingToRemove > 0; i++) {
                                net.minecraft.world.item.ItemStack s = player.getInventory().getItem(i);
                                if (!s.isEmpty() && net.minecraft.core.registries.BuiltInRegistries.ITEM.getKey(s.getItem()).toString().equals(shop.item)) {
                                    int count = s.getCount();
                                    if (count <= remainingToRemove) {
                                        remainingToRemove -= count;
                                        player.getInventory().setItem(i, net.minecraft.world.item.ItemStack.EMPTY);
                                    } else {
                                        s.setCount(count - remainingToRemove);
                                        remainingToRemove = 0;
                                    }
                                }
                            }
                            player.getInventory().setChanged();
                        } else {
                            com.craftcore.economy.EconomyManager.addMoney(username, netRevenue);
                        }
                    } else {
                        if (chestInv != null && shopItem != null) {
                            int playerItemCount = 0;
                            for (int i = 0; i < 36; i++) {
                                net.minecraft.world.item.ItemStack stack = player.getInventory().getItem(i);
                                if (!stack.isEmpty() && net.minecraft.core.registries.BuiltInRegistries.ITEM.getKey(stack.getItem()).toString().equals(shop.item)) {
                                    playerItemCount += stack.getCount();
                                }
                            }
                            if (playerItemCount < quantity) {
                                return new ChatInterceptionResult(true, "You do not have enough items to sell.", false);
                            }

                            int chestSpace = 0;
                            int maxStack = shopItem.getDefaultMaxStackSize();
                            for (int i = 0; i < chestInv.getContainerSize(); i++) {
                                net.minecraft.world.item.ItemStack s = chestInv.getItem(i);
                                if (s.isEmpty()) {
                                    chestSpace += maxStack;
                                } else if (net.minecraft.core.registries.BuiltInRegistries.ITEM.getKey(s.getItem()).toString().equals(shop.item)) {
                                    chestSpace += (maxStack - s.getCount());
                                }
                            }
                            if (chestSpace < quantity) {
                                return new ChatInterceptionResult(true, "Not enough space in shop chest.", false);
                            }

                            com.craftcore.economy.EconomyManager.removeMoney(shop.player, totalCost);
                            com.craftcore.economy.EconomyManager.addMoney(username, netRevenue);

                            int remainingToRemove = quantity;
                            for (int i = 0; i < 36 && remainingToRemove > 0; i++) {
                                net.minecraft.world.item.ItemStack s = player.getInventory().getItem(i);
                                if (!s.isEmpty() && net.minecraft.core.registries.BuiltInRegistries.ITEM.getKey(s.getItem()).toString().equals(shop.item)) {
                                    int count = s.getCount();
                                    if (count <= remainingToRemove) {
                                        remainingToRemove -= count;
                                        player.getInventory().setItem(i, net.minecraft.world.item.ItemStack.EMPTY);
                                    } else {
                                        s.setCount(count - remainingToRemove);
                                        remainingToRemove = 0;
                                    }
                                }
                            }
                            player.getInventory().setChanged();

                            int remainingToAdd = quantity;
                            for (int i = 0; i < chestInv.getContainerSize() && remainingToAdd > 0; i++) {
                                net.minecraft.world.item.ItemStack s = chestInv.getItem(i);
                                if (!s.isEmpty() && net.minecraft.core.registries.BuiltInRegistries.ITEM.getKey(s.getItem()).toString().equals(shop.item)) {
                                    int count = s.getCount();
                                    int canAdd = maxStack - count;
                                    if (canAdd > 0) {
                                        int toAdd = Math.min(canAdd, remainingToAdd);
                                        s.setCount(count + toAdd);
                                        remainingToAdd -= toAdd;
                                    }
                                }
                            }
                            for (int i = 0; i < chestInv.getContainerSize() && remainingToAdd > 0; i++) {
                                net.minecraft.world.item.ItemStack s = chestInv.getItem(i);
                                if (s.isEmpty()) {
                                    int toAdd = Math.min(maxStack, remainingToAdd);
                                    chestInv.setItem(i, new net.minecraft.world.item.ItemStack(shopItem, toAdd));
                                    remainingToAdd -= toAdd;
                                }
                            }
                            chestInv.setChanged();

                            int newStock = 0;
                            for (int i = 0; i < chestInv.getContainerSize(); i++) {
                                net.minecraft.world.item.ItemStack stack = chestInv.getItem(i);
                                if (!stack.isEmpty() && net.minecraft.core.registries.BuiltInRegistries.ITEM.getKey(stack.getItem()).toString().equals(shop.item)) {
                                    newStock += stack.getCount();
                                }
                            }
                            shop.stock = newStock;
                            save();
                        } else {
                            com.craftcore.economy.EconomyManager.removeMoney(shop.player, totalCost);
                            com.craftcore.economy.EconomyManager.addMoney(username, netRevenue);
                            shop.stock += quantity;
                            save();
                        }
                    }

                    long now = System.currentTimeMillis();
                    TransactionLog log = new TransactionLog("sell", username, shop.player, shop.item, quantity, totalCost, now);
                    addTransactionLog(log);

                    com.craftcore.websocket.Packet.TransactionLogPayload payload = new com.craftcore.websocket.Packet.TransactionLogPayload(
                        now, shop.coords, shop.player, username, shop.item, quantity, shop.buyPrice, tax, netRevenue
                    );
                    try {
                        var ws = com.craftcore.CraftCoreMod.getWSClient();
                        if (ws != null && ws.isAuthenticated()) {
                            ws.send(new com.craftcore.websocket.Packet("transaction_log", payload));
                        }
                    } catch (Throwable t) {
                        // ignore
                    }

                    String receipt = String.format("§a[Craft-Core] 出售成功！\n§b總交易金額: $%.2f\n§e營業稅 (5%% 銷毀): $%.2f\n§a實收金額: $%.2f", totalCost, tax, netRevenue);
                    return new ChatInterceptionResult(true, receipt, true);
                }
            }
        }
        
        return new ChatInterceptionResult(false, null, false);
    }

    public static synchronized boolean setBulkQuantity(String coords, int quantity) {
        if (quantity <= 0) return false;
        String key = getNormalizedKey(coords);
        Shop shop = shopMap.get(key);
        if (shop == null) return false;
        shop.bulkQuantity = quantity;
        save();
        
        try {
            net.minecraft.server.MinecraftServer server = com.craftcore.event.ServerLifecycleHandler.serverInstance;
            if (server != null) {
                net.minecraft.server.level.ServerLevel world = getServerWorld(shop.dimension);
                if (world != null) {
                    String cleanCoords = getCleanCoords(key);
                    String[] parts = cleanCoords.split(",");
                    if (parts.length == 3) {
                        int x = Integer.parseInt(parts[0]);
                        int y = Integer.parseInt(parts[1]);
                        int z = Integer.parseInt(parts[2]);
                        net.minecraft.core.BlockPos chestPos = new net.minecraft.core.BlockPos(x, y, z);
                        updateShopSign(world, chestPos, shop);
                    }
                }
            }
        } catch (Throwable t) {
            // Safe fallback
        }
        
        return true;
    }

    public static void updateShopSign(net.minecraft.server.level.ServerLevel world, net.minecraft.core.BlockPos pos, Shop shop) {
        try {
            var chestState = world.getBlockState(pos);
            net.minecraft.core.Direction facing = net.minecraft.core.Direction.NORTH;
            if (chestState.getBlock() instanceof net.minecraft.world.level.block.ChestBlock && chestState.hasProperty(net.minecraft.world.level.block.ChestBlock.FACING)) {
                facing = chestState.getValue(net.minecraft.world.level.block.ChestBlock.FACING);
            }
            net.minecraft.core.BlockPos signPos = pos.relative(facing);
            var be = world.getBlockEntity(signPos);
            if (be instanceof net.minecraft.world.level.block.entity.SignBlockEntity sign) {
                net.minecraft.world.item.Item itemObj = net.minecraft.core.registries.BuiltInRegistries.ITEM.getValue(net.minecraft.resources.Identifier.parse(shop.item));
                net.minecraft.network.chat.Component line3Text;
                if (itemObj != net.minecraft.world.item.Items.AIR) {
                    line3Text = net.minecraft.network.chat.Component.translatable(itemObj.getDescriptionId());
                } else {
                    line3Text = net.minecraft.network.chat.Component.literal(shop.item.replace("minecraft:", ""));
                }
                
                String line4Str = "";
                int bulk = shop.bulkQuantity;
                double sellPrice = shop.sellPrice;
                double buyPrice = shop.buyPrice;
                if (bulk > 1) {
                    if (sellPrice > 0 && buyPrice > 0) {
                        line4Str = "§a" + bulk + " @ 售" + sellPrice + "|收" + buyPrice;
                    } else if (sellPrice > 0) {
                        line4Str = "§a售: " + bulk + " @ $" + sellPrice;
                    } else if (buyPrice > 0) {
                        line4Str = "§a收: " + bulk + " @ $" + buyPrice;
                    }
                } else {
                    if (sellPrice > 0 && buyPrice > 0) {
                        line4Str = "§a售" + sellPrice + " | 收" + buyPrice;
                    } else if (sellPrice > 0) {
                        line4Str = "§a售: " + sellPrice;
                    } else if (buyPrice > 0) {
                        line4Str = "§a收: " + buyPrice;
                    }
                }
                final String finalLine4 = line4Str;
                sign.updateText(text -> text.setHasGlowingText(true)
                    .setMessage(0, net.minecraft.network.chat.Component.literal(shop.infinite ? "§d[無限商店]" : "§1[商店]"))
                    .setMessage(1, net.minecraft.network.chat.Component.literal(shop.customName != null ? shop.customName : shop.player))
                    .setMessage(2, line3Text)
                    .setMessage(3, net.minecraft.network.chat.Component.literal(finalLine4)), true);
                sign.setChanged();
                world.sendBlockUpdated(signPos, sign.getBlockState(), sign.getBlockState(), 3);
            }
        } catch (Throwable t) {
            // Safe fallback
        }
    }
}
