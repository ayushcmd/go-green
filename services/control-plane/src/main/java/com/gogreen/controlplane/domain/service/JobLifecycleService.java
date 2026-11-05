package com.gogreen.controlplane.domain.service;

import com.gogreen.controlplane.domain.scheduler.SchedulerEngine;
import com.gogreen.controlplane.infrastructure.events.service.MeshEventPublisher;
import com.gogreen.controlplane.infrastructure.persistence.entity.JobEntity;
import com.gogreen.controlplane.infrastructure.persistence.entity.JobExecutionAttemptEntity;
import com.gogreen.controlplane.infrastructure.persistence.entity.WorkerEntity;
import com.gogreen.controlplane.infrastructure.persistence.repository.JobExecutionAttemptRepository;
import com.gogreen.controlplane.infrastructure.persistence.repository.JobRepository;
import com.gogreen.controlplane.infrastructure.persistence.repository.WorkerRepository;
import com.gogreen.controlplane.transport.grpc.MeshCoordinatorGrpcService;
import com.gogreen.mesh.v1.ExecutionStatus;
import com.gogreen.mesh.v1.JobAssignment;
import com.gogreen.mesh.v1.JobResult;
import com.gogreen.mesh.v1.WorkloadType;
import com.google.protobuf.ByteString;
import com.google.protobuf.Timestamp;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
public class JobLifecycleService {
    private static final Logger log = LoggerFactory.getLogger(JobLifecycleService.class);

    private final JobRepository jobRepository;
    private final JobExecutionAttemptRepository attemptRepository;
    private final WorkerRepository workerRepository;
    private final SchedulerEngine schedulerEngine;
    private final MeshEventPublisher eventPublisher;
    private final MeshCoordinatorGrpcService grpcService;

    public JobLifecycleService(
            JobRepository jobRepository,
            JobExecutionAttemptRepository attemptRepository,
            WorkerRepository workerRepository,
            SchedulerEngine schedulerEngine,
            MeshEventPublisher eventPublisher,
            @Lazy MeshCoordinatorGrpcService grpcService) {
        this.jobRepository = jobRepository;
        this.attemptRepository = attemptRepository;
        this.workerRepository = workerRepository;
        this.schedulerEngine = schedulerEngine;
        this.eventPublisher = eventPublisher;
        this.grpcService = grpcService;
    }

    @Transactional
    public JobEntity submitJob(
            String workloadType,
            byte[] payload,
            String requiredArch,
            String requiredISAs,
            long requiredMemoryBytes,
            int priority,
            int timeoutSeconds,
            String idempotencyKey,
            int maxRetries) {

        // 1. Idempotency Check: if key provided, verify existing
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            Optional<JobEntity> existing = jobRepository.findByIdempotencyKey(idempotencyKey);
            if (existing.isPresent()) {
                log.info("Idempotent submission detected for key {}. Returning existing Job {}",
                        idempotencyKey, existing.get().getJobId());
                return existing.get();
            }
        }

        String jobId = "job-" + UUID.randomUUID().toString().substring(0, 8);
        Instant now = Instant.now();
        Instant deadline = timeoutSeconds > 0 ? now.plusSeconds(timeoutSeconds) : now.plusSeconds(120);

        JobEntity job = JobEntity.builder()
                .jobId(jobId)
                .workloadType(workloadType)
                .status("QUEUED")
                .requiredArchitecture(requiredArch)
                .requiredInstructionSets(requiredISAs)
                .requiredMemoryBytes(requiredMemoryBytes)
                .priority(priority)
                .timeoutSeconds(timeoutSeconds > 0 ? timeoutSeconds : 120)
                .idempotencyKey(idempotencyKey)
                .retryCount(0)
                .maxRetries(maxRetries > 0 ? maxRetries : 3)
                .payload(payload != null ? payload : new byte[0])
                .createdAt(now)
                .deadlineAt(deadline)
                .build();

        jobRepository.save(job);
        eventPublisher.publishJobSubmitted(jobId, workloadType, priority);
        log.info("Job {} submitted and queued (Workload={}, Priority={}, RequiredISAs={})",
                jobId, workloadType, priority, requiredISAs);

        // Attempt immediate dispatch
        attemptDispatch(job);
        return job;
    }

    @Transactional
    public boolean attemptDispatch(JobEntity job) {
        if (!"QUEUED".equals(job.getStatus()) && !"RETRYING".equals(job.getStatus())) {
            return false;
        }

        SchedulerEngine.SchedulingResult result = schedulerEngine.scheduleJob(job);
        if (!result.successful() || result.selectedWorker() == null) {
            return false;
        }

        WorkerEntity worker = result.selectedWorker();
        String workerId = worker.getWorkerId();

        // Check if gRPC stream is actually alive
        if (!grpcService.isWorkerConnected(workerId)) {
            log.warn("Worker {} selected by scheduler but stream is not active. Skipping dispatch.", workerId);
            return false;
        }

        // Build Protobuf JobAssignment
        WorkloadType protoType;
        try {
            protoType = WorkloadType.valueOf("WORKLOAD_TYPE_" + job.getWorkloadType());
        } catch (IllegalArgumentException e) {
            protoType = WorkloadType.WORKLOAD_TYPE_UNSPECIFIED;
        }

        JobAssignment.Builder assignmentBuilder = JobAssignment.newBuilder()
                .setJobId(job.getJobId())
                .setWorkloadType(protoType)
                .setValidatedPayload(ByteString.copyFrom(job.getPayload() != null ? job.getPayload() : new byte[0]));

        if (job.getDeadlineAt() != null) {
            assignmentBuilder.setExecutionDeadline(Timestamp.newBuilder()
                    .setSeconds(job.getDeadlineAt().getEpochSecond())
                    .setNanos(job.getDeadlineAt().getNano())
                    .build());
        }

        boolean sent = grpcService.dispatchJob(workerId, assignmentBuilder.build());
        if (!sent) {
            log.warn("Failed to send JobAssignment over gRPC stream to worker {}", workerId);
            return false;
        }

        // Update Job state
        job.setStatus("ASSIGNED");
        job.setAssignedWorkerId(workerId);
        job.setAssignedAt(Instant.now());
        jobRepository.save(job);

        // Update Worker state
        worker.setActiveJobsCount(worker.getActiveJobsCount() + 1);
        if (worker.getActiveJobsCount() > 0 && "IDLE".equals(worker.getStatus())) {
            worker.setStatus("BUSY");
        }
        workerRepository.save(worker);

        // Record execution attempt
        JobExecutionAttemptEntity attempt = JobExecutionAttemptEntity.builder()
                .attemptId(UUID.randomUUID().toString())
                .jobId(job.getJobId())
                .workerId(workerId)
                .attemptNumber(job.getRetryCount() + 1)
                .status("ASSIGNED")
                .startedAt(Instant.now())
                .build();
        attemptRepository.save(attempt);

        eventPublisher.publishJobAssigned(job.getJobId(), workerId);
        log.info("Job {} successfully assigned and dispatched to Worker {}", job.getJobId(), workerId);
        return true;
    }

    @Transactional
    public void handleJobAck(String jobId, String workerId, boolean accepted, String reason) {
        jobRepository.findById(jobId).ifPresent(job -> {
            if (accepted) {
                if ("ASSIGNED".equals(job.getStatus())) {
                    job.setStatus("RUNNING");
                    job.setStartedAt(Instant.now());
                    jobRepository.save(job);
                    eventPublisher.publishJobStarted(jobId, workerId);
                    log.info("Job {} acknowledged and RUNNING on Worker {}", jobId, workerId);
                }
            } else {
                log.warn("Job {} REJECTED by Worker {}: {}", jobId, workerId, reason);
                reconcileFailedJob(job, workerId, "Worker rejected assignment: " + reason);
            }
        });
    }

    @Transactional
    public void handleJobResult(JobResult result) {
        String jobId = result.getJobId();
        String workerId = result.getWorkerId();

        jobRepository.findById(jobId).ifPresent(job -> {
            // Idempotency: if already completed, ignore
            if ("COMPLETED".equals(job.getStatus())) {
                log.info("Job {} already COMPLETED. Ignoring duplicate result from Worker {}", jobId, workerId);
                return;
            }

            job.setResultPayload(result.getResultPayload().toByteArray());
            job.setExecutionDurationMs(result.getExecutionDurationMs());
            job.setCompletedAt(Instant.now());

            boolean success = (result.getExecutionStatus() == ExecutionStatus.EXECUTION_STATUS_COMPLETED);
            if (success) {
                job.setStatus("COMPLETED");
                job.setErrorDetails(null);
                jobRepository.save(job);
                eventPublisher.publishJobCompleted(jobId, workerId, result.getExecutionDurationMs());
                log.info("Job {} COMPLETED successfully by Worker {} in {:.2f}ms",
                        jobId, workerId, result.getExecutionDurationMs());
            } else {
                reconcileFailedJob(job, workerId, result.getErrorDetails());
            }

            // Decrement worker active jobs
            workerRepository.findById(workerId).ifPresent(worker -> {
                int active = Math.max(0, worker.getActiveJobsCount() - 1);
                worker.setActiveJobsCount(active);
                if (active == 0 && "BUSY".equals(worker.getStatus())) {
                    worker.setStatus("IDLE");
                }
                workerRepository.save(worker);
            });
        });
    }

    @Transactional
    public void reconcileFailedJob(JobEntity job, String workerId, String errorDetails) {
        job.setErrorDetails(errorDetails);

        if (job.getRetryCount() < job.getMaxRetries()) {
            job.setRetryCount(job.getRetryCount() + 1);
            job.setStatus("RETRYING");
            job.setAssignedWorkerId(null);
            jobRepository.save(job);
            log.warn("Job {} failed (Attempt {}/{}). Scheduled for retry: {}",
                    job.getJobId(), job.getRetryCount(), job.getMaxRetries(), errorDetails);
        } else {
            job.setStatus("FAILED");
            jobRepository.save(job);
            eventPublisher.publishJobFailed(job.getJobId(), workerId, errorDetails);
            log.error("Job {} FAILED permanently after {} retries: {}",
                    job.getJobId(), job.getMaxRetries(), errorDetails);
        }
    }

    @Transactional
    public void reconcileWorkerDisconnection(String workerId, String reason) {
        log.warn("Initiating job reconciliation for disconnected Worker {}: {}", workerId, reason);

        List<JobEntity> orphanedJobs = jobRepository.findByAssignedWorkerIdAndStatusIn(
                workerId, List.of("ASSIGNED", "RUNNING"));

        for (JobEntity job : orphanedJobs) {
            log.warn("Reconciling orphaned Job {} on disconnected Worker {}", job.getJobId(), workerId);
            reconcileFailedJob(job, workerId, "Worker disconnected: " + reason);
        }
    }

    @Transactional
    public boolean cancelJob(String jobId, String reason) {
        Optional<JobEntity> opt = jobRepository.findById(jobId);
        if (opt.isEmpty()) {
            return false;
        }

        JobEntity job = opt.get();
        if ("COMPLETED".equals(job.getStatus()) || "FAILED".equals(job.getStatus()) || "CANCELLED".equals(job.getStatus())) {
            return false;
        }

        if (job.getAssignedWorkerId() != null) {
            grpcService.dispatchCancellation(job.getAssignedWorkerId(), jobId, reason);
            workerRepository.findById(job.getAssignedWorkerId()).ifPresent(w -> {
                w.setActiveJobsCount(Math.max(0, w.getActiveJobsCount() - 1));
                workerRepository.save(w);
            });
        }

        job.setStatus("CANCELLED");
        job.setErrorDetails("Cancelled: " + reason);
        job.setCompletedAt(Instant.now());
        jobRepository.save(job);

        eventPublisher.publishJobCancelled(jobId, reason);
        log.info("Job {} CANCELLED: {}", jobId, reason);
        return true;
    }

    @Scheduled(fixedRate = 1000)
    public void processQueueAndSweepDeadlines() {
        // 1. Sweep timed-out jobs
        List<JobEntity> activeJobs = jobRepository.findByStatusInOrderByPriorityDescCreatedAtAsc(
                List.of("ASSIGNED", "RUNNING"));

        for (JobEntity job : activeJobs) {
            if (job.isExpired()) {
                log.warn("Job {} exceeded execution deadline ({}). Marking TIMED_OUT.",
                        job.getJobId(), job.getDeadlineAt());
                job.setStatus("TIMED_OUT");
                job.setErrorDetails("Execution deadline exceeded");
                job.setCompletedAt(Instant.now());
                jobRepository.save(job);
                eventPublisher.publishJobFailed(job.getJobId(), job.getAssignedWorkerId(), "Execution deadline exceeded");
            }
        }

        // 2. Schedule pending/queued/retrying jobs
        List<JobEntity> queuedJobs = jobRepository.findByStatusInOrderByPriorityDescCreatedAtAsc(
                List.of("QUEUED", "RETRYING"));

        for (JobEntity job : queuedJobs) {
            attemptDispatch(job);
        }
    }

    public List<JobEntity> getAllJobs() {
        return jobRepository.findAll();
    }

    public Optional<JobEntity> getJob(String jobId) {
        return jobRepository.findById(jobId);
    }
}
