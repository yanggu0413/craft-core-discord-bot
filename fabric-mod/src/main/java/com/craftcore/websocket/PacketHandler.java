package com.craftcore.websocket;

import com.craftcore.websocket.Packet.*;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.text.Text;

public class PacketHandler {
    private static final Gson GSON = new Gson();

    public static void handle(String json, MinecraftServer server, CraftCoreWSClient client) {
        try {
            JsonObject jsonObject = JsonParser.parseString(json).getAsJsonObject();
            String type = jsonObject.get("type").getAsString();
            JsonObject payloadObj = jsonObject.getAsJsonObject("payload");

            switch (type) {
                case "auth_response": {
                    AuthResponsePayload payload = GSON.fromJson(payloadObj, AuthResponsePayload.class);
                    if (payload.success) {
                        System.out.println("[CraftCore] Authenticated successfully: " + payload.message);
                        client.setAuthenticated(true);
                        com.craftcore.event.ServerLifecycleHandler.startTelemetryLoop(server, client);
                    } else {
                        System.err.println("[CraftCore] Authentication failed: " + payload.message);
                        client.setAuthenticated(false);
                    }
                    break;
                }
                case "bind_code_response": {
                    BindCodeResponsePayload payload = GSON.fromJson(payloadObj, BindCodeResponsePayload.class);
                    server.execute(() -> {
                        net.minecraft.server.network.ServerPlayerEntity player = server.getPlayerManager().getPlayer(payload.username);
                        if (player != null) {
                            player.sendMessage(Text.literal(payload.message), false);
                        }
                    });
                    break;
                }
                case "chat": {
                    ChatPayload payload = GSON.fromJson(payloadObj, ChatPayload.class);
                    // Discord -> Game chat relay. Format: [Discord] sender: message
                    String formatted = "[Discord] " + payload.sender + ": " + payload.message;
                    server.execute(() -> {
                        server.getPlayerManager().broadcast(Text.literal(formatted), false);
                    });
                    break;
                }
                case "command_request": {
                    CommandRequestPayload payload = GSON.fromJson(payloadObj, CommandRequestPayload.class);
                    server.execute(() -> {
                        WSCommandOutput commandOutput = new WSCommandOutput();
                        ServerCommandSource source = server.getCommandSource()
                                .withOutput(commandOutput);
                        boolean success = true;
                        try {
                            server.getCommandManager().parseAndExecute(source, payload.command);
                        } catch (Exception e) {
                            success = false;
                            commandOutput.sendMessage(Text.literal("Error: " + e.getMessage()));
                        }
                        String output = commandOutput.getCapturedOutput();
                        if (output != null && (output.startsWith("Unknown or incomplete command") || output.trim().startsWith("Unknown or incomplete command"))) {
                            success = false;
                        }
                        CommandResponsePayload responsePayload = new CommandResponsePayload(payload.command_id, success, output);
                        client.send(new Packet("command_response", responsePayload));
                    });
                    break;
                }
                case "whitelist_action": {
                    WhitelistActionPayload payload = GSON.fromJson(payloadObj, WhitelistActionPayload.class);
                    server.execute(() -> {
                        WSCommandOutput commandOutput = new WSCommandOutput();
                        ServerCommandSource source = server.getCommandSource()
                                .withOutput(commandOutput);
                        String cmd = "whitelist " + payload.action + " " + payload.username;
                        try {
                            server.getCommandManager().parseAndExecute(source, cmd);
                        } catch (Exception e) {
                            commandOutput.sendMessage(Text.literal("Error: " + e.getMessage()));
                        }
                        String output = commandOutput.getCapturedOutput();
                        String cleanedOutput = output;
                        if (payload.username != null) {
                            cleanedOutput = output.replace(payload.username, "");
                        }
                        String lowerCleaned = cleanedOutput.toLowerCase();
                        boolean success = !lowerCleaned.contains("error") 
                                && !lowerCleaned.contains("invalid") 
                                && !lowerCleaned.contains("could not");
                        WhitelistResponsePayload responsePayload = new WhitelistResponsePayload(
                                payload.username,
                                payload.action,
                                success,
                                output
                        );
                        client.send(new Packet("whitelist_response", responsePayload));
                    });
                    break;
                }
            }
        } catch (Exception e) {
            System.err.println("[CraftCore] Error parsing or handling packet: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
