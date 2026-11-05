package com.gogreen.controlplane.infrastructure.persistence.repository;

import com.gogreen.controlplane.infrastructure.persistence.entity.SchedulingDecisionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SchedulingDecisionRepository extends JpaRepository<SchedulingDecisionEntity, String> {
    List<SchedulingDecisionEntity> findByJobId(String jobId);
    List<SchedulingDecisionEntity> findBySelectedWorkerId(String workerId);
}
