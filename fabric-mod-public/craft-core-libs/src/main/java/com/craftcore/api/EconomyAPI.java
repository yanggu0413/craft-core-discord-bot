package com.craftcore.api;

import java.util.UUID;

/**
 * Service API for managing server currency, balances, and transaction hooks.
 * Implemented by feature sub-modules (e.g. craft-core-economy) and consumed by all dependent modules.
 */
public interface EconomyAPI {

    // =========================================================
    // Core Balance Operations (UUID-based)
    // =========================================================
    double getBalance(UUID uuid);

    boolean setBalance(UUID uuid, double amount, EconomyChangeReason reason);

    boolean addMoney(UUID uuid, double amount, EconomyChangeReason reason);

    boolean removeMoney(UUID uuid, double amount, EconomyChangeReason reason);

    boolean hasMoney(UUID uuid, double amount);

    default boolean setBalance(UUID uuid, double amount) {
        return setBalance(uuid, amount, EconomyChangeReason.UNKNOWN);
    }

    default boolean addMoney(UUID uuid, double amount) {
        return addMoney(uuid, amount, EconomyChangeReason.UNKNOWN);
    }

    default boolean removeMoney(UUID uuid, double amount) {
        return removeMoney(uuid, amount, EconomyChangeReason.UNKNOWN);
    }

    // =========================================================
    // Convenience Overloads (String username-based)
    // =========================================================
    double getBalance(String username);

    boolean setBalance(String username, double amount, EconomyChangeReason reason);

    boolean addMoney(String username, double amount, EconomyChangeReason reason);

    boolean removeMoney(String username, double amount, EconomyChangeReason reason);

    boolean hasMoney(String username, double amount);

    default boolean setBalance(String username, double amount) {
        return setBalance(username, amount, EconomyChangeReason.UNKNOWN);
    }

    default boolean addMoney(String username, double amount) {
        return addMoney(username, amount, EconomyChangeReason.UNKNOWN);
    }

    default boolean removeMoney(String username, double amount) {
        return removeMoney(username, amount, EconomyChangeReason.UNKNOWN);
    }

    // =========================================================
    // Transfers & Batch Operations
    // =========================================================
    EconomyResult transferMoney(UUID sender, UUID recipient, double amount);

    EconomyResult transferMoney(String sender, String recipient, double amount);

    // =========================================================
    // Event Hook System
    // =========================================================
    void registerChangeListener(EconomyChangeListener listener);

    void unregisterChangeListener(EconomyChangeListener listener);

    void fireEconomyChangeEvent(EconomyChangeEvent event);

    // =========================================================
    // Service Provider Singleton & SPI Management
    // =========================================================
    final class ProviderHolder {
        private static volatile EconomyAPI provider = new DefaultFallbackEconomyProvider();
    }

    static void registerProvider(EconomyAPI newProvider) {
        if (newProvider != null) {
            ProviderHolder.provider = newProvider;
        }
    }

    static EconomyAPI getProvider() {
        return ProviderHolder.provider;
    }

    static boolean isDefaultProvider() {
        return ProviderHolder.provider != null && ProviderHolder.provider.getClass() == DefaultFallbackEconomyProvider.class;
    }

    static double balance(UUID uuid) {
        return getProvider().getBalance(uuid);
    }

    static boolean give(UUID uuid, double amount) {
        return getProvider().addMoney(uuid, amount, EconomyChangeReason.UNKNOWN);
    }

    static boolean take(UUID uuid, double amount) {
        return getProvider().removeMoney(uuid, amount, EconomyChangeReason.UNKNOWN);
    }
}
