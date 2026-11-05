# GoGreen Control Plane Coordinator

The GoGreen Control Plane is the central coordinator for the distributed execution mesh in the GoGreen Polyglot Systems Engineering Laboratory. It manages worker node lifecycles, gRPC streaming channels, resource compatibility, workload scheduling, and telemetry ingestion.

## Architecture

```
                    +--------------------------------+
                    |    GoGreen Studio UI (React)   |
                    +---------------+----------------+
                                    | HTTP / REST (8081)
                                    v
+-----------------------------------+-----------------------------------+
|               GoGreen Control Plane Coordinator (Java 25)            |
|                                                                       |
|  +--------------------+  +----------------------+  +---------------+  |
|  | REST API Controller|  | WorkerRegistryService|  |  JobScheduler |  |
|  +--------------------+  +----------------------+  +---------------+  |
|                                   |                                   |
|                +------------------+------------------+                |
|                |  MeshCoordinatorGrpcService (50051) |                |
|                +------------------+------------------+                |
+-----------------------------------+-----------------------------------+
                                    | gRPC Bidirectional Stream
                                    | (TLS / mTLS + Protobuf v1)
                                    v
                      +-----------------------------+
                      |   Go Worker Agent (Go)      |
                      +--------------+--------------+
                                     | HTTP (127.0.0.1:8080)
                                     v
                      +-----------------------------+
                      | Native Core Engine (C++23)  |
                      +-----------------------------+
```

## Key Capabilities

1. **Bidirectional gRPC Mesh Channel (`MeshCoordinator/Connect`)**:
   - Single long-lived persistent HTTP/2 connection per worker.
   - Low-latency multiplexed messaging for registrations, heartbeats, jobs, and telemetry snapshots.
2. **Strict Hardware Compatibility & Validation**:
   - Matches required CPU architecture and SIMD instruction sets (e.g. `AVX2`, `FMA`) before dispatching jobs.
3. **Heartbeat Management & Automated Expiration**:
   - Monotonically increasing heartbeat sequence numbers.
   - Background scheduler automatically detects stale workers and marks them `DISCONNECTED`.
4. **Transport Security (TLS / mTLS)**:
   - Supports mutual TLS authentication requiring worker client certificates signed by the mesh Root CA.
5. **Studio REST API**:
   - `GET /api/v1/mesh/status`: Mesh topology summary and aggregate computing capacity.
   - `GET /api/v1/mesh/workers`: List of registered worker nodes with real-time hardware telemetry.
   - `GET /api/v1/mesh/jobs`: Distributed job state tracking.

## Configuration Properties (`application.yml`)

| Property | Default | Description |
|---|---|---|
| `server.port` | `8081` | Spring Boot REST API HTTP port |
| `mesh.coordinator.grpc.port` | `50051` | gRPC Coordinator listening port |
| `mesh.coordinator.grpc.heartbeat-timeout-seconds` | `10` | Worker expiration timeout |
| `mesh.coordinator.grpc.tls.enabled` | `false` | Enable TLS transport encryption |
| `mesh.coordinator.grpc.tls.mtls-enabled` | `false` | Enforce mutual TLS certificate validation |
| `mesh.coordinator.grpc.max-message-size` | `8388608` | Max gRPC message size in bytes (8MB) |

## Building and Running

```bash
mvn clean package
java -jar target/control-plane-1.0.0-phase3.jar
```
