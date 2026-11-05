package com.gogreen.controlplane.infrastructure.persistence.repository;

import com.gogreen.controlplane.infrastructure.persistence.entity.WorkerSessionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WorkerSessionRepository extends JpaRepository<WorkerSessionEntity, String> {
    List<WorkerSessionEntity> findByWorkerIdOrderByConnectedAtDesc(String workerId);
    Optional<WorkerSessionEntity> findFirstByWorkerIdAndDisconnectedAtIsNullOrderByConnectedAtDesc(String workerId);
}
