package com.gogreen.controlplane.api.rest;

import com.gogreen.controlplane.domain.model.WorkerNode;
import com.gogreen.controlplane.domain.service.WorkerRegistryService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Collection;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/mesh")
@CrossOrigin(origins = "*")
public class MeshStatusController {

    private final WorkerRegistryService workerRegistryService;

    public MeshStatusController(WorkerRegistryService workerRegistryService) {
        this.workerRegistryService = workerRegistryService;
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getMeshStatus() {
        Collection<WorkerNode> workers = workerRegistryService.getAllWorkers();
        long activeWorkers = workers.stream()
                .filter(w -> !"DISCONNECTED".equals(w.getStatus()))
                .count();

        long totalLogicalCores = workers.stream()
                .filter(w -> !"DISCONNECTED".equals(w.getStatus()))
                .mapToInt(WorkerNode::getLogicalCores)
                .sum();

        long totalMemoryBytes = workers.stream()
                .filter(w -> !"DISCONNECTED".equals(w.getStatus()))
                .mapToLong(WorkerNode::getMemoryTotalBytes)
                .sum();

        return ResponseEntity.ok(Map.of(
                "status", "healthy",
                "coordinator_version", "1.0.0-phase3",
                "active_workers", activeWorkers,
                "total_registered_workers", workers.size(),
                "total_logical_cores", totalLogicalCores,
                "total_memory_bytes", totalMemoryBytes,
                "timestamp", Instant.now().toString()
        ));
    }
}
