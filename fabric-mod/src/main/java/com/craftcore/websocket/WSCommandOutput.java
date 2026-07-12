package com.craftcore.websocket;

import net.minecraft.commands.CommandSource;
import net.minecraft.network.chat.Component;

public class WSCommandOutput implements CommandSource {
    private final StringBuilder output = new StringBuilder();

    @Override
    public void sendSystemMessage(Component message) {
        output.append(message.getString()).append("\n");
    }

    @Override
    public boolean acceptsSuccess() {
        return true;
    }

    @Override
    public boolean acceptsFailure() {
        return true;
    }

    @Override
    public boolean shouldInformAdmins() {
        return false;
    }

    public String getCapturedOutput() {
        return output.toString().trim();
    }
}
