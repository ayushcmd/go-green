# GoGreen Distributed Mesh Architecture

## 1. System Overview

The GoGreen Distributed Mesh establishes a resilient, high-throughput distributed execution fabric connecting heterogeneous edge nodes to a centralized control plane. It enables parallel scheduling and execution of native CPU-bound benchmarks, hardware profiling tasks, and systems telemetry workloads.

```
+-------------------------------------------------------------------------+
|                        GoGreen Studio (Web UI)                          |
+------------------------------------+------------------------------------+
                                     | REST (HTTP/JSON)
                                     v
+-------------------------------------------------------------------------+
|                  Java 25 Control Plane Coordinator                     |
|                                                                         |
|  +------------------------+  +---------------------------------------+  |
|  | Worker Registry Service|  | Job Scheduler & Compatibility Service |  |
|  +------------------------+  +---------------------------------------+  |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  |          gRPC Bidirectional Mesh Channel (Port 50051)             |  |
|  +-------------------------------------------------------------------+  |
+------------------------------------+------------------------------------+
                                     |
                gRPC / HTTP/2 + mTLS | (gogreen.mesh.v1)
                                     |
               +---------------------+---------------------+
               |                                           |
               v                                           v
+-----------------------------+             +-----------------------------+
|    Go Worker Agent #1       |             |    Go Worker Agent #2       |
|                             |             |                             |
|  +-----------------------+  |             |  +-----------------------+  |
|  | Discovery & Lifecycle |  |             |  | Discovery & Lifecycle |  |
|  +-----------------------+  |             |  +-----------------------+  |
|  | Local Workload Engine |  |             |  | Local Workload Engine |  |
|  +-----------+-----------+  |             |  +-----------+-----------+  |
+--------------|--------------+             +--------------|--------------+
               | HTTP (Localhost only)                     | HTTP (Localhost)
               v                                           v
+-----------------------------+             +-----------------------------+
| Phase 2 Native Core Engine  |             | Phase 2 Native Core Engine  |
| (C++23 + NASM Kernels)      |             | (C++23 + NASM Kernels)      |
+-----------------------------+             +-----------------------------+
```

## 2. Core Architectural Principles

1. **Strict Protocol Contract First**:
   - All inter-node communication is strictly defined using Protocol Buffers v3 (`contracts/protobuf/gogreen/mesh/v1/`).
   - Strong schema guarantees across polyglot components (Java, Go, C++, TypeScript).
2. **Long-Lived Bidirectional Streaming**:
   - Workers initiate and maintain a single persistent HTTP/2 gRPC channel (`MeshCoordinator.Connect`).
   - Multiplexed streaming avoids per-request connection setup overhead.
3. **True Hardware Grounding**:
   - Workers query the genuine local Phase 2 C++ engine (`127.0.0.1:8080`) to discover actual CPU microarchitecture, physical/logical core topologies, and hardware-verified SIMD feature sets (`AVX`, `AVX2`, `AVX-512`, `FMA`, `BMI1`, `BMI2`).
4. **Sandboxed Native Execution**:
   - Worker agents never execute arbitrary shell commands.
   - Workloads are dispatched exclusively to verified local native C++ and assembly routines.
5. **Transport Security by Default**:
   - Zero-trust communication topology supported via mutual TLS (mTLS) with automated development PKI bootstrapping.

## 3. Phase 3.5: Distributed Scheduler, Persistence & Multi-Worker Execution

### 3.1. Scheduling Engine Architecture
The GoGreen Scheduler Engine (`com.gogreen.controlplane.domain.scheduler.SchedulerEngine`) implements deterministic, hardware-aware task placement across active mesh workers:

1. **Eligibility Filtering**:
   - Worker state must be `IDLE` or `BUSY` (rejects `DISCONNECTED`, `DRAINING`, `TERMINATING`).
   - Liveness check: `now - lastHeartbeatAt <= heartbeatTimeoutSeconds` (default: 10s).
   - Capacity guards: Active jobs per worker must be strictly `< 4` (`MAX_ACTIVE_JOBS_PER_WORKER = 4`), and CPU usage must be `< 95%`.
   - Workload type allowlist: strictly permits `CPU_INFORMATION`, `SYSTEM_TELEMETRY`, and `NATIVE_BENCHMARK_SUITE`.
2. **ISA Compatibility (Strict Enforcement)**:
   - Workloads requesting specific instruction sets (e.g. `AVX2`, `FMA`, `AVX-512`) are scheduled **only** to workers whose verified hardware profile contains the required flags.
   - Workers without verified `AVX2` support will **never** receive `AVX2` workloads.
3. **Multi-Factor Load Balancing & Scoring**:
   - Eligible workers are ranked using the following criteria:
     - Priority 1: Fewest active jobs (minimizes queuing latency).
     - Priority 2: Lowest CPU usage percentage.
     - Priority 3: Highest available memory (bytes).
4. **Auditability & Traceability**:
   - Every scheduling decision (success or rejection) is persisted durably to `mesh_scheduling_decisions` with candidate count, chosen worker, and rationale.

### 3.2. Durable Database Persistence (PostgreSQL & H2)
Database migrations are managed via Flyway (`db/migration/V1__init_mesh_schema.sql`):

- **`mesh_workers`**: Worker identity, hardware topology (CPUID vendor, model, physical/logical cores, instruction sets), memory, protocol versions, heartbeat sequence, and real-time load telemetry.
- **`mesh_worker_sessions`**: Connected/disconnected timestamps, disconnect reasons, total heartbeats received, and completed job metrics.
- **`mesh_jobs`**: Job status (`QUEUED`, `ASSIGNED`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`, `TIMED_OUT`, `RETRYING`), workload type, hardware constraints, priority, execution deadlines, and binary payloads.
- **`mesh_job_attempts`**: Immutable log of each execution attempt, worker ID, start/completion times, execution duration, and error details.
- **`mesh_scheduling_decisions`**: Historical record of every scheduler placement decision.
- **`mesh_worker_transitions`**: Auditable state transitions (`IDLE`, `BUSY`, `DRAINING`, `DISCONNECTED`).

### 3.3. Asynchronous Resilient Event Bus (NATS JetStream & In-Memory Fallback)
The mesh features an event-driven telemetry stream with explicit typed events:
- `worker.registered`, `worker.heartbeat`, `worker.disconnected`
- `job.submitted`, `job.assigned`, `job.started`, `job.completed`, `job.failed`, `job.cancelled`

Capabilities:
- **Deduplication**: In-flight and historical event IDs are tracked to eliminate duplicate event emissions.
- **Bounded Retries & DLQ**: Subscriber processing failures are retried up to 3 times before routing to the Dead-Letter Queue (DLQ).
- **Dual Mode**: Connects to external NATS JetStream servers when configured (`mesh.nats.enabled=true`), falling back transparently to a high-performance in-memory ring-buffer event bus.

### 3.4. Multi-Worker Execution & Failure Reconciliation
The mesh protocol supports multiple simultaneously connected Go workers:
- **Concurrent Heartbeats**: High-frequency multiplexed heartbeats over gRPC bidirectional streams.
- **Job Lifecycle Protocol**:
  - `JobAssignment` -> `JobAcknowledgement` (validates worker acceptance)
  - `JobProgress` (emitted during workload execution)
  - `JobResult` (delivered upon completion with duration and payload)
- **Failure Reconciliation**:
  - Worker disconnection triggers immediate reconciliation of orphaned jobs (`ASSIGNED` or `RUNNING`).
  - Jobs are requeued with `RETRYING` status until `max_retries` (default: 3) is exceeded, after which they transition permanently to `FAILED`.
