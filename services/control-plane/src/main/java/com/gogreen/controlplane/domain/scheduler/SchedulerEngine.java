package com.gogreen.controlplane.domain.scheduler;

import com.gogreen.controlplane.infrastructure.persistence.entity.JobEntity;
import com.gogreen.controlplane.infrastructure.persistence.entity.SchedulingDecisionEntity;
import com.gogreen.controlplane.infrastructure.persistence.entity.WorkerEntity;
import com.gogreen.controlplane.infrastructure.persistence.repository.SchedulingDecisionRepository;
import com.gogreen.controlplane.infrastructure.persistence.repository.WorkerRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.*;

@Component
public class SchedulerEngine {
    private static final Logger log = LoggerFactory.getLogger(SchedulerEngine.class);

    private static final int MAX_ACTIVE_JOBS_PER_WORKER = 4;
    private static final double MAX_CPU_USAGE_PERCENT = 95.0;

    private static final Set<String> ALLOWED_WORKLOAD_TYPES = Set.of(
            "CPU_INFORMATION",
            "SYSTEM_TELEMETRY",
            "NATIVE_BENCHMARK_SUITE",
            "BINARY_ANALYSIS",
            "COMPILER_EXPLORER",
            "SANDBOX_EXECUTION"
    );

    private final WorkerRepository workerRepository;
    private final SchedulingDecisionRepository schedulingDecisionRepository;
    private final long heartbeatTimeoutSeconds;

    public SchedulerEngine(
            WorkerRepository workerRepository,
            SchedulingDecisionRepository schedulingDecisionRepository,
            @Value("${mesh.coordinator.grpc.heartbeat-timeout-seconds:10}") long heartbeatTimeoutSeconds) {
        this.workerRepository = workerRepository;
        this.schedulingDecisionRepository = schedulingDecisionRepository;
        this.heartbeatTimeoutSeconds = heartbeatTimeoutSeconds;
    }

    public record SchedulingResult(
            boolean successful,
            WorkerEntity selectedWorker,
            String reason,
            int candidateCount
    ) {}

    public SchedulingResult scheduleJob(JobEntity job) {
        if (job == null) {
            return new SchedulingResult(false, null, "Job is null", 0);
        }

        // 1. Validate Workload Type Allowlist
        if (!ALLOWED_WORKLOAD_TYPES.contains(job.getWorkloadType())) {
            log.error("Rejected scheduling for unauthorized workload type: {}", job.getWorkloadType());
            return new SchedulingResult(false, null, "Unauthorized workload type: " + job.getWorkloadType(), 0);
        }

        // 2. Fetch all workers currently eligible (IDLE or BUSY, not expired)
        List<WorkerEntity> allWorkers = workerRepository.findAll();
        List<WorkerEntity> eligibleWorkers = new ArrayList<>();

        for (WorkerEntity w : allWorkers) {
            if (isWorkerEligible(w, job)) {
                eligibleWorkers.add(w);
            }
        }

        if (eligibleWorkers.isEmpty()) {
            String rejectionReason = String.format(
                    "No eligible worker found for Job %s (Workload=%s, RequiredArch=%s, RequiredISAs=%s)",
                    job.getJobId(), job.getWorkloadType(), job.getRequiredArchitecture(), job.getRequiredInstructionSets());
            log.warn(rejectionReason);

            recordDecision(job.getJobId(), "NONE", rejectionReason, 0);
            return new SchedulingResult(false, null, rejectionReason, 0);
        }

        // 3. Load Balancing & Scoring
        // Sort candidates:
        // Priority 1: Fewer active jobs
        // Priority 2: Lower CPU usage percent
        // Priority 3: More free memory
        eligibleWorkers.sort((w1, w2) -> {
            int activeJobComp = Integer.compare(w1.getActiveJobsCount(), w2.getActiveJobsCount());
            if (activeJobComp != 0) {
                return activeJobComp;
            }
            int cpuComp = Double.compare(w1.getCpuUsagePercent(), w2.getCpuUsagePercent());
            if (cpuComp != 0) {
                return cpuComp;
            }
            long freeMem1 = w1.getMemoryTotalBytes() - w1.getMemoryUsedBytes();
            long freeMem2 = w2.getMemoryTotalBytes() - w2.getMemoryUsedBytes();
            return Long.compare(freeMem2, freeMem1); // descending free memory
        });

        WorkerEntity selectedWorker = eligibleWorkers.get(0);
        String reason = String.format(
                "Selected worker %s (ActiveJobs=%d, CPU=%.1f%%, Cores=%d, ISAs=%s) from %d candidates",
                selectedWorker.getWorkerId(), selectedWorker.getActiveJobsCount(),
                selectedWorker.getCpuUsagePercent(), selectedWorker.getLogicalCores(),
                selectedWorker.getSupportedInstructionSets(), eligibleWorkers.size());

        log.info("Scheduling Decision for Job {}: {}", job.getJobId(), reason);
        recordDecision(job.getJobId(), selectedWorker.getWorkerId(), reason, eligibleWorkers.size());

        return new SchedulingResult(true, selectedWorker, reason, eligibleWorkers.size());
    }

    public boolean isWorkerEligible(WorkerEntity worker, JobEntity job) {
        // A. Worker State & Liveness
        if (worker == null || "DISCONNECTED".equalsIgnoreCase(worker.getStatus())
                || "TERMINATING".equalsIgnoreCase(worker.getStatus())
                || "DRAINING".equalsIgnoreCase(worker.getStatus())) {
            return false;
        }

        if (worker.isExpired(heartbeatTimeoutSeconds)) {
            return false;
        }

        // B. Active Job Limit
        if (worker.getActiveJobsCount() >= MAX_ACTIVE_JOBS_PER_WORKER) {
            return false;
        }

        // C. CPU Capacity Guard
        if (worker.getCpuUsagePercent() >= MAX_CPU_USAGE_PERCENT) {
            return false;
        }

        // D. Architecture Matching
        if (job.getRequiredArchitecture() != null && !job.getRequiredArchitecture().isBlank()) {
            if (!job.getRequiredArchitecture().equalsIgnoreCase(worker.getArchitecture())) {
                return false;
            }
        }

        // E. ISA Compatibility (Crucial: Never schedule AVX2 on worker without AVX2)
        if (job.getRequiredInstructionSets() != null && !job.getRequiredInstructionSets().isBlank()) {
            String[] requiredISAs = job.getRequiredInstructionSets().split(",");
            for (String req : requiredISAs) {
                String trimmed = req.trim();
                if (!trimmed.isEmpty() && !worker.supportsInstructionSet(trimmed)) {
                    return false;
                }
            }
        }

        // F. Memory Requirements
        if (job.getRequiredMemoryBytes() > 0) {
            long availableMemory = worker.getMemoryTotalBytes() - worker.getMemoryUsedBytes();
            if (availableMemory < job.getRequiredMemoryBytes()) {
                return false;
            }
        }

        return true;
    }

    private void recordDecision(String jobId, String workerId, String reason, int candidates) {
        SchedulingDecisionEntity entity = SchedulingDecisionEntity.builder()
                .decisionId(UUID.randomUUID().toString())
                .jobId(jobId)
                .selectedWorkerId(workerId)
                .decisionReason(reason)
                .candidateWorkersCount(candidates)
                .timestamp(Instant.now())
                .build();
        schedulingDecisionRepository.save(entity);
    }
}
