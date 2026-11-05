package com.gogreen.controlplane;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gogreen.controlplane.api.rest.dto.JobCancelRequest;
import com.gogreen.controlplane.api.rest.dto.JobSubmissionRequest;
import com.gogreen.controlplane.infrastructure.persistence.entity.JobEntity;
import com.gogreen.controlplane.infrastructure.persistence.entity.WorkerEntity;
import com.gogreen.controlplane.infrastructure.persistence.repository.JobRepository;
import com.gogreen.controlplane.infrastructure.persistence.repository.WorkerRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
class ControlPlaneIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private WorkerRepository workerRepository;

    @Autowired
    private JobRepository jobRepository;

    @Test
    @DisplayName("REST API: GET /api/v1/mesh/status returns mesh health and operational telemetry")
    void shouldReturnMeshStatus() throws Exception {
        mockMvc.perform(get("/api/v1/mesh/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("healthy"))
                .andExpect(jsonPath("$.coordinator_version").exists())
                .andExpect(jsonPath("$.active_workers").isNumber())
                .andExpect(jsonPath("$.total_jobs").isNumber());
    }

    @Test
    @DisplayName("REST API: Register worker and verify discovery via GET /api/v1/mesh/workers")
    void shouldDiscoverRegisteredWorker() throws Exception {
        WorkerEntity worker = WorkerEntity.builder()
                .workerId("worker-integration-1")
                .hostname("edge-node-01")
                .status("IDLE")
                .architecture("x86_64")
                .supportedInstructionSets("SSE4.2,AVX,AVX2,FMA")
                .logicalCores(16)
                .physicalCores(8)
                .memoryTotalBytes(34359738368L)
                .memoryUsedBytes(4294967296L)
                .cpuUsagePercent(12.5)
                .activeJobsCount(0)
                .lastHeartbeatAt(Instant.now())
                .registeredAt(Instant.now())
                .build();
        workerRepository.save(worker);

        mockMvc.perform(get("/api/v1/mesh/workers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.workerId == 'worker-integration-1')].hostname").value("edge-node-01"));

        mockMvc.perform(get("/api/v1/mesh/workers/worker-integration-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.workerId").value("worker-integration-1"))
                .andExpect(jsonPath("$.architecture").value("x86_64"));
    }

    @Test
    @DisplayName("REST API & Persistence: Submit job, verify in database, and cancel job")
    void shouldSubmitAndCancelJobDurablePersistence() throws Exception {
        JobSubmissionRequest request = new JobSubmissionRequest();
        request.setWorkloadType("CPU_INFORMATION");
        request.setRequiredArchitecture("x86_64");
        request.setPriority(85);
        request.setTimeoutSeconds(180);
        request.setIdempotencyKey("idem-test-999");

        String responseBody = mockMvc.perform(post("/api/v1/mesh/jobs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.jobId").exists())
                .andExpect(jsonPath("$.workloadType").value("CPU_INFORMATION"))
                .andExpect(jsonPath("$.priority").value(85))
                .andReturn().getResponse().getContentAsString();

        JobEntity createdJob = objectMapper.readValue(responseBody, JobEntity.class);
        String jobId = createdJob.getJobId();

        // Durable persistence check in H2 DB
        Optional<JobEntity> persisted = jobRepository.findById(jobId);
        assertThat(persisted).isPresent();
        assertThat(persisted.get().getIdempotencyKey()).isEqualTo("idem-test-999");

        // Verify retrieval via GET /api/v1/mesh/jobs/{jobId}
        mockMvc.perform(get("/api/v1/mesh/jobs/" + jobId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jobId").value(jobId));

        // Cancel job via POST /api/v1/mesh/jobs/{jobId}/cancel
        JobCancelRequest cancelReq = new JobCancelRequest("Integration test cancellation");
        mockMvc.perform(post("/api/v1/mesh/jobs/" + jobId + "/cancel")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(cancelReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));

        // Verify persistence update in DB
        Optional<JobEntity> cancelledJob = jobRepository.findById(jobId);
        assertThat(cancelledJob).isPresent();
        assertThat(cancelledJob.get().getStatus()).isEqualTo("CANCELLED");
    }
}
