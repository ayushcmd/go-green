# GoGreen Mesh gRPC Protocol Specification

**Package**: `gogreen.mesh.v1`  
**Protocol Version**: `1.0.0`

## 1. Service Definition

```protobuf
service MeshCoordinator {
  // Bidirectional streaming channel between Worker Agent and Control Plane Coordinator
  rpc Connect(stream WorkerMessage) returns (stream CoordinatorMessage);
}
```

## 2. Framing & Message Flow

A single bidirectional stream multiplexes all control, telemetry, and execution events between an edge worker and the coordinator.

```
Worker Agent                                     Control Plane Coordinator
     |                                                       |
     | ----- 1. WorkerMessage(WorkerRegistration) ---------> |
     | <---- 2. CoordinatorMessage(WorkerRegistrationAck) -- |
     |                                                       |
     | ===== Heartbeat Loop (every 3s) ===================== |
     | ----- 3. WorkerMessage(WorkerHeartbeat) ------------> |
     | <---- 4. CoordinatorMessage(HeartbeatAck) ----------- |
     |                                                       |
     | ===== Job Execution ================================= |
     | <---- 5. CoordinatorMessage(JobAssignment) ---------- |
     | ----- 6. WorkerMessage(JobAcknowledgement) ---------> |
     | ----- 7. WorkerMessage(JobProgress) [Optional] -----> |
     | ----- 8. WorkerMessage(JobResult) ------------------> |
     |                                                       |
     | ===== Graceful Teardown ============================= |
     | ----- 9. WorkerMessage(WorkerShutdownNotification) -> |
     |                                                       |
```

## 3. Schemas

### `WorkerMessage` (Oneof Payload)
- `registration`: `WorkerRegistration`
- `heartbeat`: `WorkerHeartbeat`
- `job_ack`: `JobAcknowledgement`
- `job_progress`: `JobProgress`
- `job_result`: `JobResult`
- `shutdown`: `WorkerShutdownNotification`
- `telemetry`: `TelemetrySnapshot`

### `CoordinatorMessage` (Oneof Payload)
- `registration_ack`: `WorkerRegistrationAck`
- `heartbeat_ack`: `HeartbeatAck`
- `job_assignment`: `JobAssignment`
- `job_cancellation`: `JobCancellation`
- `command`: `CoordinatorCommand`

### Authorized Workload Types
- `WORKLOAD_TYPE_CPU_INFORMATION`: Queries CPUID, topology, caches, and instruction sets.
- `WORKLOAD_TYPE_SYSTEM_TELEMETRY`: Ingests CPU usage, memory stats, thread counts, and uptime.
- `WORKLOAD_TYPE_NATIVE_BENCHMARK_SUITE`: Executes bare-metal C++ and NASM assembly benchmarks (`asm_add`, `asm_memcpy`, `asm_memcmp`, `asm_byte_sum`, `asm_simd_add`).
