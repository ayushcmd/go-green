package com.gogreen.controlplane.domain.service;

import com.gogreen.controlplane.infrastructure.events.service.MeshEventPublisher;
import com.gogreen.controlplane.infrastructure.persistence.entity.WorkerEntity;
import com.gogreen.controlplane.infrastructure.persistence.entity.WorkerSessionEntity;
import com.gogreen.controlplane.infrastructure.persistence.entity.WorkerStateTransitionEntity;
import com.gogreen.controlplane.infrastructure.persistence.repository.WorkerRepository;
import com.gogreen.controlplane.infrastructure.persistence.repository.WorkerSessionRepository;
import com.gogreen.controlplane.infrastructure.persistence.repository.WorkerStateTransitionRepository;
import com.gogreen.mesh.v1.WorkerHeartbeat;
import com.gogreen.mesh.v1.WorkerRegistration;
import com.gogreen.mesh.v1.WorkerShutdownNotification;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collection;
import java.util.Optional;
import java.util.UUID;

@Service
public class WorkerRegistryService {
    private static final Logger log = LoggerFactory.getLogger(WorkerRegistryService.class);

    private final WorkerRepository workerRepository;
    private final WorkerSessionRepository sessionRepository;
    private final WorkerStateTransitionRepository transitionRepository;
    private final MeshEventPublisher eventPublisher;
    private final JobLifecycleService jobLifecycleService;

    private final String defaultPartition;
    private final long heartbeatTimeoutSeconds;

    public WorkerRegistryService(
            WorkerRepository workerRepository,
            WorkerSessionRepository sessionRepository,
            WorkerStateTransitionRepository transitionRepository,
            MeshEventPublisher eventPublisher,
            @Lazy JobLifecycleService jobLifecycleService,
            @Value("${mesh.coordinator.partition.default-name:partition-primary}") String defaultPartition,
            @Value("${mesh.coordinator.grpc.heartbeat-timeout-seconds:10}") long heartbeatTimeoutSeconds) {
        this.workerRepository = workerRepository;
        this.sessionRepository = sessionRepository;
        this.transitionRepository = transitionRepository;
        this.eventPublisher = eventPublisher;
        this.jobLifecycleService = jobLifecycleService;
        this.defaultPartition = defaultPartition;
        this.heartbeatTimeoutSeconds = heartbeatTimeoutSeconds;
    }

    @Transactional
    public WorkerEntity registerWorker(WorkerRegistration reg) {
        log.info("Processing worker registration: ID={}, Hostname={}, Arch={}, Cores={}/{}, ISAs={}",
                reg.getWorkerId(), reg.getHostname(), reg.getArchitecture(),
                reg.getPhysicalCores(), reg.getLogicalCores(), reg.getSupportedInstructionSetsList());

        String isaJoined = String.join(",", reg.getSupportedInstructionSetsList());

        Optional<WorkerEntity> existingOpt = workerRepository.findById(reg.getWorkerId());
        WorkerEntity worker;
        String previousStatus = "NEW";

        if (existingOpt.isPresent()) {
            worker = existingOpt.get();
            previousStatus = worker.getStatus();
            worker.setHostname(reg.getHostname());
            worker.setOperatingSystem(reg.getOperatingSystem());
            worker.setArchitecture(reg.getArchitecture());
            worker.setCpuVendor(reg.getCpuVendor());
            worker.setCpuModel(reg.getCpuModel());
            worker.setPhysicalCores(reg.getPhysicalCores());
            worker.setLogicalCores(reg.getLogicalCores());
            worker.setSupportedInstructionSets(isaJoined);
            worker.setMemoryTotalBytes(reg.getMemoryTotalBytes());
            worker.setNativeEngineVersion(reg.getNativeEngineVersion());
            worker.setWorkerVersion(reg.getWorkerVersion());
            worker.setProtocolVersion(reg.getProtocolVersion());
            worker.setStatus("IDLE");
            worker.setLastHeartbeatAt(Instant.now());
        } else {
            worker = WorkerEntity.builder()
                    .workerId(reg.getWorkerId())
                    .hostname(reg.getHostname())
                    .operatingSystem(reg.getOperatingSystem())
                    .architecture(reg.getArchitecture())
                    .cpuVendor(reg.getCpuVendor())
                    .cpuModel(reg.getCpuModel())
                    .physicalCores(reg.getPhysicalCores())
                    .logicalCores(reg.getLogicalCores())
                    .supportedInstructionSets(isaJoined)
                    .memoryTotalBytes(reg.getMemoryTotalBytes())
                    .nativeEngineVersion(reg.getNativeEngineVersion())
                    .workerVersion(reg.getWorkerVersion())
                    .protocolVersion(reg.getProtocolVersion())
                    .assignedPartition(defaultPartition)
                    .status("IDLE")
                    .registeredAt(Instant.now())
                    .lastHeartbeatAt(Instant.now())
                    .build();
        }

        workerRepository.save(worker);

        // Record transition
        recordTransition(worker.getWorkerId(), previousStatus, "IDLE", "Worker registered");

        // Start new session
        WorkerSessionEntity session = WorkerSessionEntity.builder()
                .sessionId(UUID.randomUUID().toString())
                .workerId(worker.getWorkerId())
                .connectedAt(Instant.now())
                .build();
        sessionRepository.save(session);

        // Publish event
        eventPublisher.publishWorkerRegistered(worker.getWorkerId(), worker.getHostname(),
                worker.getArchitecture(), worker.getSupportedInstructionSets());

        return worker;
    }

    @Transactional
    public void recordHeartbeat(WorkerHeartbeat hb) {
        workerRepository.findById(hb.getWorkerId()).ifPresentOrElse(worker -> {
            String fromStatus = worker.getStatus();
            worker.setLastHeartbeatAt(Instant.now());
            worker.setLastHeartbeatSequence(hb.getSequenceNumber());
            worker.setCpuUsagePercent(hb.getCpuUsagePercent());
            worker.setMemoryUsedBytes(hb.getMemoryUsedBytes());
            worker.setActiveJobsCount(hb.getActiveJobs());
            worker.setNativeDaemonStatus(hb.getNativeDaemonStatus());
            worker.setUptimeSeconds(hb.getUptimeSeconds());

            String reportedStatus = hb.getWorkerStatus().name().replace("WORKER_STATUS_", "");
            if (!reportedStatus.equalsIgnoreCase(worker.getStatus()) && !"DISCONNECTED".equalsIgnoreCase(worker.getStatus())) {
                worker.setStatus(reportedStatus);
                recordTransition(worker.getWorkerId(), fromStatus, reportedStatus, "Heartbeat status sync");
            }

            workerRepository.save(worker);

            // Update session stats
            sessionRepository.findFirstByWorkerIdAndDisconnectedAtIsNullOrderByConnectedAtDesc(worker.getWorkerId())
                    .ifPresent(s -> {
                        s.setHeartbeatsReceived(s.getHeartbeatsReceived() + 1);
                        sessionRepository.save(s);
                    });

            eventPublisher.publishWorkerHeartbeat(worker.getWorkerId(), hb.getSequenceNumber(),
                    hb.getCpuUsagePercent(), hb.getMemoryUsedBytes());
        }, () -> log.warn("Received heartbeat from unregistered worker: {}", hb.getWorkerId()));
    }

    @Transactional
    public void processShutdown(WorkerShutdownNotification notification) {
        log.info("Processing worker shutdown: WorkerID={}, Reason={}",
                notification.getWorkerId(), notification.getReason());

        handleWorkerDisconnection(notification.getWorkerId(), "Shutdown: " + notification.getReason());
    }

    @Transactional
    public void handleWorkerDisconnection(String workerId, String reason) {
        workerRepository.findById(workerId).ifPresent(worker -> {
            if (!"DISCONNECTED".equals(worker.getStatus())) {
                String prev = worker.getStatus();
                worker.setStatus("DISCONNECTED");
                workerRepository.save(worker);

                recordTransition(workerId, prev, "DISCONNECTED", reason);

                // Close active session
                sessionRepository.findFirstByWorkerIdAndDisconnectedAtIsNullOrderByConnectedAtDesc(workerId)
                        .ifPresent(s -> {
                            s.setDisconnectedAt(Instant.now());
                            s.setDisconnectReason(reason);
                            sessionRepository.save(s);
                        });

                eventPublisher.publishWorkerDisconnected(workerId, reason);

                // Reconcile jobs
                jobLifecycleService.reconcileWorkerDisconnection(workerId, reason);
            }
        });
    }

    @Scheduled(fixedRate = 3000)
    public void sweepExpiredWorkers() {
        for (WorkerEntity worker : workerRepository.findAll()) {
            if (!"DISCONNECTED".equals(worker.getStatus()) && worker.isExpired(heartbeatTimeoutSeconds)) {
                log.warn("Worker heartbeat timed out. Marking DISCONNECTED: ID={}, LastHeartbeat={}",
                        worker.getWorkerId(), worker.getLastHeartbeatAt());
                handleWorkerDisconnection(worker.getWorkerId(), "Heartbeat timed out (> " + heartbeatTimeoutSeconds + "s)");
            }
        }
    }

    private void recordTransition(String workerId, String from, String to, String reason) {
        WorkerStateTransitionEntity transition = WorkerStateTransitionEntity.builder()
                .transitionId(UUID.randomUUID().toString())
                .workerId(workerId)
                .fromStatus(from)
                .toStatus(to)
                .reason(reason)
                .timestamp(Instant.now())
                .build();
        transitionRepository.save(transition);
    }

    public Collection<WorkerEntity> getAllWorkers() {
        return workerRepository.findAll();
    }

    public Optional<WorkerEntity> getWorker(String workerId) {
        return workerRepository.findById(workerId);
    }
}
