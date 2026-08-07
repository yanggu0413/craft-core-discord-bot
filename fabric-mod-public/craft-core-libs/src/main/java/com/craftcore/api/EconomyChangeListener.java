package com.craftcore.api;

@FunctionalInterface
public interface EconomyChangeListener {
    void onEconomyChange(EconomyChangeEvent event);
}
