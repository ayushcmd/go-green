package com.gogreen.controlplane.domain.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkerNode {
    private String workerId;
    private String hostname;
    private String operatingSystem;
    private String architecture;
    private String cpuVendor;
    private String cpuModel;
    private int physicalCores;
    private int logicalCores;
    @Builder.Default
    private List<String> supportedInstructionSets = new ArrayList<>();
    private long memoryTotalBytes;
    private String nativeEngineVersion;
    private String workerVersion;
    private String protocolVersion;
    @Builder.Default
    private Map<String, String> labels = new HashMap<>();

    private String assignedPartition;
    private String status; // IDLE, BUSY, DRAINING, DEGRADED, TERMINATING, DISCONNECTED
    private Instant registeredAt;
    private Instant lastHeartbeatAt;
    private long lastHeartbeatSequence;
    private double cpuUsagePercent;
    private long memoryUsedBytes;
    private int activeJobsCount;
    private String nativeDaemonStatus;
    private long uptimeSeconds;

    public boolean isExpired(long timeoutSeconds) {
        if (lastHeartbeatAt == null) {
            return true;
        }
        return Instant.now().minusSeconds(timeoutSeconds).isAfter(lastHeartbeatAt);
    }
}
