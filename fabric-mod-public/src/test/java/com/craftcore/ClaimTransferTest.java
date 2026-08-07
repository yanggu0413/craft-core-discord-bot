package com.craftcore;

import com.craftcore.claim.ClaimManager;
import com.craftcore.economy.EconomyManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class ClaimTransferTest {

    @BeforeEach
    public void setUp() {
        EconomyManager.setBalance("SenderPlayer", 1000.0);
        EconomyManager.setBalance("ReceiverPlayer", 100.0);
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

        // Check Receiver Balance & Deduct $30
        double balance = EconomyManager.getBalance(to);
        assertTrue(balance >= 30.0);
        EconomyManager.removeMoney(to, 30.0);

        assertEquals(70.0, EconomyManager.getBalance(to), 0.001);

        ClaimManager.removeTransferRequest(to);
        assertNull(ClaimManager.getTransferRequest(to));
    }
}
