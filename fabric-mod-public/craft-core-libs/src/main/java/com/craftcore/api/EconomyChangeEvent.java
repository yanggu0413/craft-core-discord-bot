package com.craftcore.api;

import java.util.UUID;

public class EconomyChangeEvent {
    private final UUID playerUuid;
    private final String username;
    private final double oldBalance;
    private final double newBalance;
    private final double delta;
    private final EconomyChangeReason reason;
    private final long timestamp;

    public EconomyChangeEvent(UUID playerUuid, String username, double oldBalance, double newBalance, EconomyChangeReason reason) {
        this.playerUuid = playerUuid;
        this.username = username;
        this.oldBalance = oldBalance;
        this.newBalance = newBalance;
        this.delta = newBalance - oldBalance;
        this.reason = reason != null ? reason : EconomyChangeReason.UNKNOWN;
        this.timestamp = System.currentTimeMillis();
    }

    public UUID getPlayerUuid() {
        return playerUuid;
    }

    public String getUsername() {
        return username;
    }

    public double getOldBalance() {
        return oldBalance;
    }

    public double getNewBalance() {
        return newBalance;
    }

    public double getDelta() {
        return delta;
    }

    public EconomyChangeReason getReason() {
        return reason;
    }

    public long getTimestamp() {
        return timestamp;
    }
}
