package com.gogreen.controlplane.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "mesh_job_attempts")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JobExecutionAttemptEntity {

    @Id
    @Column(name = "attempt_id", length = 64, nullable = false)
    private String attemptId;

    @Column(name = "job_id", length = 64, nullable = false)
    private String jobId;

    @Column(name = "worker_id", length = 64, nullable = false)
    private String workerId;

    @Column(name = "attempt_number", nullable = false)
    private int attemptNumber;

    @Column(name = "status", length = 32, nullable = false)
    private String status; // RUNNING, COMPLETED, FAILED, TIMED_OUT

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "duration_ms")
    private double durationMs;

    @Column(name = "error_details", length = 1024)
    private String errorDetails;
}
