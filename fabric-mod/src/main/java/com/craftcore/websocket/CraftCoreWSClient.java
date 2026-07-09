package com.craftcore.websocket;

import com.craftcore.config.ConfigManager;
import com.craftcore.config.ModConfig;
import com.google.gson.Gson;
import net.minecraft.server.MinecraftServer;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

public class CraftCoreWSClient {
    private final MinecraftServer server;
    private WebSocket webSocket;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    private final AtomicBoolean authenticated = new AtomicBoolean(false);
    private final AtomicBoolean isConnecting = new AtomicBoolean(false);
    private long reconnectDelay = 1000;
    private final ConcurrentLinkedQueue<String> messageQueue = new ConcurrentLinkedQueue<>();
    private final AtomicBoolean isSending = new AtomicBoolean(false);

    public CraftCoreWSClient(MinecraftServer server) {
        this.server = server;
    }

    public void start() {
        connect();
    }

    public synchronized void connect() {
        if (isConnecting.get() || (webSocket != null && !webSocket.isInputClosed() && !webSocket.isOutputClosed())) {
            return;
        }

        isConnecting.set(true);
        authenticated.set(false);

        ModConfig config = ConfigManager.getConfig();
        String url = config.websocketUrl;
        System.out.println("[CraftCore] Connecting to WebSocket: " + url);

        HttpClient client = HttpClient.newHttpClient();
        client.newWebSocketBuilder()
                .buildAsync(URI.create(url), new WSListener())
                .whenComplete((ws, throwable) -> {
                    isConnecting.set(false);
                    if (throwable != null) {
                        System.err.println("[CraftCore] Connection failed: " + throwable.getMessage());
                        scheduleReconnect();
                    } else {
                        this.webSocket = ws;
                        System.out.println("[CraftCore] WebSocket connection established.");
                        sendAuth();
                    }
                });
    }

    private void sendAuth() {
        ModConfig config = ConfigManager.getConfig();
        Packet authPacket = new Packet("auth", new Packet.AuthPayload(config.serverSecret));
        send(authPacket);
    }

    public void send(Packet packet) {
        if (webSocket != null) {
            try {
                String json = new Gson().toJson(packet);
                messageQueue.offer(json);
                processQueue();
            } catch (Exception e) {
                System.err.println("[CraftCore] Error queueing packet: " + e.getMessage());
            }
        }
    }

    private void processQueue() {
        if (webSocket == null) {
            return;
        }
        if (!isSending.compareAndSet(false, true)) {
            return;
        }
        sendNext();
    }

    private void sendNext() {
        if (webSocket == null) {
            isSending.set(false);
            return;
        }
        String json = messageQueue.peek();
        if (json == null) {
            isSending.set(false);
            if (!messageQueue.isEmpty()) {
                processQueue();
            }
            return;
        }
        webSocket.sendText(json, true).whenComplete((ws, throwable) -> {
            if (throwable != null) {
                System.err.println("[CraftCore] Error sending message: " + throwable.getMessage());
            }
            messageQueue.poll();
            isSending.set(false);
            processQueue();
        });
    }

    public void setAuthenticated(boolean status) {
        this.authenticated.set(status);
        if (status) {
            reconnectDelay = 1000;
        }
    }

    public boolean isAuthenticated() {
        return authenticated.get();
    }

    public synchronized void close() {
        if (webSocket != null) {
            try {
                webSocket.sendClose(WebSocket.NORMAL_CLOSURE, "Server stopping").join();
            } catch (Exception ignored) {}
            webSocket = null;
        }
        messageQueue.clear();
        isSending.set(false);
        scheduler.shutdown();
    }

    private void scheduleReconnect() {
        long delay = reconnectDelay;
        reconnectDelay = Math.min(reconnectDelay * 2, 60000);
        System.out.println("[CraftCore] Reconnecting in " + (delay / 1000) + " seconds...");
        scheduler.schedule(this::connect, delay, TimeUnit.MILLISECONDS);
    }

    private class WSListener implements WebSocket.Listener {
        private final StringBuilder textBuffer = new StringBuilder();

        @Override
        public void onOpen(WebSocket webSocket) {
            webSocket.request(1);
        }

        @Override
        public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
            textBuffer.append(data);
            if (last) {
                String message = textBuffer.toString();
                textBuffer.setLength(0);
                PacketHandler.handle(message, server, CraftCoreWSClient.this);
            }
            webSocket.request(1);
            return null;
        }

        @Override
        public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
            System.out.println("[CraftCore] WebSocket closed: " + reason);
            setAuthenticated(false);
            scheduleReconnect();
            return null;
        }

        @Override
        public void onError(WebSocket webSocket, Throwable error) {
            System.err.println("[CraftCore] WebSocket error: " + error.getMessage());
            setAuthenticated(false);
            scheduleReconnect();
        }
    }
}
