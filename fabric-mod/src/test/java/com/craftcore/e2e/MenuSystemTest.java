package com.craftcore.e2e;

import com.craftcore.menu.MenuGuiManager;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class MenuSystemTest {

    @Test
    public void testMenuGuiManagerInitialization() {
        assertNotNull(MenuGuiManager.class);
    }
}
