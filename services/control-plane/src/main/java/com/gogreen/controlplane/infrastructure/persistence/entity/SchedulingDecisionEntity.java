package com.gogreen.controlplane.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "mesh_scheduling_decisions")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SchedulingDecisionEntity {

    @Id
    @Column(name = "decision_id", length = 64, nullable = false)
    private String decisionId;

    @Column(name = "job_id", length = 64, nullable = false)
    private String jobId;

    @Column(name = "selected_worker_id", length = 64, nullable = false)
    private String selectedWorkerId;

    @Column(name = "decision_reason", length = 512)
    private String decisionReason;

    @Column(name = "candidate_workers_count")
    private int candidateWorkersCount;

    @Column(name = "timestamp", nullable = false)
    private Instant timestamp;
}
