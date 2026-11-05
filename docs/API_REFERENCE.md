# GoGreen API Reference

This document provides a comprehensive and verified reference for all HTTP REST APIs and gRPC streaming services in the GoGreen Polyglot Systems Engineering Laboratory.

---

## 1. Native Core Daemon REST API

The Native Core Engine daemon is a high-performance C++23 HTTP micro-daemon listening on `127.0.0.1:8080`.

### 1.1 System & Hardware Endpoints

#### `GET /api/v1/health`
Checks whether the native micro-daemon is alive and active.
- **Response:** `200 OK`
```json
{
  "status": "UP",
  "engine": "gogreen-native-engine",
  "version": "1.0.0",
  "uptime_seconds": 3600
}
```

#### `GET /api/v1/cpu`
Extracts raw hardware processor details via CPUID assembly instructions.
- **Response:** `200 OK`
```json
{
  "vendor": "GenuineIntel",
  "brand": "12th Gen Intel(R) Core(TM) i7-12700H",
  "stepping": 3,
  "model": 154,
  "family": 6,
  "logical_cores": 20,
  "physical_cores": 14,
  "features": {
    "sse": true,
    "sse2": true,
    "sse3": true,
    "ssse3": true,
    "sse4_1": true,
    "sse4_2": true,
    "avx": true,
    "avx2": true,
    "avx512_f": false,
    "fma": true,
    "aes": true,
    "rdrand": true,
    "rdseed": true,
    "sha": true,
    "bmi1": true,
    "bmi2": true
  }
}
```

#### `GET /api/v1/telemetry`
Returns real-time host metrics parsed directly from Linux `/proc`.
- **Response:** `200 OK`
```json
{
  "uptime_seconds": 12450,
  "load_average": {
    "1min": 0.42,
    "5min": 0.38,
    "15min": 0.35
  },
  "memory": {
    "total_bytes": 16641884160,
    "free_bytes": 10423840768,
    "available_bytes": 12891238400,
    "buffers_bytes": 12890112,
    "cached_bytes": 2458901230
  }
}
```

### 1.2 Micro-Benchmark Endpoints

#### `GET /api/v1/benchmarks`
Retrieves the list of available NASM assembly micro-benchmarks and their hardware requirements.
- **Response:** `200 OK`
```json
{
  "benchmarks": [
    {
      "name": "asm_add",
      "description": "64-bit register addition kernel",
      "required_isa": "x86_64",
      "supported_on_host": true
    },
    {
      "name": "asm_memcpy",
      "description": "Unrolled 64-bit word block memory copy",
      "required_isa": "x86_64",
      "supported_on_host": true
    },
    {
      "name": "asm_simd",
      "description": "128-bit SSE2 vector integer addition",
      "required_isa": "sse2",
      "supported_on_host": true
    }
  ]
}
```

#### `POST /api/v1/benchmarks/run`
Executes hardware-calibrated micro-benchmarks across NASM assembly and C++ implementations.
- **Request Body:**
```json
{
  "benchmark_name": "asm_memcpy",
  "iterations": 1000000,
  "buffer_size_bytes": 65536
}
```
- **Response:** `200 OK`
```json
{
  "benchmark_name": "asm_memcpy",
  "iterations": 1000000,
  "nasm_duration_ns": 412890,
  "cpp_duration_ns": 689120,
  "speedup_factor": 1.669,
  "throughput_mb_s": 158721.4,
  "verified_correct": true
}
```

### 1.3 BinaryLab Native Endpoints

#### `POST /api/v1/binary/analyze`
Inspects an uploaded executable (ELF or PE) and extracts headers, sections, and symbols.
- **Request Body:** Multipart or Base64 binary payload.
- **Response:** `200 OK`
```json
{
  "format": "ELF64",
  "architecture": "x86-64",
  "endianness": "Little-Endian",
  "entry_point": "0x00401000",
  "sections_count": 28,
  "sections": [
    { "name": ".text", "virtual_address": "0x00401000", "size": 65536, "flags": "r-x" },
    { "name": ".data", "virtual_address": "0x00411000", "size": 4096, "flags": "rw-" }
  ],
  "imported_symbols_count": 42,
  "exported_symbols_count": 12,
  "entropy": 5.892
}
```

#### `POST /api/v1/binary/disassemble`
Disassembles raw binary byte sequences using the Capstone Engine v5.0.
- **Request Body:**
```json
{
  "bytes_hex": "48895c24084889742410574883ec20488bfa",
  "architecture": "x86_64",
  "base_address": "0x1000"
}
```
- **Response:** `200 OK`
```json
{
  "instructions": [
    { "address": "0x1000", "mnemonic": "mov", "op_str": "qword ptr [rsp + 8], rbx", "bytes": "48895c2408" },
    { "address": "0x1005", "mnemonic": "mov", "op_str": "qword ptr [rsp + 0x10], rsi", "bytes": "4889742410" },
    { "address": "0x100a", "mnemonic": "push", "op_str": "rdi", "bytes": "57" }
  ]
}
```

#### `POST /api/v1/compiler/compile`
Invokes the sandboxed C++ compiler explorer to produce assembly.
- **Request Body:**
```json
{
  "source": "int square(int num) { return num * num; }",
  "compiler": "g++",
  "opt_level": "-O3"
}
```
- **Response:** `200 OK`
```json
{
  "success": true,
  "asm": "square(int):\n\tmov eax, edi\n\timul eax, edi\n\tret\n",
  "compile_time_ms": 48
}
```

---

## 2. Hardened Sandbox Supervisor REST API

The Rust Tokio supervisor listens on `127.0.0.1:8081`.

### `GET /health`
Returns supervisor status, active sandbox count, and resource statistics.
- **Response:** `200 OK`
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "active_sandboxes": 0,
  "total_executed": 42
}
```

### `GET /capabilities`
Reports the Linux isolation primitives available on the current host.
- **Response:** `200 OK`
```json
{
  "cgroups_v2": true,
  "namespaces": ["pid", "mount", "net", "ipc", "uts"],
  "seccomp_bpf": true,
  "unprivileged_user_namespaces": true,
  "max_supported_tier": "TIER_3_HARDENED"
}
```

### `POST /execute`
Executes an untrusted command under strict resource controls and isolation.
- **Request Body:**
```json
{
  "command": "uname",
  "args": ["-a"],
  "env": { "PATH": "/usr/bin:/bin" },
  "isolation_level": "TIER_3_HARDENED",
  "timeout_ms": 5000,
  "limits": {
    "max_memory_bytes": 67108864,
    "max_cpu_percent": 50,
    "max_output_bytes": 1048576,
    "max_pids": 16
  }
}
```
- **Response:** `200 OK`
```json
{
  "execution_id": "8f8b3c91-4d32-4e63-a621-12f0a1c1d89b",
  "status": "COMPLETED",
  "exit_code": 0,
  "duration_ms": 14,
  "stdout": "Linux gogreen-sandbox 6.6.87.2-1 #1 SMP PREEMPT_DYNAMIC x86_64\n",
  "stderr": "",
  "peak_memory_bytes": 1843200,
  "cpu_time_ms": 4,
  "manifest_sha256": "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a"
}
```

---

## 3. Java Control Plane REST API

The Spring Boot control plane coordinator listens on `0.0.0.0:8082`.

### `GET /api/v1/mesh/workers`
Returns all registered worker nodes, their hardware capabilities, and real-time health.
- **Response:** `200 OK`
```json
[
  {
    "worker_id": "worker-node-alpha-01",
    "status": "HEALTHY",
    "hostname": "workstation-x86",
    "architecture": "x86_64",
    "logical_cores": 20,
    "total_memory_bytes": 16641884160,
    "supported_isa": ["sse2", "sse4_2", "avx", "avx2"],
    "active_jobs": 0,
    "max_concurrent_jobs": 4,
    "last_heartbeat": "2026-11-05T10:14:02Z"
  }
]
```

### `POST /api/v1/mesh/jobs`
Submits a new job to the distributed scheduler.
- **Request Body:**
```json
{
  "workload_type": "NATIVE_BENCHMARK_SUITE",
  "priority": "HIGH",
  "required_isa": ["avx2"],
  "payload": {
    "benchmark": "asm_memcpy",
    "iterations": 500000
  }
}
```
- **Response:** `202 Accepted`
```json
{
  "job_id": "job-5a7b-4192",
  "status": "SCHEDULED",
  "assigned_worker_id": "worker-node-alpha-01",
  "submitted_at": "2026-11-05T10:15:30Z"
}
```

### `GET /api/v1/mesh/jobs/{jobId}`
Queries the status and result artifacts of a specific job.
- **Response:** `200 OK`

### `GET /api/v1/mesh/status`
Returns high-level mesh cluster statistics: total workers, active jobs, throughput, and scheduler health.
- **Response:** `200 OK`

---

## 4. gRPC Distributed Mesh Protocol

The Coordinator exposes a gRPC service on `0.0.0.0:50051` defined in `contracts/protobuf/coordinator.proto`:

```protobuf
syntax = "proto3";

package gogreen.mesh.coordinator.v1;

service MeshCoordinator {
  // Bidirectional streaming channel for registration, heartbeats, and job dispatch
  rpc Connect(stream WorkerMessage) returns (stream CoordinatorMessage);
}
```

### 4.1 Message Types (`WorkerMessage`)
- `WorkerRegistrationRequest`: Dispatched upon connection. Conveys worker ID, CPU topology, ISA flags, memory capacity, and OS version.
- `WorkerHeartbeatRequest`: Transmitted periodically (default: 3s). Conveys CPU utilization, memory usage, load averages, and active job counters.
- `JobStatusUpdate`: Conveys state transitions (`RUNNING`, `COMPLETED`, `FAILED`) and result metrics.

### 4.2 Message Types (`CoordinatorMessage`)
- `WorkerRegistrationResponse`: Confirms registration and assigns worker partition.
- `WorkerHeartbeatResponse`: Acknowledges heartbeat reception and updates synchronization clock.
- `JobAssignment`: Dispatches scheduled workloads to the worker with specific input arguments and resource ceilings.
