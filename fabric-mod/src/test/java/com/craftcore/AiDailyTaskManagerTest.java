package com.craftcore;

import com.craftcore.task.AiDailyTaskManager;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

public class AiDailyTaskManagerTest {

    @Test
    public void testDailyTasksFallback() {
        List<AiDailyTaskManager.AiTask> tasks = AiDailyTaskManager.getDailyTasks();
        assertNotNull(tasks);
        assertFalse(tasks.isEmpty());
        assertEquals(5, tasks.size());

        AiDailyTaskManager.AiTask first = tasks.get(0);
        assertNotNull(first.id);
        assertNotNull(first.title);
        assertNotNull(first.type);
        assertNotNull(first.target);
        assertTrue(first.amount > 0);
    }

    @Test
    public void testPlayerDataState() {
        UUID testUuid = UUID.randomUUID();
        AiDailyTaskManager.PlayerTaskData data = AiDailyTaskManager.getPlayerData(testUuid);
        assertNotNull(data);
        assertNull(data.activeTaskId);
        assertEquals(0, data.activeProgress);
        assertNotNull(data.completedTaskIds);
    }
}
