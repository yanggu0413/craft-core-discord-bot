package com.craftcore.websocket;

import java.util.List;

public class Packet {
    public String type;
    public Object payload;

    public Packet(String type, Object payload) {
        this.type = type;
        this.payload = payload;
    }

    public static class AuthPayload {
        public String secret;

        public AuthPayload(String secret) {
            this.secret = secret;
        }
    }

    public static class AuthResponsePayload {
        public boolean success;
        public String message;
    }

    public static class ChatPayload {
        public String sender;
        public String uuid;
        public String message;

        public ChatPayload(String sender, String uuid, String message) {
            this.sender = sender;
            this.uuid = uuid;
            this.message = message;
        }
    }

    public static class EventPayload {
        public String event_type; // "join", "leave", "death", "advancement"
        public String username;
        public String uuid;
        public String details;

        public EventPayload(String eventType, String username, String uuid, String details) {
            this.event_type = eventType;
            this.username = username;
            this.uuid = uuid;
            this.details = details;
        }
    }

    public static class StatusPayload {
        public boolean online;
        public double tps;
        public int ping;
        public int current_players;
        public int max_players;
        public List<String> players;

        public StatusPayload(boolean online, double tps, int ping, int currentPlayers, int maxPlayers, List<String> players) {
            this.online = online;
            this.tps = tps;
            this.ping = ping;
            this.current_players = currentPlayers;
            this.max_players = maxPlayers;
            this.players = players;
        }
    }

    public static class BindCodeRequestPayload {
        public String username;
        public String uuid;

        public BindCodeRequestPayload(String username, String uuid) {
            this.username = username;
            this.uuid = uuid;
        }
    }

    public static class BindCodeResponsePayload {
        public String username;
        public String code;
        public boolean success;
        public String message;
    }

    public static class WhitelistActionPayload {
        public String action; // "add", "remove"
        public String username;
    }

    public static class WhitelistResponsePayload {
        public String username;
        public String action;
        public boolean success;
        public String message;

        public WhitelistResponsePayload(String username, String action, boolean success, String message) {
            this.username = username;
            this.action = action;
            this.success = success;
            this.message = message;
        }
    }

    public static class CommandRequestPayload {
        public String command_id;
        public String command;
        public String admin_username;
    }

    public static class CommandResponsePayload {
        public String command_id;
        public boolean success;
        public String output;

        public CommandResponsePayload(String commandId, boolean success, String output) {
            this.command_id = commandId;
            this.success = success;
            this.output = output;
        }
    }

    public static class BalanceQueryPayload {
        public String username;
        public String query_id;
    }

    public static class BalanceResponsePayload {
        public String query_id;
        public String username;
        public double balance;
        public boolean success;
        public String message;

        public BalanceResponsePayload(String queryId, String username, double balance, boolean success, String message) {
            this.query_id = queryId;
            this.username = username;
            this.balance = balance;
            this.success = success;
            this.message = message;
        }
    }

    public static class ShopStatsQueryPayload {
        public String username;
        public String query_id;
    }

    public static class ShopStatsResponsePayload {
        public String query_id;
        public String username;
        public List<ShopEntry> shops;
        public boolean success;
        public String message;

        public ShopStatsResponsePayload(String queryId, String username, List<ShopEntry> shops, boolean success, String message) {
            this.query_id = queryId;
            this.username = username;
            this.shops = shops;
            this.success = success;
            this.message = message;
        }
    }

    public static class ShopEntry {
        public String location;
        public String owner;
        public String item;
        public int stock;
        public double buy_price;
        public double sell_price;
        public String custom_name;
        public double escrow_revenue;

        public ShopEntry(String location, String owner, String item, int stock, double buyPrice, double sellPrice, String customName, double escrowRevenue) {
            this.location = location;
            this.owner = owner;
            this.item = item;
            this.stock = stock;
            this.buy_price = buyPrice;
            this.sell_price = sellPrice;
            this.custom_name = customName;
            this.escrow_revenue = escrowRevenue;
        }
    }

    public static class TransactionLogPayload {
        public long timestamp;
        public String shop_coords;
        public String buyer;
        public String seller;
        public String item;
        public int quantity;
        public double unit_price;
        public double tax_deducted;
        public double net_profit;

        public TransactionLogPayload(long timestamp, String shopCoords, String buyer, String seller, String item, int quantity, double unitPrice, double taxDeducted, double netProfit) {
            this.timestamp = timestamp;
            this.shop_coords = shopCoords;
            this.buyer = buyer;
            this.seller = seller;
            this.item = item;
            this.quantity = quantity;
            this.unit_price = unitPrice;
            this.tax_deducted = taxDeducted;
            this.net_profit = netProfit;
        }
    }

    public static class RichListQueryPayload {
        public String query_id;
    }

    public static class RichListResponsePayload {
        public String query_id;
        public List<RichListEntry> players;
        public boolean success;
        public String message;

        public RichListResponsePayload(String queryId, List<RichListEntry> players, boolean success, String message) {
            this.query_id = queryId;
            this.players = players;
            this.success = success;
            this.message = message;
        }
    }

    public static class RichListEntry {
        public String username;
        public double balance;

        public RichListEntry(String username, double balance) {
            this.username = username;
            this.balance = balance;
        }
    }

    public static class RenameShopRequestPayload {
        public String query_id;
        public String coords;
        public String custom_name;
        public String username;
    }

    public static class GenericActionResponsePayload {
        public String query_id;
        public boolean success;
        public String message;
        public double amount;

        public GenericActionResponsePayload(String queryId, boolean success, String message, double amount) {
            this.query_id = queryId;
            this.success = success;
            this.message = message;
            this.amount = amount;
        }
    }

    public static class WithdrawRevenueRequestPayload {
        public String query_id;
        public String coords;
        public String username;
    }

    public static class UpgradeLimitRequestPayload {
        public String query_id;
        public String username;
    }

    public static class CheckinRequestPayload {
        public String username;
        public String uuid;

        public CheckinRequestPayload(String username, String uuid) {
            this.username = username;
            this.uuid = uuid;
        }
    }

    public static class CheckinResponsePayload {
        public String username;
        public boolean success;
        public String item;
        public int amount;
        public int keysAwarded;
        public int streak;
        public int keysCount;
        public String message;
    }

    public static class LuckydrawRequestPayload {
        public String username;
        public String uuid;

        public LuckydrawRequestPayload(String username, String uuid) {
            this.username = username;
            this.uuid = uuid;
        }
    }

    public static class LuckydrawResponsePayload {
        public String username;
        public boolean success;
        public String item;
        public int amount;
        public int keysLeft;
        public int keysCount;
        public String message;
    }

    public static class PlayerKeysUpdatePayload {
        public String username;
        public int keys;
    }

    public static class ClaimsQueryPayload {
        public String query_id;
    }

    public static class ClaimsResponsePayload {
        public String query_id;
        public List<ClaimEntry> claims;
        public boolean success;
        public String message;

        public ClaimsResponsePayload(String queryId, List<ClaimEntry> claims, boolean success, String message) {
            this.query_id = queryId;
            this.claims = claims;
            this.success = success;
            this.message = message;
        }
    }

    public static class ClaimEntry {
        public String id;
        public String name;
        public String owner;
        public int chunks;
        public String[] corners;
        public String dimension;
        public ClaimsPermissions permissions;

        public ClaimEntry(String id, String name, String owner, int chunks, String[] corners, String dimension, ClaimsPermissions permissions) {
            this.id = id;
            this.name = name;
            this.owner = owner;
            this.chunks = chunks;
            this.corners = corners;
            this.dimension = dimension;
            this.permissions = permissions;
        }
    }

    public static class ClaimsPermissions {
        public List<String> build;
        @com.google.gson.annotations.SerializedName("break")
        public List<String> breakBlocks;
        public List<String> containers;
        public List<String> interact;

        public ClaimsPermissions(List<String> build, List<String> breakBlocks, List<String> containers, List<String> interact) {
            this.build = build;
            this.breakBlocks = breakBlocks;
            this.containers = containers;
            this.interact = interact;
        }
    }

    public static class ClaimsPermissionUpdatePayload {
        public String query_id;
        public String claimId;
        public String permissionType; // "build" | "break" | "containers" | "interact"
        public String player;
        public String action; // "grant" | "revoke"
    }

    public static class LockboxesQueryPayload {
        public String query_id;
    }

    public static class LockboxesResponsePayload {
        public String query_id;
        public List<LockboxEntry> lockboxes;
        public boolean success;
        public String message;

        public LockboxesResponsePayload(String queryId, List<LockboxEntry> lockboxes, boolean success, String message) {
            this.query_id = queryId;
            this.lockboxes = lockboxes;
            this.success = success;
            this.message = message;
        }
    }

    public static class LockboxEntry {
        public String id;
        public String location;
        public String owner;
        public List<String> authorized;

        public LockboxEntry(String id, String location, String owner, List<String> authorized) {
            this.id = id;
            this.location = location;
            this.owner = owner;
            this.authorized = authorized;
        }
    }

    public static class JoinQueryPayload {
        public String username;
        public String uuid;

        public JoinQueryPayload(String username, String uuid) {
            this.username = username;
            this.uuid = uuid;
        }
    }

    public static class JoinResponsePayload {
        public String username;
        public boolean hasCheckedIn;
        public int pendingMailCount;
        public int keysCount;

        public JoinResponsePayload(String username, boolean hasCheckedIn, int pendingMailCount, int keysCount) {
            this.username = username;
            this.hasCheckedIn = hasCheckedIn;
            this.pendingMailCount = pendingMailCount;
            this.keysCount = keysCount;
        }
    }

    public static class DailyTasksQueryPayload {
        public String query_id;
        public String username;
    }

    public static class DailyTasksResponsePayload {
        public String query_id;
        public String username;
        public List<java.util.Map<String, Object>> tasks;
        public String date;
        public boolean success;

        public DailyTasksResponsePayload(String queryId, String username, List<java.util.Map<String, Object>> tasks, String date, boolean success) {
            this.query_id = queryId;
            this.username = username;
            this.tasks = tasks;
            this.date = date;
            this.success = success;
        }
    }

    public static class DailyTaskClaimRequestPayload {
        public String query_id;
        public String username;
    }

    public static class PlayerStatusQueryPayload {
        public String query_id;
        public String username;
    }

    public static class PlayerStatusResponsePayload {
        public String query_id;
        public boolean online;
        public String coords;
        public double tps;
        public boolean success;

        public PlayerStatusResponsePayload(String queryId, boolean online, String coords, double tps, boolean success) {
            this.query_id = queryId;
            this.online = online;
            this.coords = coords;
            this.tps = tps;
            this.success = success;
        }
    }

    public static class PlayerInventoryQueryPayload {
        public String query_id;
        public String username;
    }

    public static class PlayerInventoryResponsePayload {
        public String query_id;
        public boolean success;
        public List<InventoryItem> items;

        public PlayerInventoryResponsePayload(String queryId, boolean success, List<InventoryItem> items) {
            this.query_id = queryId;
            this.success = success;
            this.items = items;
        }
    }

    public static class InventoryItem {
        public int slot;
        public String itemId;
        public int count;
        public String displayName;
        public String nbt;

        public InventoryItem(int slot, String itemId, int count, String displayName, String nbt) {
            this.slot = slot;
            this.itemId = itemId;
            this.count = count;
            this.displayName = displayName;
            this.nbt = nbt;
        }
    }

    public static class TakeItemRequestPayload {
        public String query_id;
        public String username;
        public int slot;
        public int quantity;
        public String itemId;
    }

    public static class LockboxUpdatePayload {
        public String query_id;
        public String lockboxId;
        public String action; // grant | revoke | change_password | delete
        public String targetPlayer;
        public String newPassword;
    }

    public static class FakePlayersQueryPayload {
        public String query_id;
        public String username;
    }

    public static class FakePlayerEntry {
        public String name;
        public String owner;
        public boolean online;

        public FakePlayerEntry(String name, String owner, boolean online) {
            this.name = name;
            this.owner = owner;
            this.online = online;
        }
    }

    public static class FakePlayersResponsePayload {
        public String query_id;
        public java.util.List<FakePlayerEntry> fakeplayers;
        public boolean success;

        public FakePlayersResponsePayload(String queryId, java.util.List<FakePlayerEntry> fakeplayers, boolean success) {
            this.query_id = queryId;
            this.fakeplayers = fakeplayers;
            this.success = success;
        }
    }

    public static class WarpsQueryPayload {
        public String query_id;
    }

    public static class WarpEntry {
        public String name;
        public String coords;
        public String dimension;

        public WarpEntry(String name, String coords, String dimension) {
            this.name = name;
            this.coords = coords;
            this.dimension = dimension;
        }
    }

    public static class WarpsResponsePayload {
        public String query_id;
        public java.util.List<WarpEntry> warps;
        public boolean success;

        public WarpsResponsePayload(String queryId, java.util.List<WarpEntry> warps, boolean success) {
            this.query_id = queryId;
            this.warps = warps;
            this.success = success;
        }
    }

    public static class WarpUpsertPayload {
        public String query_id;
        public String name;
        public double x, y, z;
        public float yaw, pitch;
        public String dimension;
    }

    public static class HomesQueryPayload {
        public String query_id;
        public String username;
    }

    public static class HomeEntry {
        public String name;
        public String coords;
        public String dimension;

        public HomeEntry(String name, String coords, String dimension) {
            this.name = name;
            this.coords = coords;
            this.dimension = dimension;
        }
    }

    public static class HomesResponsePayload {
        public String query_id;
        public java.util.List<HomeEntry> homes;
        public boolean success;

        public HomesResponsePayload(String queryId, java.util.List<HomeEntry> homes, boolean success) {
            this.query_id = queryId;
            this.homes = homes;
            this.success = success;
        }
    }

    public static class TeleportUpdatePayload {
        public String query_id;
        public String type; // home | warp
        public String username; // only relevant for home
        public String name; // name of home or warp
        public String action; // delete
    }

    public static class PlaytimeQueryPayload {
        public String query_id;
        public String username;
    }

    public static class PlaytimeResponsePayload {
        public String query_id;
        public long play_time_ticks;
        public boolean success;
        public String message;

        public PlaytimeResponsePayload(String queryId, long playTimeTicks, boolean success, String message) {
            this.query_id = queryId;
            this.play_time_ticks = playTimeTicks;
            this.success = success;
            this.message = message;
        }
    }

    public static class PlaytimeExchangePayload {
        public String query_id;
        public String username;
        public String mode; // "single" or "all"
    }

    public static class PlaytimeExchangeResponsePayload {
        public String query_id;
        public boolean success;
        public int keys_added;
        public long ticks_deducted;
        public String message;

        public PlaytimeExchangeResponsePayload(String queryId, boolean success, int keysAdded, long ticksDeducted, String message) {
            this.query_id = queryId;
            this.success = success;
            this.keys_added = keysAdded;
            this.ticks_deducted = ticksDeducted;
            this.message = message;
        }
    }

    public static class PlayerTitleUpdatePayload {
        public String query_id;
        public String username;
        public String title_text;
        public String color_code;
        public boolean is_bold;
    }
}
