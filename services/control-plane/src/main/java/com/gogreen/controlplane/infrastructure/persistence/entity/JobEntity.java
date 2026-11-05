package com.gogreen.controlplane.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "mesh_jobs")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JobEntity {

    @Id
    @Column(name = "job_id", length = 64, nullable = false)
    private String jobId;

    @Column(name = "workload_type", length = 64, nullable = false)
    private String workloadType; // CPU_INFORMATION, SYSTEM_TELEMETRY, NATIVE_BENCHMARK_SUITE

    @Column(name = "status", length = 32, nullable = false)
    private String status; // PENDING, QUEUED, ASSIGNED, RUNNING, COMPLETED, FAILED, CANCELLED, TIMED_OUT, RETRYING

    @Column(name = "assigned_worker_id", length = 64)
    private String assignedWorkerId;

    @Column(name = "required_architecture", length = 32)
    private String requiredArchitecture;

    @Column(name = "required_instruction_sets", length = 256)
    private String requiredInstructionSets; // Comma-delimited (e.g. "AVX2,FMA")

    @Column(name = "required_memory_bytes")
    private long requiredMemoryBytes;

    @Column(name = "required_cpu_shares")
    private int requiredCpuShares;

    @Column(name = "priority", nullable = false)
    private int priority; // Higher = scheduled first

    @Column(name = "timeout_seconds")
    private int timeoutSeconds;

    @Column(name = "idempotency_key", length = 128)
    private String idempotencyKey;

    @Column(name = "retry_count", nullable = false)
    private int retryCount;

    @Column(name = "max_retries", nullable = false)
    private int maxRetries;

    @Column(name = "payload")
    private byte[] payload;

    @Column(name = "result_payload")
    private byte[] resultPayload;

    @Column(name = "error_details", length = 1024)
    private String errorDetails;

    @Column(name = "execution_duration_ms")
    private double executionDurationMs;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "assigned_at")
    private Instant assignedAt;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "deadline_at")
    private Instant deadlineAt;

    public boolean isExpired() {
        if (deadlineAt == null) {
            return false;
        }
        return Instant.now().isAfter(deadlineAt);
    }
}
