package com.craftcore.api;

import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

public class DefaultFallbackEconomyProvider implements EconomyAPI {
    private final CopyOnWriteArrayList<EconomyChangeListener> listeners = new CopyOnWriteArrayList<>();

    @Override
    public double getBalance(UUID uuid) {
        return 0.0;
    }

    @Override
    public boolean setBalance(UUID uuid, double amount, EconomyChangeReason reason) {
        return false;
    }

    @Override
    public boolean addMoney(UUID uuid, double amount, EconomyChangeReason reason) {
        return false;
    }

    @Override
    public boolean removeMoney(UUID uuid, double amount, EconomyChangeReason reason) {
        return false;
    }

    @Override
    public boolean hasMoney(UUID uuid, double amount) {
        return amount <= 0;
    }

    @Override
    public double getBalance(String username) {
        return 0.0;
    }

    @Override
    public boolean setBalance(String username, double amount, EconomyChangeReason reason) {
        return false;
    }

    @Override
    public boolean addMoney(String username, double amount, EconomyChangeReason reason) {
        return false;
    }

    @Override
    public boolean removeMoney(String username, double amount, EconomyChangeReason reason) {
        return false;
    }

    @Override
    public boolean hasMoney(String username, double amount) {
        return amount <= 0;
    }

    @Override
    public EconomyResult transferMoney(UUID sender, UUID recipient, double amount) {
        return EconomyResult.failure("§c[Craft-Core] 經濟模組 (craft-core-economy) 未安裝！");
    }

    @Override
    public EconomyResult transferMoney(String sender, String recipient, double amount) {
        return EconomyResult.failure("§c[Craft-Core] 經濟模組 (craft-core-economy) 未安裝！");
    }

    @Override
    public void registerChangeListener(EconomyChangeListener listener) {
        if (listener != null) {
            listeners.add(listener);
        }
    }

    @Override
    public void unregisterChangeListener(EconomyChangeListener listener) {
        if (listener != null) {
            listeners.remove(listener);
        }
    }

    @Override
    public void fireEconomyChangeEvent(EconomyChangeEvent event) {
        if (event == null) return;
        for (EconomyChangeListener listener : listeners) {
            try {
                listener.onEconomyChange(event);
            } catch (Throwable ignored) {
            }
        }
    }
}
