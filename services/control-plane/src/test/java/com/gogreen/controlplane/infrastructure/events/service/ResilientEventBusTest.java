package com.gogreen.controlplane.infrastructure.events.service;

import com.gogreen.controlplane.infrastructure.events.model.MeshEvent;
import com.gogreen.controlplane.infrastructure.events.model.MeshEventType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

class ResilientEventBusTest {

    private ResilientEventBus eventBus;

    @BeforeEach
    void setUp() {
        // Run with in-memory resilient engine
        eventBus = new ResilientEventBus(false, "nats://localhost:4222");
        eventBus.init();
    }

    @Test
    @DisplayName("Delivery: Subscribers receive published events")
    void shouldDeliverEventsToSubscribers() {
        List<MeshEvent> received = new ArrayList<>();
        eventBus.subscribe(MeshEventType.JOB_SUBMITTED, received::add);

        eventBus.publishJobSubmitted("job-101", "CPU_INFORMATION", 80);

        assertThat(received).hasSize(1);
        MeshEvent event = received.get(0);
        assertThat(event.getEventType()).isEqualTo(MeshEventType.JOB_SUBMITTED);
        assertThat(event.getAggregateId()).isEqualTo("job-101");
        assertThat(event.getData().get("workloadType")).isEqualTo("CPU_INFORMATION");
    }

    @Test
    @DisplayName("Deduplication: Duplicate event IDs are dropped")
    void shouldDropDuplicateEvents() {
        AtomicInteger counter = new AtomicInteger();
        eventBus.subscribe(MeshEventType.JOB_COMPLETED, e -> counter.incrementAndGet());

        MeshEvent event1 = MeshEvent.builder()
                .eventId("evt-dedup-1")
                .eventType(MeshEventType.JOB_COMPLETED)
                .aggregateId("job-1")
                .build();

        MeshEvent duplicate = MeshEvent.builder()
                .eventId("evt-dedup-1")
                .eventType(MeshEventType.JOB_COMPLETED)
                .aggregateId("job-1")
                .build();

        eventBus.publish(event1);
        eventBus.publish(duplicate);

        assertThat(counter.get()).isEqualTo(1);
        assertThat(eventBus.getEventHistory()).hasSize(1);
    }

    @Test
    @DisplayName("DLQ Routing: Failing subscriber handler routes event to Dead-Letter Queue after 3 attempts")
    void shouldRouteToDLQAfterFailures() {
        eventBus.subscribe(MeshEventType.JOB_FAILED, e -> {
            throw new RuntimeException("Simulated processing failure");
        });

        MeshEvent event = MeshEvent.builder()
                .eventId("evt-fail-1")
                .eventType(MeshEventType.JOB_FAILED)
                .aggregateId("job-fail")
                .deliveryAttempts(2) // already failed twice
                .build();

        eventBus.publish(event);

        assertThat(eventBus.getDeadLetterQueue()).hasSize(1);
        assertThat(eventBus.getDeadLetterQueue().get(0).getEventId()).isEqualTo("evt-fail-1");
    }
}
