package com.gogreen.controlplane.transport.grpc;

import com.gogreen.controlplane.domain.model.WorkerNode;
import com.gogreen.controlplane.domain.service.JobSchedulerService;
import com.gogreen.controlplane.domain.service.WorkerRegistryService;
import com.gogreen.mesh.v1.*;
import com.google.protobuf.Timestamp;
import io.grpc.stub.StreamObserver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class MeshCoordinatorGrpcService extends MeshCoordinatorGrpc.MeshCoordinatorImplBase {
    private static final Logger log = LoggerFactory.getLogger(MeshCoordinatorGrpcService.class);

    private final WorkerRegistryService workerRegistryService;
    private final JobSchedulerService jobSchedulerService;
    private final int defaultHeartbeatInterval;

    // Track active response streams by workerId
    private final ConcurrentHashMap<String, StreamObserver<CoordinatorMessage>> activeStreams = new ConcurrentHashMap<>();

    public MeshCoordinatorGrpcService(
            WorkerRegistryService workerRegistryService,
            JobSchedulerService jobSchedulerService,
            @Value("${mesh.coordinator.grpc.worker-heartbeat-interval-seconds:3}") int defaultHeartbeatInterval) {
        this.workerRegistryService = workerRegistryService;
        this.jobSchedulerService = jobSchedulerService;
        this.defaultHeartbeatInterval = defaultHeartbeatInterval;
    }

    @Override
    public StreamObserver<WorkerMessage> connect(StreamObserver<CoordinatorMessage> responseObserver) {
        return new StreamObserver<>() {
            private String attachedWorkerId;

            @Override
            public void onNext(WorkerMessage msg) {
                switch (msg.getPayloadCase()) {
                    case REGISTRATION -> handleRegistration(msg.getRegistration());
                    case HEARTBEAT -> handleHeartbeat(msg.getHeartbeat());
                    case JOB_ACK -> handleJobAck(msg.getJobAck());
                    case JOB_PROGRESS -> handleJobProgress(msg.getJobProgress());
                    case JOB_RESULT -> handleJobResult(msg.getJobResult());
                    case SHUTDOWN -> handleShutdown(msg.getShutdown());
                    case TELEMETRY -> handleTelemetry(msg.getTelemetry());
                    case PAYLOAD_NOT_SET -> log.warn("Received empty WorkerMessage payload");
                }
            }

            private void handleRegistration(WorkerRegistration reg) {
                this.attachedWorkerId = reg.getWorkerId();
                activeStreams.put(reg.getWorkerId(), responseObserver);

                WorkerNode node = workerRegistryService.registerWorker(reg);

                CoordinatorMessage ack = CoordinatorMessage.newBuilder()
                        .setRegistrationAck(WorkerRegistrationAck.newBuilder()
                                .setAccepted(true)
                                .setWorkerId(reg.getWorkerId())
                                .setAssignedPartition(node.getAssignedPartition())
                                .setHeartbeatIntervalSeconds(defaultHeartbeatInterval)
                                .setMessage("Registration successful")
                                .setRegisteredAt(toTimestamp(Instant.now()))
                                .build())
                        .build();

                responseObserver.onNext(ack);
            }

            private void handleHeartbeat(WorkerHeartbeat hb) {
                workerRegistryService.recordHeartbeat(hb);

                CoordinatorMessage ack = CoordinatorMessage.newBuilder()
                        .setHeartbeatAck(HeartbeatAck.newBuilder()
                                .setWorkerId(hb.getWorkerId())
                                .setAcknowledgedSequence(hb.getSequenceNumber())
                                .setTimestamp(toTimestamp(Instant.now()))
                                .build())
                        .build();

                responseObserver.onNext(ack);
            }

            private void handleJobAck(JobAcknowledgement ack) {
                log.info("Job acknowledged: JobID={}, WorkerID={}, Accepted={}",
                        ack.getJobId(), ack.getWorkerId(), ack.getAccepted());
            }

            private void handleJobProgress(JobProgress progress) {
                log.debug("Job progress: JobID={}, Progress={}%",
                        progress.getJobId(), progress.getProgressPercent());
            }

            private void handleJobResult(JobResult result) {
                jobSchedulerService.recordJobResult(result);
            }

            private void handleShutdown(WorkerShutdownNotification notification) {
                workerRegistryService.processShutdown(notification);
                cleanup();
            }

            private void handleTelemetry(TelemetrySnapshot snapshot) {
                log.debug("Telemetry snapshot received from worker: {}", snapshot.getWorkerId());
            }

            @Override
            public void onError(Throwable t) {
                log.warn("gRPC client stream error for worker {}: {}", attachedWorkerId, t.getMessage());
                cleanup();
            }

            @Override
            public void onCompleted() {
                log.info("gRPC client stream completed for worker {}", attachedWorkerId);
                cleanup();
                responseObserver.onCompleted();
            }

            private void cleanup() {
                if (attachedWorkerId != null) {
                    activeStreams.remove(attachedWorkerId);
                }
            }
        };
    }

    public boolean dispatchJob(String workerId, JobAssignment assignment) {
        StreamObserver<CoordinatorMessage> stream = activeStreams.get(workerId);
        if (stream == null) {
            return false;
        }

        CoordinatorMessage msg = CoordinatorMessage.newBuilder()
                .setJobAssignment(assignment)
                .build();

        synchronized (stream) {
            stream.onNext(msg);
        }
        return true;
    }

    private static Timestamp toTimestamp(Instant instant) {
        return Timestamp.newBuilder()
                .setSeconds(instant.getEpochSecond())
                .setNanos(instant.getNano())
                .build();
    }
}
