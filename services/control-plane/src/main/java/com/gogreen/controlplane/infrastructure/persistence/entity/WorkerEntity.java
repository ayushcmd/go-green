package com.gogreen.controlplane.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "mesh_workers")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkerEntity {

    @Id
    @Column(name = "worker_id", length = 64, nullable = false)
    private String workerId;

    @Column(name = "hostname", length = 128)
    private String hostname;

    @Column(name = "operating_system", length = 64)
    private String operatingSystem;

    @Column(name = "architecture", length = 32)
    private String architecture;

    @Column(name = "cpu_vendor", length = 64)
    private String cpuVendor;

    @Column(name = "cpu_model", length = 128)
    private String cpuModel;

    @Column(name = "physical_cores")
    private int physicalCores;

    @Column(name = "logical_cores")
    private int logicalCores;

    @Column(name = "supported_instruction_sets", length = 512)
    private String supportedInstructionSets; // Comma-delimited (e.g. "SSE2,AVX,AVX2,FMA")

    @Column(name = "memory_total_bytes")
    private long memoryTotalBytes;

    @Column(name = "native_engine_version", length = 32)
    private String nativeEngineVersion;

    @Column(name = "worker_version", length = 32)
    private String workerVersion;

    @Column(name = "protocol_version", length = 32)
    private String protocolVersion;

    @Column(name = "assigned_partition", length = 64)
    private String assignedPartition;

    @Column(name = "status", length = 32, nullable = false)
    private String status; // IDLE, BUSY, DRAINING, DEGRADED, TERMINATING, DISCONNECTED

    @Column(name = "registered_at", nullable = false)
    private Instant registeredAt;

    @Column(name = "last_heartbeat_at")
    private Instant lastHeartbeatAt;

    @Column(name = "last_heartbeat_sequence")
    private long lastHeartbeatSequence;

    @Column(name = "cpu_usage_percent")
    private double cpuUsagePercent;

    @Column(name = "memory_used_bytes")
    private long memoryUsedBytes;

    @Column(name = "active_jobs_count")
    private int activeJobsCount;

    @Column(name = "native_daemon_status", length = 32)
    private String nativeDaemonStatus;

    @Column(name = "uptime_seconds")
    private long uptimeSeconds;

    public boolean isExpired(long timeoutSeconds) {
        if (lastHeartbeatAt == null) {
            return true;
        }
        return Instant.now().minusSeconds(timeoutSeconds).isAfter(lastHeartbeatAt);
    }

    public boolean supportsInstructionSet(String isa) {
        if (supportedInstructionSets == null || isa == null) {
            return false;
        }
        for (String s : supportedInstructionSets.split(",")) {
            if (s.trim().equalsIgnoreCase(isa.trim())) {
                return true;
            }
        }
        return false;
    }
}
