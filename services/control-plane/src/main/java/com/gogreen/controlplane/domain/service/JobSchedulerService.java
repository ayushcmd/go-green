package com.gogreen.controlplane.domain.service;

import com.gogreen.controlplane.domain.model.JobRecord;
import com.gogreen.mesh.v1.JobResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Collection;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class JobSchedulerService {
    private static final Logger log = LoggerFactory.getLogger(JobSchedulerService.class);

    private final ConcurrentHashMap<String, JobRecord> jobRecords = new ConcurrentHashMap<>();

    public void registerJobSubmission(JobRecord record) {
        jobRecords.put(record.getJobId(), record);
    }

    public void recordJobResult(JobResult result) {
        log.info("Recording job result: JobID={}, Status={}, Duration={}ms",
                result.getJobId(), result.getExecutionStatus(), result.getExecutionDurationMs());

        JobRecord record = jobRecords.computeIfAbsent(result.getJobId(), id -> JobRecord.builder()
                .jobId(id)
                .workerId(result.getWorkerId())
                .createdAt(Instant.now())
                .build());

        record.setStatus(result.getExecutionStatus().name().replace("EXECUTION_STATUS_", ""));
        record.setResultPayload(result.getResultPayload().toByteArray());
        record.setErrorDetails(result.getErrorDetails());
        record.setExecutionDurationMs(result.getExecutionDurationMs());
        record.setCompletedAt(Instant.now());
    }

    public Optional<JobRecord> getJob(String jobId) {
        return Optional.ofNullable(jobRecords.get(jobId));
    }

    public Collection<JobRecord> getAllJobs() {
        return jobRecords.values();
    }
}
