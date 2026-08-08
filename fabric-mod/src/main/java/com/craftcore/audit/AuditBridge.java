package com.craftcore.audit;

import com.craftcore.websocket.Packet;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

public class AuditBridge {
    private static final Map<String, CompletableFuture<List<Packet.AuditWarpEntry>>> warpQueries = new ConcurrentHashMap<>();
    private static final Map<String, CompletableFuture<Packet.AuditWarpDecisionResponsePayload>> decisions = new ConcurrentHashMap<>();

    public static void submitMachineAudit(String username, String uuid, String machineId, String name, double x, double y, double z, String dimension) {
        var client = com.craftcore.CraftCoreMod.getWSClient();
        if (client == null || !client.isAuthenticated()) return;
        Packet.AuditSubmitPayload p = new Packet.AuditSubmitPayload();
        p.username = username;
        p.uuid = uuid;
        p.machine_id = machineId;
        p.name = name;
        p.x = x;
        p.y = y;
        p.z = z;
        p.dimension = dimension;
        client.send(new Packet("audit_submit", p));
    }

    public static CompletableFuture<List<Packet.AuditWarpEntry>> queryPendingWarps() {
        CompletableFuture<List<Packet.AuditWarpEntry>> future = new CompletableFuture<>();
        var client = com.craftcore.CraftCoreMod.getWSClient();
        if (client == null || !client.isAuthenticated()) {
            future.complete(java.util.Collections.emptyList());
            return future;
        }
        String queryId = UUID.randomUUID().toString();
        warpQueries.put(queryId, future);
        Packet.AuditWarpsQueryPayload p = new Packet.AuditWarpsQueryPayload();
        p.query_id = queryId;
        client.send(new Packet("audit_query_warps", p));
        java.util.Timer timer = new java.util.Timer(true);
        timer.schedule(new java.util.TimerTask() {
            @Override
            public void run() {
                warpQueries.remove(queryId);
                future.complete(java.util.Collections.emptyList());
            }
        }, 5000);
        return future;
    }

    public static void resolveWarpQuery(String queryId, List<Packet.AuditWarpEntry> audits) {
        CompletableFuture<List<Packet.AuditWarpEntry>> f = warpQueries.remove(queryId);
        if (f != null) f.complete(audits != null ? audits : java.util.Collections.emptyList());
    }

    public static CompletableFuture<Packet.AuditWarpDecisionResponsePayload> decideWarp(String id, String action, String reviewer) {
        CompletableFuture<Packet.AuditWarpDecisionResponsePayload> future = new CompletableFuture<>();
        var client = com.craftcore.CraftCoreMod.getWSClient();
        if (client == null || !client.isAuthenticated()) {
            future.complete(null);
            return future;
        }
        String queryId = UUID.randomUUID().toString();
        decisions.put(queryId, future);
        Packet.AuditWarpDecisionPayload p = new Packet.AuditWarpDecisionPayload();
        p.query_id = queryId;
        p.id = id;
        p.action = action;
        p.reviewer = reviewer;
        client.send(new Packet("audit_warp_decision", p));
        return future;
    }

    public static void resolveDecision(String queryId, Packet.AuditWarpDecisionResponsePayload resp) {
        CompletableFuture<Packet.AuditWarpDecisionResponsePayload> f = decisions.remove(queryId);
        if (f != null) f.complete(resp);
    }
}
