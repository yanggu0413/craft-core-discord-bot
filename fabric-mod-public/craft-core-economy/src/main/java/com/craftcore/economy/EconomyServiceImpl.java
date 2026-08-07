package com.craftcore.economy;

import com.craftcore.api.EconomyAPI;
import com.craftcore.api.EconomyChangeEvent;
import com.craftcore.api.EconomyChangeListener;
import com.craftcore.api.EconomyChangeReason;
import com.craftcore.api.EconomyResult;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

public class EconomyServiceImpl implements EconomyAPI {
    private final CopyOnWriteArrayList<EconomyChangeListener> listeners = new CopyOnWriteArrayList<>();

    private String getUsernameByUuid(UUID uuid) {
        if (uuid == null) return null;
        String uuidStr = uuid.toString();
        Map<String, EconomyManager.PlayerData> map = EconomyManager.getDataMap();
        for (Map.Entry<String, EconomyManager.PlayerData> entry : map.entrySet()) {
            if (entry.getValue() != null && uuidStr.equalsIgnoreCase(entry.getValue().uuid)) {
                return entry.getKey();
            }
        }
        return uuidStr;
    }

    @Override
    public double getBalance(UUID uuid) {
        String username = getUsernameByUuid(uuid);
        return username != null ? EconomyManager.getBalance(username) : 0.0;
    }

    @Override
    public boolean setBalance(UUID uuid, double amount, EconomyChangeReason reason) {
        String username = getUsernameByUuid(uuid);
        if (username == null) return false;
        return setBalance(username, amount, reason);
    }

    @Override
    public boolean addMoney(UUID uuid, double amount, EconomyChangeReason reason) {
        String username = getUsernameByUuid(uuid);
        if (username == null) return false;
        return addMoney(username, amount, reason);
    }

    @Override
    public boolean removeMoney(UUID uuid, double amount, EconomyChangeReason reason) {
        String username = getUsernameByUuid(uuid);
        if (username == null) return false;
        return removeMoney(username, amount, reason);
    }

    @Override
    public boolean hasMoney(UUID uuid, double amount) {
        return getBalance(uuid) >= amount;
    }

    @Override
    public double getBalance(String username) {
        return EconomyManager.getBalance(username);
    }

    @Override
    public boolean setBalance(String username, double amount, EconomyChangeReason reason) {
        if (username == null) return false;
        double oldBalance = EconomyManager.getBalance(username);
        EconomyManager.setBalance(username, amount);
        double newBalance = EconomyManager.getBalance(username);
        fireEconomyChangeEvent(new EconomyChangeEvent(null, username, oldBalance, newBalance, reason));
        return true;
    }

    @Override
    public boolean addMoney(String username, double amount, EconomyChangeReason reason) {
        if (username == null) return false;
        double oldBalance = EconomyManager.getBalance(username);
        boolean success = EconomyManager.addMoney(username, amount);
        if (success) {
            double newBalance = EconomyManager.getBalance(username);
            fireEconomyChangeEvent(new EconomyChangeEvent(null, username, oldBalance, newBalance, reason));
        }
        return success;
    }

    @Override
    public boolean removeMoney(String username, double amount, EconomyChangeReason reason) {
        if (username == null) return false;
        double oldBalance = EconomyManager.getBalance(username);
        boolean success = EconomyManager.removeMoney(username, amount);
        if (success) {
            double newBalance = EconomyManager.getBalance(username);
            fireEconomyChangeEvent(new EconomyChangeEvent(null, username, oldBalance, newBalance, reason));
        }
        return success;
    }

    @Override
    public boolean hasMoney(String username, double amount) {
        return getBalance(username) >= amount;
    }

    @Override
    public EconomyResult transferMoney(UUID sender, UUID recipient, double amount) {
        String senderName = getUsernameByUuid(sender);
        String recipientName = getUsernameByUuid(recipient);
        if (senderName == null || recipientName == null) {
            return EconomyResult.failure("無法找到對應的玩家紀錄。");
        }
        return transferMoney(senderName, recipientName, amount);
    }

    @Override
    public EconomyResult transferMoney(String sender, String recipient, double amount) {
        EconomyManager.TransferResult res = EconomyManager.transferMoney(sender, recipient, amount);
        if (res.success) {
            return EconomyResult.success(res.message, amount);
        } else {
            return EconomyResult.failure(res.message);
        }
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
            } catch (Throwable ignored) {}
        }
    }
}
