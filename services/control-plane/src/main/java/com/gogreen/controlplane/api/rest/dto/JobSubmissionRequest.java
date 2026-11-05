package com.gogreen.controlplane.api.rest.dto;

import java.nio.charset.StandardCharsets;

public class JobSubmissionRequest {
    private String workloadType; // CPU_INFORMATION, SYSTEM_TELEMETRY, NATIVE_BENCHMARK_SUITE
    private String payload;
    private String requiredArchitecture;
    private String requiredInstructionSets; // comma-separated e.g. "AVX2,FMA"
    private Long requiredMemoryBytes;
    private Integer priority; // 1-100, default 50
    private Integer timeoutSeconds; // default 120
    private String idempotencyKey;
    private Integer maxRetries; // default 3

    public JobSubmissionRequest() {
    }

    public String getWorkloadType() {
        return workloadType;
    }

    public void setWorkloadType(String workloadType) {
        this.workloadType = workloadType;
    }

    public String getPayload() {
        return payload;
    }

    public void setPayload(String payload) {
        this.payload = payload;
    }

    public byte[] getPayloadBytes() {
        if (payload == null || payload.isBlank()) {
            return new byte[0];
        }
        return payload.getBytes(StandardCharsets.UTF_8);
    }

    public String getRequiredArchitecture() {
        return requiredArchitecture;
    }

    public void setRequiredArchitecture(String requiredArchitecture) {
        this.requiredArchitecture = requiredArchitecture;
    }

    public String getRequiredInstructionSets() {
        return requiredInstructionSets;
    }

    public void setRequiredInstructionSets(String requiredInstructionSets) {
        this.requiredInstructionSets = requiredInstructionSets;
    }

    public Long getRequiredMemoryBytes() {
        return requiredMemoryBytes != null ? requiredMemoryBytes : 0L;
    }

    public void setRequiredMemoryBytes(Long requiredMemoryBytes) {
        this.requiredMemoryBytes = requiredMemoryBytes;
    }

    public int getPriority() {
        return (priority != null && priority > 0) ? priority : 50;
    }

    public void setPriority(Integer priority) {
        this.priority = priority;
    }

    public int getTimeoutSeconds() {
        return (timeoutSeconds != null && timeoutSeconds > 0) ? timeoutSeconds : 120;
    }

    public void setTimeoutSeconds(Integer timeoutSeconds) {
        this.timeoutSeconds = timeoutSeconds;
    }

    public String getIdempotencyKey() {
        return idempotencyKey;
    }

    public void setIdempotencyKey(String idempotencyKey) {
        this.idempotencyKey = idempotencyKey;
    }

    public int getMaxRetries() {
        return (maxRetries != null && maxRetries >= 0) ? maxRetries : 3;
    }

    public void setMaxRetries(Integer maxRetries) {
        this.maxRetries = maxRetries;
    }
}
