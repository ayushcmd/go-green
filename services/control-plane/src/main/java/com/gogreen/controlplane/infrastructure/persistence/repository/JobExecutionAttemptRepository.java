package com.gogreen.controlplane.infrastructure.persistence.repository;

import com.gogreen.controlplane.infrastructure.persistence.entity.JobExecutionAttemptEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface JobExecutionAttemptRepository extends JpaRepository<JobExecutionAttemptEntity, String> {
    List<JobExecutionAttemptEntity> findByJobIdOrderByAttemptNumberAsc(String jobId);
    List<JobExecutionAttemptEntity> findByWorkerId(String workerId);
}
