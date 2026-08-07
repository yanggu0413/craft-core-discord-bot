package com.craftcore.config;

public class ModConfig {
    public String server_name = "Craft-Core";
    public String default_language = "zh_tw";
    public String prefix = "[&6%server_name%&r] ";
    public boolean debug_mode = false;
    public EconomyConfig economy = new EconomyConfig();

    public static class EconomyConfig {
        public String currency_symbol = "$";
        public double starting_balance = 1000.0;

        public String getCurrencySymbol() {
            return currency_symbol;
        }

        public double getStartingBalance() {
            return starting_balance;
        }
    }

    public String getServerName() {
        return server_name;
    }

    public String getDefaultLanguage() {
        return default_language;
    }

    public String getPrefix() {
        return prefix;
    }

    public boolean isDebugMode() {
        return debug_mode;
    }

    public EconomyConfig getEconomy() {
        return economy;
    }
}
