package com.craftcore.checkin;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class CheckInManagerTest {

    @BeforeEach
    public void setUp() {
        CheckInManager.load();
    }

    @Test
    public void testTaipeiDateNotNull() {
        String dateStr = CheckInManager.getTaipeiDate();
        assertNotNull(dateStr);
        assertTrue(dateStr.matches("\\d{4}-\\d{2}-\\d{2}"));
    }

    @Test
    public void testGetRecord() {
        CheckInManager.CheckInRecord record = CheckInManager.getRecord("TestPlayer123");
        assertNotNull(record);
        assertEquals("TestPlayer123", record.username);
    }
}
