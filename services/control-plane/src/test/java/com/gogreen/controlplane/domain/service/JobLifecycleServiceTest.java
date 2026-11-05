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
import com.gogreen.mesh.v1.JobResult;
import com.google.protobuf.ByteString;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class JobLifecycleServiceTest {

    @Mock
    private JobRepository jobRepository;

    @Mock
    private JobExecutionAttemptRepository attemptRepository;

    @Mock
    private WorkerRepository workerRepository;

    @Mock
    private SchedulerEngine schedulerEngine;

    @Mock
    private MeshEventPublisher eventPublisher;

    @Mock
    private MeshCoordinatorGrpcService grpcService;

    private JobLifecycleService service;

    @BeforeEach
    void setUp() {
        service = new JobLifecycleService(
                jobRepository,
                attemptRepository,
                workerRepository,
                schedulerEngine,
                eventPublisher,
                grpcService
        );
    }

    @Test
    @DisplayName("Idempotency: Return existing job when idempotency key already exists")
    void shouldReturnExistingJobWhenIdempotencyKeyMatches() {
        String key = "idem-key-123";
        JobEntity existing = JobEntity.builder()
                .jobId("job-existing-1")
                .idempotencyKey(key)
                .workloadType("CPU_INFORMATION")
                .status("COMPLETED")
                .build();

        when(jobRepository.findByIdempotencyKey(key)).thenReturn(Optional.of(existing));

        JobEntity result = service.submitJob("CPU_INFORMATION", null, "x86_64", null, 0, 50, 60, key, 3);

        assertThat(result.getJobId()).isEqualTo("job-existing-1");
        verify(jobRepository, never()).save(argThat(j -> !j.getJobId().equals("job-existing-1")));
    }

    @Test
    @DisplayName("Submit and Dispatch: Successfully assign and dispatch to connected worker")
    void shouldSubmitAndDispatchToWorker() {
        WorkerEntity worker = WorkerEntity.builder()
                .workerId("worker-node-1")
                .status("IDLE")
                .activeJobsCount(0)
                .build();

        when(schedulerEngine.scheduleJob(any(JobEntity.class))).thenReturn(
                new SchedulerEngine.SchedulingResult(true, worker, "Matched best candidate", 1)
        );
        when(grpcService.isWorkerConnected("worker-node-1")).thenReturn(true);
        when(grpcService.dispatchJob(eq("worker-node-1"), any())).thenReturn(true);

        JobEntity job = service.submitJob("CPU_INFORMATION", new byte[]{1, 2, 3}, "x86_64", "AVX2", 0, 80, 60, null, 3);

        assertThat(job).isNotNull();
        assertThat(job.getStatus()).isEqualTo("ASSIGNED");
        assertThat(job.getAssignedWorkerId()).isEqualTo("worker-node-1");

        verify(attemptRepository).save(any(JobExecutionAttemptEntity.class));
        verify(eventPublisher).publishJobAssigned(job.getJobId(), "worker-node-1");
        verify(workerRepository).save(argThat(w -> w.getActiveJobsCount() == 1 && "BUSY".equals(w.getStatus())));
    }

    @Test
    @DisplayName("Job Ack: Transition job to RUNNING on worker positive acknowledgment")
    void shouldTransitionToRunningOnPositiveAck() {
        JobEntity job = JobEntity.builder()
                .jobId("job-ack-1")
                .status("ASSIGNED")
                .assignedWorkerId("worker-1")
                .build();

        when(jobRepository.findById("job-ack-1")).thenReturn(Optional.of(job));

        service.handleJobAck("job-ack-1", "worker-1", true, "Accepted");

        assertThat(job.getStatus()).isEqualTo("RUNNING");
        assertThat(job.getStartedAt()).isNotNull();
        verify(jobRepository).save(job);
        verify(eventPublisher).publishJobStarted("job-ack-1", "worker-1");
    }

    @Test
    @DisplayName("Job Result: Transition job to COMPLETED on successful result and decrement worker load")
    void shouldCompleteJobAndDecrementWorkerLoad() {
        JobEntity job = JobEntity.builder()
                .jobId("job-res-1")
                .status("RUNNING")
                .assignedWorkerId("worker-1")
                .build();

        WorkerEntity worker = WorkerEntity.builder()
                .workerId("worker-1")
                .status("BUSY")
                .activeJobsCount(1)
                .build();

        when(jobRepository.findById("job-res-1")).thenReturn(Optional.of(job));
        when(workerRepository.findById("worker-1")).thenReturn(Optional.of(worker));

        JobResult result = JobResult.newBuilder()
                .setJobId("job-res-1")
                .setWorkerId("worker-1")
                .setExecutionStatus(ExecutionStatus.EXECUTION_STATUS_COMPLETED)
                .setResultPayload(ByteString.copyFromUtf8("{\"cpu\":\"GenuineIntel\"}"))
                .setExecutionDurationMs(45.2)
                .build();

        service.handleJobResult(result);

        assertThat(job.getStatus()).isEqualTo("COMPLETED");
        assertThat(job.getExecutionDurationMs()).isEqualTo(45.2);
        assertThat(worker.getActiveJobsCount()).isEqualTo(0);
        assertThat(worker.getStatus()).isEqualTo("IDLE");

        verify(jobRepository).save(job);
        verify(workerRepository).save(worker);
        verify(eventPublisher).publishJobCompleted("job-res-1", "worker-1", 45.2);
    }

    @Test
    @DisplayName("Reconciliation: Worker disconnection requeues assigned or running jobs as RETRYING")
    void shouldReconcileOrphanedJobsOnDisconnection() {
        JobEntity orphanedJob = JobEntity.builder()
                .jobId("job-orphaned-1")
                .status("RUNNING")
                .assignedWorkerId("worker-crashed")
                .retryCount(0)
                .maxRetries(3)
                .build();

        when(jobRepository.findByAssignedWorkerIdAndStatusIn(eq("worker-crashed"), anyList()))
                .thenReturn(List.of(orphanedJob));

        service.reconcileWorkerDisconnection("worker-crashed", "gRPC stream broken");

        assertThat(orphanedJob.getStatus()).isEqualTo("RETRYING");
        assertThat(orphanedJob.getRetryCount()).isEqualTo(1);
        assertThat(orphanedJob.getAssignedWorkerId()).isNull();
        assertThat(orphanedJob.getErrorDetails()).contains("Worker disconnected");

        verify(jobRepository).save(orphanedJob);
    }

    @Test
    @DisplayName("Reconciliation: Exceeding max retries transitions job permanently to FAILED")
    void shouldFailPermanentlyWhenRetriesExceeded() {
        JobEntity maxedOutJob = JobEntity.builder()
                .jobId("job-maxed")
                .status("RUNNING")
                .assignedWorkerId("worker-crashed")
                .retryCount(3)
                .maxRetries(3)
                .build();

        when(jobRepository.findByAssignedWorkerIdAndStatusIn(eq("worker-crashed"), anyList()))
                .thenReturn(List.of(maxedOutJob));

        service.reconcileWorkerDisconnection("worker-crashed", "Worker terminated unexpectedly");

        assertThat(maxedOutJob.getStatus()).isEqualTo("FAILED");
        verify(jobRepository).save(maxedOutJob);
        verify(eventPublisher).publishJobFailed(eq("job-maxed"), eq("worker-crashed"), anyString());
    }

    @Test
    @DisplayName("Cancellation: Cancel active job and notify worker via gRPC")
    void shouldCancelActiveJob() {
        JobEntity activeJob = JobEntity.builder()
                .jobId("job-to-cancel")
                .status("RUNNING")
                .assignedWorkerId("worker-1")
                .build();

        WorkerEntity worker = WorkerEntity.builder()
                .workerId("worker-1")
                .activeJobsCount(1)
                .build();

        when(jobRepository.findById("job-to-cancel")).thenReturn(Optional.of(activeJob));
        when(workerRepository.findById("worker-1")).thenReturn(Optional.of(worker));

        boolean cancelled = service.cancelJob("job-to-cancel", "Manual abort");

        assertThat(cancelled).isTrue();
        assertThat(activeJob.getStatus()).isEqualTo("CANCELLED");
        assertThat(worker.getActiveJobsCount()).isEqualTo(0);

        verify(grpcService).dispatchCancellation("worker-1", "job-to-cancel", "Manual abort");
        verify(jobRepository).save(activeJob);
        verify(eventPublisher).publishJobCancelled("job-to-cancel", "Manual abort");
    }
}
