package com.gogreen.controlplane.api.rest;

import com.gogreen.controlplane.domain.model.JobRecord;
import com.gogreen.controlplane.domain.service.JobSchedulerService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collection;

@RestController
@RequestMapping("/api/v1/mesh/jobs")
@CrossOrigin(origins = "*")
public class JobController {

    private final JobSchedulerService jobSchedulerService;

    public JobController(JobSchedulerService jobSchedulerService) {
        this.jobSchedulerService = jobSchedulerService;
    }

    @GetMapping
    public ResponseEntity<Collection<JobRecord>> listJobs() {
        return ResponseEntity.ok(jobSchedulerService.getAllJobs());
    }

    @GetMapping("/{jobId}")
    public ResponseEntity<JobRecord> getJob(@PathVariable String jobId) {
        return jobSchedulerService.getJob(jobId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
