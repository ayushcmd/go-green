package com.gogreen.controlplane.infrastructure.persistence.repository;

import com.gogreen.controlplane.infrastructure.persistence.entity.JobEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface JobRepository extends JpaRepository<JobEntity, String> {
    List<JobEntity> findByStatus(String status);
    List<JobEntity> findByStatusInOrderByPriorityDescCreatedAtAsc(List<String> statuses);
    List<JobEntity> findByAssignedWorkerId(String workerId);
    List<JobEntity> findByAssignedWorkerIdAndStatusIn(String workerId, List<String> statuses);
    Optional<JobEntity> findByIdempotencyKey(String idempotencyKey);
}
