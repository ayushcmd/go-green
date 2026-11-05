package com.gogreen.controlplane.api.rest;

import com.gogreen.controlplane.domain.service.JobLifecycleService;
import com.gogreen.controlplane.domain.service.WorkerRegistryService;
import com.gogreen.controlplane.infrastructure.persistence.entity.JobEntity;
import com.gogreen.controlplane.infrastructure.persistence.entity.WorkerEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/mesh")
@CrossOrigin(origins = "*")
public class MeshStatusController {

    private final WorkerRegistryService workerRegistryService;
    private final JobLifecycleService jobLifecycleService;

    public MeshStatusController(WorkerRegistryService workerRegistryService, JobLifecycleService jobLifecycleService) {
        this.workerRegistryService = workerRegistryService;
        this.jobLifecycleService = jobLifecycleService;
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getMeshStatus() {
        Collection<WorkerEntity> workers = workerRegistryService.getAllWorkers();
        long activeWorkers = workers.stream()
                .filter(w -> !"DISCONNECTED".equals(w.getStatus()))
                .count();

        long totalLogicalCores = workers.stream()
                .filter(w -> !"DISCONNECTED".equals(w.getStatus()))
                .mapToInt(WorkerEntity::getLogicalCores)
                .sum();

        long totalMemoryBytes = workers.stream()
                .filter(w -> !"DISCONNECTED".equals(w.getStatus()))
                .mapToLong(WorkerEntity::getMemoryTotalBytes)
                .sum();

        List<JobEntity> jobs = jobLifecycleService.getAllJobs();
        long activeJobs = jobs.stream()
                .filter(j -> "ASSIGNED".equals(j.getStatus()) || "RUNNING".equals(j.getStatus()))
                .count();
        long completedJobs = jobs.stream()
                .filter(j -> "COMPLETED".equals(j.getStatus()))
                .count();
        long failedJobs = jobs.stream()
                .filter(j -> "FAILED".equals(j.getStatus()) || "TIMED_OUT".equals(j.getStatus()))
                .count();

        Map<String, Object> status = new LinkedHashMap<>();
        status.put("status", "healthy");
        status.put("coordinator_version", "1.1.0-phase3.5");
        status.put("active_workers", activeWorkers);
        status.put("total_registered_workers", workers.size());
        status.put("total_logical_cores", totalLogicalCores);
        status.put("total_memory_bytes", totalMemoryBytes);
        status.put("active_jobs", activeJobs);
        status.put("completed_jobs", completedJobs);
        status.put("failed_jobs", failedJobs);
        status.put("total_jobs", jobs.size());
        status.put("timestamp", Instant.now().toString());

        return ResponseEntity.ok(status);
    }
}
