package com.gogreen.controlplane.domain.scheduler;

import com.gogreen.controlplane.infrastructure.persistence.entity.JobEntity;
import com.gogreen.controlplane.infrastructure.persistence.entity.SchedulingDecisionEntity;
import com.gogreen.controlplane.infrastructure.persistence.entity.WorkerEntity;
import com.gogreen.controlplane.infrastructure.persistence.repository.SchedulingDecisionRepository;
import com.gogreen.controlplane.infrastructure.persistence.repository.WorkerRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SchedulerEngineTest {

    @Mock
    private WorkerRepository workerRepository;

    @Mock
    private SchedulingDecisionRepository decisionRepository;

    private SchedulerEngine scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new SchedulerEngine(workerRepository, decisionRepository, 10);
    }

    private WorkerEntity createWorker(String id, String arch, String isas, int activeJobs, double cpu, long totalMem, long usedMem) {
        return WorkerEntity.builder()
                .workerId(id)
                .hostname("host-" + id)
                .status("IDLE")
                .architecture(arch)
                .supportedInstructionSets(isas)
                .activeJobsCount(activeJobs)
                .cpuUsagePercent(cpu)
                .memoryTotalBytes(totalMem)
                .memoryUsedBytes(usedMem)
                .lastHeartbeatAt(Instant.now())
                .build();
    }

    @Test
    @DisplayName("STRICT RULE: Reject AVX2 workload when worker lacks AVX2 support")
    void shouldRejectAVX2WorkloadWhenWorkerLacksAVX2() {
        // Worker only supports SSE4.2
        WorkerEntity worker = createWorker("worker-sse", "x86_64", "SSE4.1,SSE4.2", 0, 10.0, 16_000_000_000L, 2_000_000_000L);
        when(workerRepository.findAll()).thenReturn(List.of(worker));

        JobEntity avx2Job = JobEntity.builder()
                .jobId("job-avx2")
                .workloadType("NATIVE_BENCHMARK_SUITE")
                .requiredArchitecture("x86_64")
                .requiredInstructionSets("AVX2")
                .status("QUEUED")
                .build();

        SchedulerEngine.SchedulingResult result = scheduler.scheduleJob(avx2Job);

        assertThat(result.successful()).isFalse();
        assertThat(result.selectedWorker()).isNull();
        assertThat(result.candidateCount()).isEqualTo(0);
        assertThat(result.reason()).contains("No eligible worker found");

        verify(decisionRepository).save(any(SchedulingDecisionEntity.class));
    }

    @Test
    @DisplayName("Accept AVX2 workload when worker supports verified AVX2")
    void shouldAcceptAVX2WorkloadWhenWorkerHasAVX2() {
        WorkerEntity workerNoAvx = createWorker("w-no-avx", "x86_64", "SSE4.2", 0, 5.0, 16_000_000_000L, 2_000_000_000L);
        WorkerEntity workerWithAvx = createWorker("w-avx2", "x86_64", "SSE4.2,AVX,AVX2,FMA", 0, 15.0, 16_000_000_000L, 2_000_000_000L);
        when(workerRepository.findAll()).thenReturn(List.of(workerNoAvx, workerWithAvx));

        JobEntity avx2Job = JobEntity.builder()
                .jobId("job-avx2-pass")
                .workloadType("NATIVE_BENCHMARK_SUITE")
                .requiredArchitecture("x86_64")
                .requiredInstructionSets("AVX2")
                .status("QUEUED")
                .build();

        SchedulerEngine.SchedulingResult result = scheduler.scheduleJob(avx2Job);

        assertThat(result.successful()).isTrue();
        assertThat(result.selectedWorker()).isNotNull();
        assertThat(result.selectedWorker().getWorkerId()).isEqualTo("w-avx2");
        assertThat(result.candidateCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("Reject worker with incompatible architecture")
    void shouldRejectIncompatibleArchitecture() {
        WorkerEntity armWorker = createWorker("w-arm", "aarch64", "NEON", 0, 10.0, 16_000_000_000L, 2_000_000_000L);
        when(workerRepository.findAll()).thenReturn(List.of(armWorker));

        JobEntity x86Job = JobEntity.builder()
                .jobId("job-x86")
                .workloadType("CPU_INFORMATION")
                .requiredArchitecture("x86_64")
                .status("QUEUED")
                .build();

        SchedulerEngine.SchedulingResult result = scheduler.scheduleJob(x86Job);

        assertThat(result.successful()).isFalse();
        assertThat(result.selectedWorker()).isNull();
    }

    @Test
    @DisplayName("Load balancing: Prioritize worker with fewer active jobs")
    void shouldPrioritizeWorkerWithFewerActiveJobs() {
        WorkerEntity busyWorker = createWorker("w-busy", "x86_64", "AVX2", 2, 20.0, 16_000_000_000L, 2_000_000_000L);
        WorkerEntity freeWorker = createWorker("w-free", "x86_64", "AVX2", 0, 30.0, 16_000_000_000L, 2_000_000_000L);
        when(workerRepository.findAll()).thenReturn(List.of(busyWorker, freeWorker));

        JobEntity job = JobEntity.builder()
                .jobId("job-balance")
                .workloadType("SYSTEM_TELEMETRY")
                .status("QUEUED")
                .build();

        SchedulerEngine.SchedulingResult result = scheduler.scheduleJob(job);

        assertThat(result.successful()).isTrue();
        assertThat(result.selectedWorker().getWorkerId()).isEqualTo("w-free");
        assertThat(result.candidateCount()).isEqualTo(2);
    }

    @Test
    @DisplayName("Load balancing: Prioritize lower CPU usage when active jobs are equal")
    void shouldPrioritizeLowerCpuWhenActiveJobsEqual() {
        WorkerEntity highCpuWorker = createWorker("w-high-cpu", "x86_64", "AVX2", 1, 75.0, 16_000_000_000L, 2_000_000_000L);
        WorkerEntity lowCpuWorker = createWorker("w-low-cpu", "x86_64", "AVX2", 1, 15.0, 16_000_000_000L, 2_000_000_000L);
        when(workerRepository.findAll()).thenReturn(List.of(highCpuWorker, lowCpuWorker));

        JobEntity job = JobEntity.builder()
                .jobId("job-cpu-balance")
                .workloadType("CPU_INFORMATION")
                .status("QUEUED")
                .build();

        SchedulerEngine.SchedulingResult result = scheduler.scheduleJob(job);

        assertThat(result.successful()).isTrue();
        assertThat(result.selectedWorker().getWorkerId()).isEqualTo("w-low-cpu");
    }

    @Test
    @DisplayName("Reject worker exceeding active job limit (>= 4 active jobs)")
    void shouldRejectWorkerAtActiveJobLimit() {
        WorkerEntity saturatedWorker = createWorker("w-saturated", "x86_64", "AVX2", 4, 10.0, 16_000_000_000L, 2_000_000_000L);
        when(workerRepository.findAll()).thenReturn(List.of(saturatedWorker));

        JobEntity job = JobEntity.builder()
                .jobId("job-saturated")
                .workloadType("CPU_INFORMATION")
                .status("QUEUED")
                .build();

        SchedulerEngine.SchedulingResult result = scheduler.scheduleJob(job);

        assertThat(result.successful()).isFalse();
    }

    @Test
    @DisplayName("Reject worker with CPU usage >= 95%")
    void shouldRejectWorkerWithExcessiveCpu() {
        WorkerEntity overloadedWorker = createWorker("w-overloaded", "x86_64", "AVX2", 0, 96.5, 16_000_000_000L, 2_000_000_000L);
        when(workerRepository.findAll()).thenReturn(List.of(overloadedWorker));

        JobEntity job = JobEntity.builder()
                .jobId("job-overloaded")
                .workloadType("CPU_INFORMATION")
                .status("QUEUED")
                .build();

        SchedulerEngine.SchedulingResult result = scheduler.scheduleJob(job);

        assertThat(result.successful()).isFalse();
    }

    @Test
    @DisplayName("Reject worker with expired heartbeat or DISCONNECTED status")
    void shouldRejectDisconnectedOrExpiredWorker() {
        WorkerEntity disconnectedWorker = createWorker("w-disc", "x86_64", "AVX2", 0, 10.0, 16_000_000_000L, 2_000_000_000L);
        disconnectedWorker.setStatus("DISCONNECTED");

        WorkerEntity expiredWorker = createWorker("w-exp", "x86_64", "AVX2", 0, 10.0, 16_000_000_000L, 2_000_000_000L);
        expiredWorker.setLastHeartbeatAt(Instant.now().minusSeconds(30)); // 30s > 10s timeout

        when(workerRepository.findAll()).thenReturn(List.of(disconnectedWorker, expiredWorker));

        JobEntity job = JobEntity.builder()
                .jobId("job-dead")
                .workloadType("CPU_INFORMATION")
                .status("QUEUED")
                .build();

        SchedulerEngine.SchedulingResult result = scheduler.scheduleJob(job);

        assertThat(result.successful()).isFalse();
    }

    @Test
    @DisplayName("Reject unauthorized workload types outside strict allowlist")
    void shouldRejectUnauthorizedWorkload() {
        JobEntity unauthJob = JobEntity.builder()
                .jobId("job-arbitrary")
                .workloadType("EXECUTE_ARBITRARY_SHELL_COMMAND")
                .status("QUEUED")
                .build();

        SchedulerEngine.SchedulingResult result = scheduler.scheduleJob(unauthJob);

        assertThat(result.successful()).isFalse();
        assertThat(result.reason()).contains("Unauthorized workload type");
        verifyNoInteractions(workerRepository);
    }
}
