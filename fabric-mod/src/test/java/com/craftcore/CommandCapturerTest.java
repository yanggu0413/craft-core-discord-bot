package com.craftcore;

import com.craftcore.websocket.WSCommandOutput;
import net.minecraft.text.Text;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class CommandCapturerTest {

    @Test
    public void testCommandOutputCapture() {
        WSCommandOutput commandOutput = new WSCommandOutput();
        assertTrue(commandOutput.shouldReceiveFeedback());
        assertTrue(commandOutput.shouldTrackOutput());
        assertFalse(commandOutput.shouldBroadcastConsoleToOps());

        commandOutput.sendMessage(Text.literal("Banned player Steve"));
        assertEquals("Banned player Steve", commandOutput.getCapturedOutput());

        commandOutput.sendMessage(Text.literal("Reason: Griefing"));
        assertEquals("Banned player Steve\nReason: Griefing", commandOutput.getCapturedOutput());
    }
}
