package com.craftcore;

import com.craftcore.websocket.WSCommandOutput;
import net.minecraft.network.chat.Component;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class CommandCapturerTest {

    @Test
    public void testCommandOutputCapture() {
        WSCommandOutput commandOutput = new WSCommandOutput();
        assertTrue(commandOutput.acceptsSuccess());
        assertTrue(commandOutput.acceptsFailure());
        assertFalse(commandOutput.shouldInformAdmins());

        commandOutput.sendSystemMessage(Component.literal("Banned player Steve"));
        assertEquals("Banned player Steve", commandOutput.getCapturedOutput());

        commandOutput.sendSystemMessage(Component.literal("Reason: Griefing"));
        assertEquals("Banned player Steve\nReason: Griefing", commandOutput.getCapturedOutput());
    }
}
