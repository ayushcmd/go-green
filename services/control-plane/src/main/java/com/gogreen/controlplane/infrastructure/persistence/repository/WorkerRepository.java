package com.gogreen.controlplane.infrastructure.persistence.repository;

import com.gogreen.controlplane.infrastructure.persistence.entity.WorkerEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WorkerRepository extends JpaRepository<WorkerEntity, String> {
    List<WorkerEntity> findByStatus(String status);
    List<WorkerEntity> findByStatusIn(List<String> statuses);
    List<WorkerEntity> findByAssignedPartition(String partition);
}
