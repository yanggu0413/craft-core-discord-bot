package com.craftcore.e2e;

import com.craftcore.bounty.GlobalGoalManager;
import com.craftcore.machine.MachineManager;
import com.craftcore.title.TitleManager;
import com.craftcore.treasure.TreasureChestManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

public class MachineAndRetentionTest {

    @BeforeEach
    public void setup() {
        TitleManager.unlockTitle("TestPlayer", "§6[首席工程師]");
    }

    @Test
    public void testTitleManager() {
        Set<String> unlocked = TitleManager.getUnlockedTitles("TestPlayer");
        assertTrue(unlocked.contains("§6[首席工程師]"));

        boolean setSuccess = TitleManager.setActiveTitle("TestPlayer", "§6[首席工程師]");
        assertTrue(setSuccess);
        assertEquals("§6[首席工程師]", TitleManager.getActiveTitle("TestPlayer"));
    }

    @Test
    public void testGlobalGoalManager() {
        GlobalGoalManager.GoalData goal = GlobalGoalManager.getCurrentGoal();
        assertNotNull(goal);
        assertNotNull(goal.title);
        assertTrue(goal.targetCount > 0);
    }
}
