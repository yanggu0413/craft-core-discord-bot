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
}
