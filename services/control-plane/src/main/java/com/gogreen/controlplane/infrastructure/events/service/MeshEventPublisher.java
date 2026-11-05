package com.gogreen.controlplane.infrastructure.events.service;

import com.gogreen.controlplane.infrastructure.events.model.MeshEvent;

public interface MeshEventPublisher {
    void publish(MeshEvent event);

    void publishWorkerRegistered(String workerId, String hostname, String arch, String isas);
    void publishWorkerHeartbeat(String workerId, long sequence, double cpuUsage, long memUsed);
    void publishWorkerDisconnected(String workerId, String reason);

    void publishJobSubmitted(String jobId, String workloadType, int priority);
    void publishJobAssigned(String jobId, String workerId);
    void publishJobStarted(String jobId, String workerId);
    void publishJobCompleted(String jobId, String workerId, double durationMs);
    void publishJobFailed(String jobId, String workerId, String errorDetails);
    void publishJobCancelled(String jobId, String reason);
}
