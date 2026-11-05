package com.gogreen.controlplane.api.rest;

import com.gogreen.controlplane.api.rest.dto.JobCancelRequest;
import com.gogreen.controlplane.api.rest.dto.JobSubmissionRequest;
import com.gogreen.controlplane.domain.service.JobLifecycleService;
import com.gogreen.controlplane.infrastructure.persistence.entity.JobEntity;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collection;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/mesh/jobs")
@CrossOrigin(origins = "*")
public class JobController {

    private final JobLifecycleService jobLifecycleService;

    public JobController(JobLifecycleService jobLifecycleService) {
        this.jobLifecycleService = jobLifecycleService;
    }

    @PostMapping
    public ResponseEntity<JobEntity> submitJob(@RequestBody JobSubmissionRequest request) {
        if (request.getWorkloadType() == null || request.getWorkloadType().isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        JobEntity job = jobLifecycleService.submitJob(
                request.getWorkloadType(),
                request.getPayloadBytes(),
                request.getRequiredArchitecture(),
                request.getRequiredInstructionSets(),
                request.getRequiredMemoryBytes(),
                request.getPriority(),
                request.getTimeoutSeconds(),
                request.getIdempotencyKey(),
                request.getMaxRetries()
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(job);
    }

    @GetMapping
    public ResponseEntity<Collection<JobEntity>> listJobs() {
        return ResponseEntity.ok(jobLifecycleService.getAllJobs());
    }

    @GetMapping("/{jobId}")
    public ResponseEntity<JobEntity> getJob(@PathVariable String jobId) {
        return jobLifecycleService.getJob(jobId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{jobId}/cancel")
    public ResponseEntity<Map<String, Object>> cancelJob(
            @PathVariable String jobId,
            @RequestBody(required = false) JobCancelRequest request) {
        String reason = (request != null) ? request.getReason() : "User requested cancellation";
        boolean cancelled = jobLifecycleService.cancelJob(jobId, reason);

        if (cancelled) {
            return ResponseEntity.ok(Map.of(
                    "jobId", jobId,
                    "status", "CANCELLED",
                    "reason", reason
            ));
        } else {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                    "jobId", jobId,
                    "error", "Job cannot be cancelled (either not found or already completed/failed)"
            ));
        }
    }
}
