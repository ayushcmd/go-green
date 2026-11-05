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
