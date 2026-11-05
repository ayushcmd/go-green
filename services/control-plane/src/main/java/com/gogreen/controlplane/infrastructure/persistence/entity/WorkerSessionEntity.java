package com.gogreen.controlplane.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "mesh_worker_sessions")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkerSessionEntity {

    @Id
    @Column(name = "session_id", length = 64, nullable = false)
    private String sessionId;

    @Column(name = "worker_id", length = 64, nullable = false)
    private String workerId;

    @Column(name = "connected_at", nullable = false)
    private Instant connectedAt;

    @Column(name = "disconnected_at")
    private Instant disconnectedAt;

    @Column(name = "disconnect_reason", length = 256)
    private String disconnectReason;

    @Column(name = "heartbeats_received")
    private long heartbeatsReceived;

    @Column(name = "jobs_completed")
    private int jobsCompleted;
}
