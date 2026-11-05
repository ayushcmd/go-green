# GoGreen Native Core Engine

The **GoGreen Native Core Engine** is a high-performance C++23 native subsystem engineered for bare-metal x86-64 microarchitectural inspection, genuine CPU capability detection, System V AMD64 ABI assembly execution, and local hardware telemetry.

---

## 1. Subsystem Architecture

```
native/core-engine/
├── CMakeLists.txt              # CMake build manifest (C++23 standard)
├── include/gogreen/
│   ├── cpu_info.hpp            # Genuine CPUID vendor, model, cache topology
│   ├── cpu_features.hpp        # ISA capability detection & OS XSAVE/XCR0 gating
│   ├── hardware_info.hpp       # /proc/meminfo, loadavg, uptime & PMC detection
│   ├── benchmark.hpp           # High-resolution microbenchmark harness
│   └── engine.hpp              # Singleton lifecycle & JSON state serialization
├── src/
│   ├── cpu_info.cpp            # CPUID leaves 0, 1, 0x80000002-4 & /proc/cpuinfo
│   ├── cpu_features.cpp        # CPUID leaf 1/7 + xgetbv XCR0 OS register verification
│   ├── hardware_info.cpp       # Host OS & kernel environment, perf_event paranoid check
│   ├── benchmark.cpp           # Monotonic nanosecond timing, percentiles & MB/s calculation
│   ├── engine.cpp              # Engine coordination & thread-safe benchmark history
│   └── main.cpp                # HTTP 1.1 daemon listening strictly on 127.0.0.1:8080
├── tests/
│   └── test_core_engine.cpp    # Unit & integration test suite
└── README.md
```

---

## 2. Hardware & Feature Detection

The engine implements honest, non-fabricated hardware detection:
- **CPUID Leaves:**
  - `EAX=0`: Vendor string (`AuthenticAMD`, `GenuineIntel`).
  - `EAX=1`: Processor family, model, stepping, and baseline SSE2/SSE4.2/FMA/AES-NI support.
  - `EAX=7, ECX=0`: Advanced vector and bit manipulation sets (AVX2, AVX-512 foundation, AVX-512 subsets, SHA-NI, BMI1, BMI2).
  - `EAX=0x80000002..0x80000004`: Full processor brand name string.
- **OS Extended State Verification (`XCR0`):**
  - AVX and AVX2 execution is strictly gated on OSXSAVE (`CPUID.1:ECX.27`) and `(XCR0 & 0x6) == 0x6` (XMM and YMM state preserved by OS kernel).
  - AVX-512 execution is gated on `(XCR0 & 0xE6) == 0xE6` (opmask, ZMM_Hi256, and Hi16_ZMM state enabled).
- **Subsystem & Host Environment:**
  - Distinguishes native Linux from Linux under WSL2 via `/proc/version` inspection.
  - Inspects `/proc/sys/kernel/perf_event_paranoid` to report user-space vs kernel PMC restriction levels.

---

## 3. Native Microbenchmarks

Compares hand-optimized NASM routines with `-O3` portable C++ fallbacks:
1. `asm_add_i64` vs `fallback_add_i64`: 64-bit integer addition.
2. `asm_memcpy` vs `fallback_memcpy`: 64-bit quadword block copy loop.
3. `asm_memcmp` vs `fallback_memcmp`: Lexicographical memory comparison.
4. `asm_byte_sum` vs `fallback_byte_sum`: Unsigned byte accumulation.
5. `asm_simd_add_f32` vs `fallback_simd_add_f32`: 128-bit vector float addition (`movups`, `addps`).

All benchmark runs measure:
- Total duration in milliseconds.
- Throughput in operations/second and MB/s.
- Min, Max, Median, p90, and p99 latency in nanoseconds.
- Bitwise correctness verification comparing against known output.

---

## 4. HTTP API Endpoints

The native daemon binds exclusively to `127.0.0.1:8080`:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/health` | Daemon uptime, health state, and engine version |
| `GET` | `/api/v1/host` | Linux kernel version, uptime, load averages, RAM & PMC status |
| `GET` | `/api/v1/cpu` | CPUID vendor, brand, logical/physical cores, L1/L2/L3 cache |
| `GET` | `/api/v1/cpu/features` | Full ISA vector/crypto matrix with hardware and OS flags |
| `GET` | `/api/v1/engine/status` | High-level engine status, active feature count, recorded runs |
| `GET` | `/api/v1/telemetry` | Real-time memory allocation and 1m/5m/15m system load |
| `GET` | `/api/v1/benchmarks` | Full historical array of executed benchmark metrics |
| `POST` | `/api/v1/benchmarks/run` | Triggers execution of benchmark suite or specific kernel |

---

## 5. Building & Testing

```bash
cd native
mkdir -p build && cd build
cmake ..
make -j4
ctest --output-on-failure
```

Run daemon on custom port:
```bash
./core-engine/gogreen-daemon --port 8080
```
