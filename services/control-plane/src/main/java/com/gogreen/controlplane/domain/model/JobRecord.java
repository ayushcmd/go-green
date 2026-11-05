package com.gogreen.controlplane.domain.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JobRecord {
    private String jobId;
    private String workloadType;
    private String workerId;
    private String status; // PENDING, RUNNING, COMPLETED, FAILED, TIMEOUT, CANCELLED
    private String requiredArchitecture;
    private List<String> requiredInstructionSets;
    private byte[] payload;
    private byte[] resultPayload;
    private String errorDetails;
    private double executionDurationMs;
    private Instant createdAt;
    private Instant startedAt;
    private Instant completedAt;
}
