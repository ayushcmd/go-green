package com.gogreen.controlplane.infrastructure.persistence.repository;

import com.gogreen.controlplane.infrastructure.persistence.entity.WorkerStateTransitionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WorkerStateTransitionRepository extends JpaRepository<WorkerStateTransitionEntity, String> {
    List<WorkerStateTransitionEntity> findByWorkerIdOrderByTimestampDesc(String workerId);
}
