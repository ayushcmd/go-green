# GoGreen Sandbox Architecture Specification

## Phase 5: Sandbox & Execution Engineering

**Subsystem Identity:** BUILD DEEP. THINK LOW-LEVEL. ENGINEER BEYOND LIMITS.  
**Subsystem Scope:** Resource-Controlled Sandboxing, Multi-Tier Linux Isolation, Rust Supervisor, and Mesh Execution Integration.  
**Implementation Standard:** Rust 1.91 (2021 Edition), Tokio asynchronous runtime, Linux cgroups v2, Seccomp-BPF, Landlock LSM, and Linux Namespaces.

---

## 1. Subsystem Architecture

The Sandbox Manager is organized as an independent Rust subsystem (`services/sandbox-manager/`):

```
services/sandbox-manager/
├── Cargo.toml
└── src/
    ├── config/          # Execution profiles, resource limits, and validation
    │   ├── mod.rs
    │   └── policy.rs
    ├── isolation/       # Linux isolation primitives & capability detection
    │   ├── mod.rs
    │   ├── capabilities.rs
    │   ├── namespaces.rs
    │   ├── cgroups.rs
    │   ├── seccomp.rs
    │   └── landlock.rs
    ├── resources/       # Resource limits (rlimit, memory, CPU) & accounting
    │   ├── mod.rs
    │   ├── limits.rs
    │   └── accounting.rs
    ├── lifecycle/       # Process spawning, async monitoring, timeouts, cleanup
    │   ├── mod.rs
    │   ├── process.rs
    │   └── supervisor.rs
    ├── artifacts/       # Bounded output capture, SHA-256 digests, and metadata
    │   ├── mod.rs
    │   └── storage.rs
    ├── security/        # Audit logging, violation detection, and privilege dropping
    │   ├── mod.rs
    │   ├── audit.rs
    │   └── credentials.rs
    ├── telemetry/       # Metrics, health, and isolation status reporting
    │   ├── mod.rs
    │   └── metrics.rs
    ├── runtime/         # High-level workload executors
    │   ├── mod.rs
    │   └── executor.rs
    └── main.rs          # CLI entry point, HTTP REST daemon, and self-test harness
```

---

## 2. Core Modules & Responsibilities

### 2.1 Configuration & Policy Engine (`src/config/`)
- Declares `ExecutionProfile` defining:
  - `timeout_ms`: Maximum execution duration (watchdog enforced).
  - `max_memory_bytes`: Physical memory cap for cgroups v2 (`memory.max`).
  - `cpu_quota_us` / `cpu_period_us`: Bandwidth quota for CPU scheduling (`cpu.max`).
  - `max_pids`: Thread and child process threshold (`pids.max`).
  - `max_output_bytes`: Output limit for stdout and stderr to prevent memory exhaustion.
  - `network_policy`: Strict `NetworkPolicy::Isolated` (default) vs `NetworkPolicy::LoopbackOnly`.
  - `filesystem_policy`: Strict `FilesystemPolicy::ReadOnlyRootWithTmpfs`.

### 2.2 Isolation Primitives (`src/isolation/`)
- **`capabilities.rs`:** Dynamically inspects Linux kernel features:
  - Checks if cgroups v2 is mounted at `/sys/fs/cgroup`.
  - Checks availability of `cgroup.controllers` (`memory`, `cpu`, `pids`).
  - Probes Seccomp support via `prctl(PR_GET_SECCOMP)`.
  - Probes Landlock LSM availability via `syscall(__NR_landlock_create_ruleset)`.
  - Audits user namespace support (`/proc/sys/kernel/unprivileged_userns_clone`).
- **`namespaces.rs`:** Spawns child process with `CLONE_NEWPID | CLONE_NEWNS | CLONE_NEWNET | CLONE_NEWIPC | CLONE_NEWUTS`. Sets hostname to `gogreen-sandbox` and configures private mount hierarchy.
- **`cgroups.rs`:** Creates dedicated cgroup under `/sys/fs/cgroup/gogreen/sandbox_<id>/`. Assigns child PID to `cgroup.procs`. Sets `memory.max`, `memory.swap.max = 0`, `cpu.max`, and `pids.max`. Cleans up directory upon exit.
- **`seccomp.rs`:** Configures BPF filter permitting standard compute syscalls while trapping forbidden operations with `SECCOMP_RET_ERRNO(EPERM)` or `SECCOMP_RET_KILL_PROCESS`.
- **`landlock.rs`:** Restricts file access to read-only paths (`/usr`, `/lib`, `/bin`) and read-write access to private sandboxed workspace.

### 2.3 Lifecycle & Supervisor (`src/lifecycle/`)
- Manages execution state machine:
  1. `Validated`: Profile parameters validated.
  2. `Configuring`: cgroup created and resource limits written.
  3. `Launching`: Child process forked with namespace flags and unprivileged credentials.
  4. `Running`: Process running, Tokio task monitoring pipes and cgroups.
  5. `Terminating`: Process finished or terminated by watchdog timer / cancellation handle.
  6. `Cleaning`: cgroup removed, temporary directories unlinked.
  7. `Completed`: Bounded output persisted to artifact storage.

---

## 3. Distributed Mesh Integration

```
[Java Control Plane (SchedulerEngine)]
        |
        | 1. Validates worker has WORKLOAD_TYPE_SANDBOX_EXECUTION capability
        v
[Go Worker Agent (executor.go)]
        |
        | 2. Translates gRPC JobAssignment to SandboxExecutionRequest
        v
[Rust Sandbox Supervisor (sandbox-manager)]
        |
        | 3. Enforces cgroups v2, Seccomp, Namespaces, rlimits
        v
[Isolated Child Process (Sandboxed Workload)]
```
