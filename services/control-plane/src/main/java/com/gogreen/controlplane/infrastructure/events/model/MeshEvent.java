package com.gogreen.controlplane.infrastructure.events.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MeshEvent {

    @Builder.Default
    private String eventId = UUID.randomUUID().toString();

    private String eventType;
    private String aggregateId;

    @Builder.Default
    private Instant timestamp = Instant.now();

    @Builder.Default
    private Map<String, Object> data = new HashMap<>();

    private int deliveryAttempts;
    private boolean acknowledged;

    public MeshEvent withData(String key, Object value) {
        if (data == null) {
            data = new HashMap<>();
        }
        data.put(key, value);
        return this;
    }
}
