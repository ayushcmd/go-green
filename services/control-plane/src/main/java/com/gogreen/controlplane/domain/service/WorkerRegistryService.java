package com.gogreen.controlplane.domain.service;

import com.gogreen.controlplane.domain.model.WorkerNode;
import com.gogreen.controlplane.domain.repository.WorkerRegistry;
import com.gogreen.mesh.v1.WorkerHeartbeat;
import com.gogreen.mesh.v1.WorkerRegistration;
import com.gogreen.mesh.v1.WorkerShutdownNotification;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Collection;
import java.util.Optional;

@Service
public class WorkerRegistryService {
    private static final Logger log = LoggerFactory.getLogger(WorkerRegistryService.class);

    private final WorkerRegistry workerRegistry;
    private final String defaultPartition;
    private final long heartbeatTimeoutSeconds;

    public WorkerRegistryService(
            WorkerRegistry workerRegistry,
            @Value("${mesh.coordinator.partition.default-name:partition-primary}") String defaultPartition,
            @Value("${mesh.coordinator.grpc.heartbeat-timeout-seconds:10}") long heartbeatTimeoutSeconds) {
        this.workerRegistry = workerRegistry;
        this.defaultPartition = defaultPartition;
        this.heartbeatTimeoutSeconds = heartbeatTimeoutSeconds;
    }

    public WorkerNode registerWorker(WorkerRegistration reg) {
        log.info("Processing worker registration: ID={}, Hostname={}, Arch={}, Cores={}/{}",
                reg.getWorkerId(), reg.getHostname(), reg.getArchitecture(),
                reg.getPhysicalCores(), reg.getLogicalCores());

        WorkerNode node = WorkerNode.builder()
                .workerId(reg.getWorkerId())
                .hostname(reg.getHostname())
                .operatingSystem(reg.getOperatingSystem())
                .architecture(reg.getArchitecture())
                .cpuVendor(reg.getCpuVendor())
                .cpuModel(reg.getCpuModel())
                .physicalCores(reg.getPhysicalCores())
                .logicalCores(reg.getLogicalCores())
                .supportedInstructionSets(reg.getSupportedInstructionSetsList())
                .memoryTotalBytes(reg.getMemoryTotalBytes())
                .nativeEngineVersion(reg.getNativeEngineVersion())
                .workerVersion(reg.getWorkerVersion())
                .protocolVersion(reg.getProtocolVersion())
                .labels(reg.getLabelsMap())
                .assignedPartition(defaultPartition)
                .status("IDLE")
                .registeredAt(Instant.now())
                .lastHeartbeatAt(Instant.now())
                .build();

        workerRegistry.save(node);
        return node;
    }

    public void recordHeartbeat(WorkerHeartbeat hb) {
        Optional<WorkerNode> opt = workerRegistry.findById(hb.getWorkerId());
        if (opt.isPresent()) {
            WorkerNode node = opt.get();
            node.setLastHeartbeatAt(Instant.now());
            node.setLastHeartbeatSequence(hb.getSequenceNumber());
            node.setCpuUsagePercent(hb.getCpuUsagePercent());
            node.setMemoryUsedBytes(hb.getMemoryUsedBytes());
            node.setActiveJobsCount(hb.getActiveJobs());
            node.setNativeDaemonStatus(hb.getNativeDaemonStatus());
            node.setUptimeSeconds(hb.getUptimeSeconds());
            node.setStatus(hb.getWorkerStatus().name().replace("WORKER_STATUS_", ""));
        } else {
            log.warn("Received heartbeat from unregistered worker: {}", hb.getWorkerId());
        }
    }

    public void processShutdown(WorkerShutdownNotification notification) {
        log.info("Worker shutdown notification: WorkerID={}, Reason={}",
                notification.getWorkerId(), notification.getReason());
        workerRegistry.findById(notification.getWorkerId()).ifPresent(node -> {
            node.setStatus("DISCONNECTED");
        });
    }

    @Scheduled(fixedRate = 5000)
    public void sweepExpiredWorkers() {
        for (WorkerNode worker : workerRegistry.findAll()) {
            if (!"DISCONNECTED".equals(worker.getStatus()) && worker.isExpired(heartbeatTimeoutSeconds)) {
                log.warn("Worker heartbeat timed out. Marking DISCONNECTED: ID={}, LastHeartbeat={}",
                        worker.getWorkerId(), worker.getLastHeartbeatAt());
                worker.setStatus("DISCONNECTED");
            }
        }
    }

    public Collection<WorkerNode> getAllWorkers() {
        return workerRegistry.findAll();
    }

    public Optional<WorkerNode> getWorker(String workerId) {
        return workerRegistry.findById(workerId);
    }
}
