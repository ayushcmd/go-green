package com.gogreen.controlplane.infrastructure.events.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gogreen.controlplane.infrastructure.events.model.MeshEvent;
import com.gogreen.controlplane.infrastructure.events.model.MeshEventType;
import io.nats.client.*;
import io.nats.client.api.PublishAck;
import io.nats.client.api.StorageType;
import io.nats.client.api.StreamConfiguration;
import io.nats.client.api.StreamInfo;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Consumer;

@Service
public class ResilientEventBus implements MeshEventPublisher {
    private static final Logger log = LoggerFactory.getLogger(ResilientEventBus.class);

    private static final String STREAM_NAME = "GOGREEN_EVENTS";
    private static final String SUBJECT_PREFIX = "gogreen.events.";

    private final boolean natsEnabled;
    private final String natsUrl;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private Connection natsConnection;
    private JetStream jetStream;

    // Deduplication tracking: eventId -> processed timestamp
    private final ConcurrentHashMap<String, Long> processedEventIds = new ConcurrentHashMap<>();

    // Dead-letter queue (DLQ) for events failing processing
    private final ConcurrentLinkedQueue<MeshEvent> deadLetterQueue = new ConcurrentLinkedQueue<>();

    // In-memory event audit log
    private final ConcurrentLinkedDeque<MeshEvent> eventHistory = new ConcurrentLinkedDeque<>();
    private static final int MAX_HISTORY_SIZE = 1000;

    // In-process event subscribers by event type
    private final Map<String, List<Consumer<MeshEvent>>> subscribers = new ConcurrentHashMap<>();

    public ResilientEventBus(
            @Value("${mesh.nats.enabled:false}") boolean natsEnabled,
            @Value("${mesh.nats.url:nats://localhost:4222}") String natsUrl) {
        this.natsEnabled = natsEnabled;
        this.natsUrl = natsUrl;
    }

    @PostConstruct
    public void init() {
        if (natsEnabled) {
            try {
                Options options = new Options.Builder()
                        .server(natsUrl)
                        .connectionTimeout(java.time.Duration.ofSeconds(2))
                        .reconnectWait(java.time.Duration.ofSeconds(1))
                        .maxReconnects(-1)
                        .build();

                this.natsConnection = Nats.connect(options);
                this.jetStream = natsConnection.jetStream();

                JetStreamManagement jsm = natsConnection.jetStreamManagement();
                try {
                    jsm.getStreamInfo(STREAM_NAME);
                } catch (JetStreamApiException e) {
                    if (e.getErrorCode() == 404) {
                        StreamConfiguration streamConfig = StreamConfiguration.builder()
                                .name(STREAM_NAME)
                                .subjects(SUBJECT_PREFIX + ">")
                                .storageType(StorageType.Memory)
                                .build();
                        jsm.addStream(streamConfig);
                        log.info("Initialized NATS JetStream stream: {}", STREAM_NAME);
                    }
                }
                log.info("Connected to NATS JetStream server at {}", natsUrl);
            } catch (Exception e) {
                log.warn("NATS server unreachable at {}. Operating with in-memory resilient event bus: {}",
                        natsUrl, e.getMessage());
            }
        } else {
            log.info("NATS messaging disabled by configuration. Using high-performance in-memory resilient event bus.");
        }
    }

    @PreDestroy
    public void cleanup() {
        if (natsConnection != null) {
            try {
                natsConnection.close();
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            }
        }
    }

    @Override
    public void publish(MeshEvent event) {
        if (event == null || event.getEventId() == null) {
            return;
        }

        // 1. Deduplication Check
        if (processedEventIds.putIfAbsent(event.getEventId(), System.currentTimeMillis()) != null) {
            log.warn("Duplicate event detected, dropping: ID={}, Type={}", event.getEventId(), event.getEventType());
            return;
        }

        // 2. Add to event history with bound
        eventHistory.addLast(event);
        while (eventHistory.size() > MAX_HISTORY_SIZE) {
            eventHistory.pollFirst();
        }

        // 3. Publish to NATS JetStream if available
        if (jetStream != null) {
            try {
                String subject = SUBJECT_PREFIX + event.getEventType();
                byte[] payload = objectMapper.writeValueAsBytes(event);

                io.nats.client.impl.Headers headers = new io.nats.client.impl.Headers();
                headers.add("Nats-Msg-Id", event.getEventId());

                io.nats.client.Message natsMsg = io.nats.client.impl.NatsMessage.builder()
                        .subject(subject)
                        .headers(headers)
                        .data(payload)
                        .build();

                PublishAck ack = jetStream.publish(natsMsg);
                event.setAcknowledged(ack != null);
                log.debug("Published to JetStream: seq={}, subject={}", ack.getSeqno(), subject);
            } catch (Exception e) {
                log.warn("Failed to publish to NATS JetStream, routing to local dispatch: {}", e.getMessage());
                event.setDeliveryAttempts(event.getDeliveryAttempts() + 1);
            }
        }

        // 4. In-process dispatch to subscribers
        dispatchToSubscribers(event);
    }

    public void subscribe(String eventType, Consumer<MeshEvent> consumer) {
        subscribers.computeIfAbsent(eventType, k -> new CopyOnWriteArrayList<>()).add(consumer);
    }

    private void dispatchToSubscribers(MeshEvent event) {
        List<Consumer<MeshEvent>> list = subscribers.get(event.getEventType());
        if (list != null) {
            for (Consumer<MeshEvent> consumer : list) {
                try {
                    consumer.accept(event);
                    event.setAcknowledged(true);
                } catch (Exception ex) {
                    log.error("Subscriber error for event {}: {}", event.getEventId(), ex.getMessage(), ex);
                    event.setDeliveryAttempts(event.getDeliveryAttempts() + 1);
                    if (event.getDeliveryAttempts() >= 3) {
                        deadLetterQueue.add(event);
                        log.error("Event exceeded retry limit, routed to Dead-Letter Queue: ID={}", event.getEventId());
                    }
                }
            }
        }
    }

    // Typed helpers
    @Override
    public void publishWorkerRegistered(String workerId, String hostname, String arch, String isas) {
        publish(MeshEvent.builder()
                .eventType(MeshEventType.WORKER_REGISTERED)
                .aggregateId(workerId)
                .data(Map.of(
                        "workerId", workerId,
                        "hostname", hostname,
                        "architecture", arch,
                        "instructionSets", isas != null ? isas : ""
                ))
                .build());
    }

    @Override
    public void publishWorkerHeartbeat(String workerId, long sequence, double cpuUsage, long memUsed) {
        publish(MeshEvent.builder()
                .eventType(MeshEventType.WORKER_HEARTBEAT)
                .aggregateId(workerId)
                .data(Map.of(
                        "workerId", workerId,
                        "sequence", sequence,
                        "cpuUsagePercent", cpuUsage,
                        "memoryUsedBytes", memUsed
                ))
                .build());
    }

    @Override
    public void publishWorkerDisconnected(String workerId, String reason) {
        publish(MeshEvent.builder()
                .eventType(MeshEventType.WORKER_DISCONNECTED)
                .aggregateId(workerId)
                .data(Map.of(
                        "workerId", workerId,
                        "reason", reason != null ? reason : "Heartbeat timeout"
                ))
                .build());
    }

    @Override
    public void publishJobSubmitted(String jobId, String workloadType, int priority) {
        publish(MeshEvent.builder()
                .eventType(MeshEventType.JOB_SUBMITTED)
                .aggregateId(jobId)
                .data(Map.of(
                        "jobId", jobId,
                        "workloadType", workloadType,
                        "priority", priority
                ))
                .build());
    }

    @Override
    public void publishJobAssigned(String jobId, String workerId) {
        publish(MeshEvent.builder()
                .eventType(MeshEventType.JOB_ASSIGNED)
                .aggregateId(jobId)
                .data(Map.of(
                        "jobId", jobId,
                        "workerId", workerId
                ))
                .build());
    }

    @Override
    public void publishJobStarted(String jobId, String workerId) {
        publish(MeshEvent.builder()
                .eventType(MeshEventType.JOB_STARTED)
                .aggregateId(jobId)
                .data(Map.of(
                        "jobId", jobId,
                        "workerId", workerId
                ))
                .build());
    }

    @Override
    public void publishJobCompleted(String jobId, String workerId, double durationMs) {
        publish(MeshEvent.builder()
                .eventType(MeshEventType.JOB_COMPLETED)
                .aggregateId(jobId)
                .data(Map.of(
                        "jobId", jobId,
                        "workerId", workerId,
                        "durationMs", durationMs
                ))
                .build());
    }

    @Override
    public void publishJobFailed(String jobId, String workerId, String errorDetails) {
        publish(MeshEvent.builder()
                .eventType(MeshEventType.JOB_FAILED)
                .aggregateId(jobId)
                .data(Map.of(
                        "jobId", jobId,
                        "workerId", workerId != null ? workerId : "",
                        "errorDetails", errorDetails != null ? errorDetails : "Unknown error"
                ))
                .build());
    }

    @Override
    public void publishJobCancelled(String jobId, String reason) {
        publish(MeshEvent.builder()
                .eventType(MeshEventType.JOB_CANCELLED)
                .aggregateId(jobId)
                .data(Map.of(
                        "jobId", jobId,
                        "reason", reason != null ? reason : "User cancelled"
                ))
                .build());
    }

    public List<MeshEvent> getEventHistory() {
        return new ArrayList<>(eventHistory);
    }

    public List<MeshEvent> getDeadLetterQueue() {
        return new ArrayList<>(deadLetterQueue);
    }
}
