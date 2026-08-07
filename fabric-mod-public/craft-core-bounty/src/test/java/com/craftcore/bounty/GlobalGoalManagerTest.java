package com.craftcore.bounty;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class GlobalGoalManagerTest {

    @BeforeEach
    public void setUp() {
        GlobalGoalManager.load();
    }

    @Test
    public void testCurrentGoalNotNull() {
        GlobalGoalManager.GoalData goal = GlobalGoalManager.getCurrentGoal();
        assertNotNull(goal);
        assertNotNull(goal.title);
        assertTrue(goal.targetCount > 0);
    }
}
