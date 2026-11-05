# GoGreen System Architecture

## 1. Architectural Overview
GoGreen is composed of a decoupled multi-layer architecture:

```
+--------------------------------------------------------------+
|                 STUDIO UI (React / TypeScript)               |
|                                                              |
| [Overview] [Core Engine] [Binary Lab] [Profiler] [Mesh]     |
| [Sandbox]  [Monitor]    [Experiments] [Logs]   [Settings]    |
+--------------------------------------------------------------+
                               ▲
                               │ JSON-RPC / WebSocket / REST
                               ▼
+--------------------------------------------------------------+
|                  HOST GATEWAY & CONTROL PLANE                |
|  - Telemetry Dispatcher                                      |
|  - Worker Registry & Mesh Coordinator                        |
|  - Binary Analysis & Disassembly Service                     |
|  - Sandbox Container Manager                                 |
+--------------------------------------------------------------+
                               ▲
                               │ Native IPC / Syscalls
                               ▼
+--------------------------------------------------------------+
|             NATIVE KERNELS & HARDWARE EXECUTION              |
|  - x86_64 / ARM64 Assembly Micro-routines                    |
|  - C/Rust Native Extension Modules                           |
|  - Hardware Performance Counters (eBPF / perf_event)         |
|  - Linux cgroups v2 & Seccomp-BPF Jails                      |
+--------------------------------------------------------------+
```

## 2. Frontend Subsystems
The Studio UI is engineered as an SPA utilizing React 19, TypeScript in strict mode, Vite, Tailwind CSS, TanStack Query, and React Router.

Key frontend capabilities:
- **Client-Side Binary Engine:** Parses ELF and PE headers directly in the browser using `ArrayBuffer` and `DataView` for instant offline inspection of local binaries without network overhead.
- **Virtual Hex Viewer:** Renders binary offsets, hex bytes, and ASCII representation cleanly with zero lag on large files.
- **Adaptive Network State Machine:** Senses backend availability, manages reconnection backoff, and ensures honest operational status reporting.

## 3. Communication Protocols
- **Control Plane:** REST and JSON-RPC 2.0 endpoints for configuration, job submissions, and worker management.
- **Real-Time Telemetry:** WebSockets for continuous hardware metrics, log streams, and benchmark progress updates.
- **Worker Mesh:** gRPC over mutual TLS (mTLS) for secure, high-throughput inter-node task coordination.
