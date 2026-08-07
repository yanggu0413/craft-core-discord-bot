package com.craftcore.claim;

import com.craftcore.api.EconomyAPI;
import com.craftcore.api.EconomyChangeEvent;
import com.craftcore.api.EconomyChangeListener;
import com.craftcore.api.EconomyChangeReason;
import com.craftcore.api.EconomyResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import static org.junit.jupiter.api.Assertions.*;

public class ClaimTransferTest {

    private static class TestEconomyProvider implements EconomyAPI {
        private final Map<String, Double> balances = new ConcurrentHashMap<>();

        @Override public double getBalance(UUID uuid) { return 0; }
        @Override public boolean setBalance(UUID uuid, double amount, EconomyChangeReason reason) { return false; }
        @Override public boolean addMoney(UUID uuid, double amount, EconomyChangeReason reason) { return false; }
        @Override public boolean removeMoney(UUID uuid, double amount, EconomyChangeReason reason) { return false; }
        @Override public boolean hasMoney(UUID uuid, double amount) { return false; }

        @Override public double getBalance(String username) { return balances.getOrDefault(username.toLowerCase(), 0.0); }
        @Override public boolean setBalance(String username, double amount, EconomyChangeReason reason) {
            balances.put(username.toLowerCase(), amount);
            return true;
        }
        @Override public boolean addMoney(String username, double amount, EconomyChangeReason reason) {
            balances.put(username.toLowerCase(), getBalance(username) + amount);
            return true;
        }
        @Override public boolean removeMoney(String username, double amount, EconomyChangeReason reason) {
            double current = getBalance(username);
            if (current >= amount) {
                balances.put(username.toLowerCase(), current - amount);
                return true;
            }
            return false;
        }
        @Override public boolean hasMoney(String username, double amount) { return getBalance(username) >= amount; }
        @Override public EconomyResult transferMoney(UUID sender, UUID recipient, double amount) { return EconomyResult.success("Success", amount); }
        @Override public EconomyResult transferMoney(String sender, String recipient, double amount) { return EconomyResult.success("Success", amount); }
        @Override public void registerChangeListener(EconomyChangeListener listener) {}
        @Override public void unregisterChangeListener(EconomyChangeListener listener) {}
        @Override public void fireEconomyChangeEvent(EconomyChangeEvent event) {}
    }

    @BeforeEach
    public void setUp() {
        EconomyAPI.registerProvider(new TestEconomyProvider());
        EconomyAPI.getProvider().setBalance("SenderPlayer", 1000.0);
        EconomyAPI.getProvider().setBalance("ReceiverPlayer", 100.0);
    }

    @Test
    public void testTransferRequestAndAcceptance() {
        String from = "SenderPlayer";
        String to = "ReceiverPlayer";
        String claimId = "test_claim_01";
        String claimName = "豪宅領地";

        // Create request
        ClaimManager.addTransferRequest(from, to, claimId, claimName);

        ClaimManager.TransferRequest req = ClaimManager.getTransferRequest(to);
        assertNotNull(req);
        assertEquals(from, req.fromPlayer);
        assertEquals(to, req.toPlayer);
        assertEquals(claimId, req.claimId);
        assertEquals(claimName, req.claimName);

        // Check Receiver Balance & Deduct $30 via EconomyAPI
        double balance = EconomyAPI.getProvider().getBalance(to);
        assertTrue(balance >= 30.0);
        EconomyAPI.getProvider().removeMoney(to, 30.0);

        assertEquals(70.0, EconomyAPI.getProvider().getBalance(to), 0.001);

        ClaimManager.removeTransferRequest(to);
        assertNull(ClaimManager.getTransferRequest(to));
    }
}
