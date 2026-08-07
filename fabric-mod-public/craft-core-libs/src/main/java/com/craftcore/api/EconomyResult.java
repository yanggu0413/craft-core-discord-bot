package com.craftcore.api;

public class EconomyResult {
    private final boolean success;
    private final String message;
    private final double amountTransferred;

    public EconomyResult(boolean success, String message, double amountTransferred) {
        this.success = success;
        this.message = message != null ? message : "";
        this.amountTransferred = amountTransferred;
    }

    public boolean isSuccess() {
        return success;
    }

    public String getMessage() {
        return message;
    }

    public double getAmountTransferred() {
        return amountTransferred;
    }

    public static EconomyResult success(String message, double amount) {
        return new EconomyResult(true, message, amount);
    }

    public static EconomyResult failure(String message) {
        return new EconomyResult(false, message, 0.0);
    }
}
