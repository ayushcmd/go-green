package com.gogreen.controlplane.api.rest;

import com.gogreen.controlplane.domain.service.WorkerRegistryService;
import com.gogreen.controlplane.infrastructure.persistence.entity.WorkerEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collection;

@RestController
@RequestMapping("/api/v1/mesh/workers")
@CrossOrigin(origins = "*")
public class WorkerController {

    private final WorkerRegistryService workerRegistryService;

    public WorkerController(WorkerRegistryService workerRegistryService) {
        this.workerRegistryService = workerRegistryService;
    }

    @GetMapping
    public ResponseEntity<Collection<WorkerEntity>> listWorkers() {
        return ResponseEntity.ok(workerRegistryService.getAllWorkers());
    }

    @GetMapping("/{workerId}")
    public ResponseEntity<WorkerEntity> getWorker(@PathVariable String workerId) {
        return workerRegistryService.getWorker(workerId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
