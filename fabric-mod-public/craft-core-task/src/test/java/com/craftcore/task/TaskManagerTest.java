package com.craftcore.task;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

public class TaskManagerTest {

    @BeforeEach
    public void setUp() {
        AiDailyTaskManager.loadTasks();
    }

    @Test
    public void testDailyTasks() {
        DailyTaskManager.DailyTaskDef[] tasks = DailyTaskManager.getDailyTasks("2026-08-07");
        assertNotNull(tasks);
        assertEquals(2, tasks.length);
        assertEquals(1, tasks[0].type); // Slay
        assertEquals(2, tasks[1].type); // Mine
    }

    @Test
    public void testAiDailyTasks() {
        List<AiDailyTaskManager.AiTask> tasks = AiDailyTaskManager.getDailyTasks();
        assertNotNull(tasks);
        assertFalse(tasks.isEmpty());
    }
}
