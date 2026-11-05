package com.gogreen.controlplane.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "mesh_worker_transitions")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkerStateTransitionEntity {

    @Id
    @Column(name = "transition_id", length = 64, nullable = false)
    private String transitionId;

    @Column(name = "worker_id", length = 64, nullable = false)
    private String workerId;

    @Column(name = "from_status", length = 32, nullable = false)
    private String fromStatus;

    @Column(name = "to_status", length = 32, nullable = false)
    private String toStatus;

    @Column(name = "reason", length = 256)
    private String reason;

    @Column(name = "timestamp", nullable = false)
    private Instant timestamp;
}
