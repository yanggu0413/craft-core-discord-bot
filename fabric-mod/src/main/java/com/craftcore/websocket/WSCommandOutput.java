package com.craftcore.websocket;

import net.minecraft.server.command.CommandOutput;
import net.minecraft.text.Text;

public class WSCommandOutput implements CommandOutput {
    private final StringBuilder output = new StringBuilder();

    @Override
    public void sendMessage(Text message) {
        output.append(message.getString()).append("\n");
    }

    @Override
    public boolean shouldReceiveFeedback() {
        return true;
    }

    @Override
    public boolean shouldTrackOutput() {
        return true;
    }

    @Override
    public boolean shouldBroadcastConsoleToOps() {
        return false;
    }

    public String getCapturedOutput() {
        return output.toString().trim();
    }
}
