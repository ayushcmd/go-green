package com.gogreen.controlplane.api.rest;

import com.gogreen.controlplane.domain.model.WorkerNode;
import com.gogreen.controlplane.domain.service.WorkerRegistryService;
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
    public ResponseEntity<Collection<WorkerNode>> listWorkers() {
        return ResponseEntity.ok(workerRegistryService.getAllWorkers());
    }

    @GetMapping("/{workerId}")
    public ResponseEntity<WorkerNode> getWorker(@PathVariable String workerId) {
        return workerRegistryService.getWorker(workerId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
