package com.gogreen.controlplane.infrastructure.events.model;

public final class MeshEventType {
    private MeshEventType() {}

    public static final String WORKER_REGISTERED = "worker.registered";
    public static final String WORKER_HEARTBEAT = "worker.heartbeat";
    public static final String WORKER_DISCONNECTED = "worker.disconnected";

    public static final String JOB_SUBMITTED = "job.submitted";
    public static final String JOB_ASSIGNED = "job.assigned";
    public static final String JOB_STARTED = "job.started";
    public static final String JOB_COMPLETED = "job.completed";
    public static final String JOB_FAILED = "job.failed";
    public static final String JOB_CANCELLED = "job.cancelled";
}
