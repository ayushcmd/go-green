# GoGreen System Architecture

## 1. Architectural Overview
GoGreen is composed of a decoupled multi-layer architecture spanning bare-metal native execution, Linux WSL2 background services, and the Industrial Performance Studio:

```
+--------------------------------------------------------------+
|                 STUDIO UI (React / TypeScript)               |
|                                                              |
| [Overview] [Core Engine] [Binary Lab] [Profiler] [Mesh]     |
| [Sandbox]  [Monitor]    [Experiments] [Logs]   [Settings]    |
+--------------------------------------------------------------+
                               ▲
                               │ HTTP REST / JSON / WebSockets
                               ▼
+--------------------------------------------------------------+
|             NATIVE DAEMON (C++23 on 127.0.0.1:8080)          |
|  - Real CPUID & Cache Geometry Detection                     |
|  - OSXSAVE & XCR0 OS Register State Verification             |
|  - /proc/meminfo & Loadavg Telemetry Dispatcher              |
|  - Monotonic Nanosecond Microbenchmark Harness               |
|  - Hardware PMC (perf_event_paranoid) Inspection             |
+--------------------------------------------------------------+
                               ▲
                               │ Direct Call / System V AMD64 ABI
                               ▼
+--------------------------------------------------------------+
|           BARE-METAL NASM KERNELS & HARDWARE EXECUTION       |
|  - 64-bit Integer Addition (`asm_add_i64`)                   |
|  - 64-bit Quadword Memory Block Copy (`asm_memcpy`)          |
|  - Lexicographical Memory Compare (`asm_memcmp`)             |
|  - Unsigned Byte Accumulation Loop (`asm_byte_sum`)          |
|  - 128-bit SIMD Vector Float Addition (`asm_simd_add_f32`)   |
|  - Portable C++23 Reference Fallbacks with Verification      |
+--------------------------------------------------------------+
```

## 2. Frontend Subsystems
The Studio UI is engineered as an SPA utilizing React, TypeScript in strict mode, Vite, Tailwind CSS, TanStack Query, and React Router.

Key frontend capabilities:
- **Client-Side Binary Engine:** Parses ELF and PE headers directly in the browser using `ArrayBuffer` and `DataView` for instant offline inspection of local binaries without network overhead.
- **Virtual Hex Viewer:** Renders binary offsets, hex bytes, and ASCII representation cleanly with zero lag on large files.
- **Adaptive Network State Machine:** Senses backend availability, manages reconnection backoff, and ensures honest operational status reporting.
- **Native Microarchitectural Link:** Connects to `http://127.0.0.1:8080` to display genuine CPU model information, hardware and OS-enabled ISA capabilities, live Linux memory allocations, and execute real bare-metal benchmarks on demand.

## 3. Native Engine Subsystem (Phase 2)
- **Standard:** ISO C++23 (`-std=c++23`) and NASM x86-64.
- **Calling Convention:** System V AMD64 ABI (arguments in `rdi, rsi, rdx, rcx, r8, r9`; return in `rax, xmm0`).
- **Feature Detection Protocol:**
  - Evaluates CPUID basic leaves (vendor, brand, logical/physical core topology, cache sizes).
  - Evaluates leaf 1 and leaf 7 vector and cryptographic feature flags.
  - Gating on OS register state: checks `CPUID.1:ECX[27]` (`OSXSAVE`) and reads `XCR0` via `xgetbv` to ensure the OS kernel preserves YMM and ZMM register files before permitting AVX or AVX-512 execution.
- **Benchmark Suite:**
  - Measures cycle-accurate durations, operations per second, memory bandwidth (MB/s), and percentile distributions (min, max, median, p90, p99).
  - Validates bitwise parity between Assembly microkernels and compiler-optimized C++ fallbacks.

## 4. Communication Protocols & Security
- **Local Binding Only:** The native daemon binds strictly to `127.0.0.1:8080`. Public interface binding is disabled.
- **Origin Validation & CORS:** Preflight `OPTIONS` and standard headers permit requests originating from GoGreen Studio running locally.
- **Controlled API Surface:** Only defined telemetry, inspection, and benchmark execution paths are exposed. No arbitrary command execution is permitted.
