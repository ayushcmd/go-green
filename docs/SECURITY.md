# GoGreen Security Architecture & Threat Model

> **BUILD DEEP. THINK LOW-LEVEL. ENGINEER BEYOND LIMITS.**

---

## 1. Security Philosophy & Principles

GoGreen is designed as a systems laboratory capable of inspecting and executing untrusted compiled binaries, stress-testing hardware architectures, and orchestrating distributed workloads across heterogeneous nodes. Because execution involves native code and arbitrary binaries, security is enforced through **strict defense-in-depth isolation**, **least privilege**, and **hardware-gated execution**.

### Core Tenets:
1. **Never Trust Execution Payloads:** Any binary submitted to the sandbox or BinaryLab must be treated as hostile.
2. **Multi-Tier Boundary Separation:** The host system, supervisor service, and untrusted child processes must operate across distinct privilege domains.
3. **Immutable Ephemerality:** Workloads execute in transient environments that are created, constrained, and destroyed on demand.
4. **Cryptographic Identity:** Mesh worker nodes and coordinators communicate over authenticated, mutually verified mTLS channels.

---

## 2. Threat Model & Trust Boundaries

```
[ UNTRUSTED ZONE ]
   Untrusted Executable / Hostile Binary / Malformed ELF/PE
           │
           ▼
┌────────────────────────────────────────────────────────┐
│ Boundary 1: BinaryLab Memory-Safe Parser               │
│ - Strict offset & bounds checking                      │
│ - Sanitized string extraction                          │
│ - Memory-isolated Capstone disassembly                 │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Boundary 2: Rust Sandbox Supervisor (Local Privileged) │
│ - POSIX rlimits setup                                  │
│ - cgroups v2 resource hierarchy creation               │
│ - Linux namespace unsharing                            │
│ - seccomp-BPF filter compilation                       │
└──────────────────────────┬─────────────────────────────┘
                           │ fork() & drop privileges (nobody:nogroup)
                           ▼
┌────────────────────────────────────────────────────────┐
│ Boundary 3: Hardened Child Process (Isolated)          │
│ - Isolated PID, Net, Mount, IPC, UTS namespaces        │
│ - cgroups v2 cpu/memory/pids limits                    │
│ - PR_SET_NO_NEW_PRIVS = 1                              │
│ - BPF filter blocking raw sockets, ptrace, bpf, etc.   │
└────────────────────────────────────────────────────────┘
```

---

## 3. Defense-in-Depth Isolation Layers

The GoGreen execution engine employs six discrete defensive rings:

### Ring 1: Linux Namespaces
Untrusted processes run inside dedicated Linux namespaces instantiated via `unshare()` or `clone()`:
- **PID Namespace (`CLONE_NEWPID`):** The sandboxed process becomes PID 1 inside its own isolated tree, unable to observe or signal host processes.
- **Mount Namespace (`CLONE_NEWNS`):** Filesystem mounts are isolated. Root is mounted read-only (`MS_RDONLY`), with only ephemeral `tmpfs` mounts allocated for scratch space.
- **Network Namespace (`CLONE_NEWNET`):** In `TIER_3_HARDENED`, the network stack is completely unshared without external interfaces, preventing network exfiltration or lateral movement.
- **IPC Namespace (`CLONE_NEWIPC`):** Isolates System V IPC and POSIX message queues.
- **UTS Namespace (`CLONE_NEWUTS`):** Isolates host and domain names, preventing hostname snooping.

### Ring 2: cgroups v2 Resource Hierarchy
Every execution dynamically spawns an ephemeral control group under `/sys/fs/cgroup/gogreen/sandbox-<uuid>`:
- **`cpu.max`:** Caps maximum CPU consumption (e.g., `80000 100000` = 80% ceiling) to mitigate Denial of Service (DoS) attacks.
- **`memory.max`:** Enforces hard physical memory ceiling (e.g., 128 MB). If breached, the kernel OOM killer terminates the process immediately.
- **`pids.max`:** Caps maximum child process count (e.g., max 32) to defeat fork bombs.
- **`io.weight`:** Throttles disk I/O to avoid saturating storage controllers.

### Ring 3: seccomp-BPF Syscall Filtering
A strict Berkeley Packet Filter (BPF) whitelist program is compiled and loaded via `prctl(PR_SET_SECCOMP)`. Syscalls not explicitly permitted result in immediate process termination (`SECCOMP_RET_KILL_PROCESS`).
- **Blocked Syscalls:**
  - `ptrace` (prevents process injection / tracing)
  - `bpf` (prevents kernel eBPF manipulation)
  - `sys_chroot` (prevents jailbreaking)
  - `mount`, `umount2` (prevents filesystem modifications)
  - `socket`, `connect`, `bind` (in network-isolated tiers)
  - `reboot`, `kexec_load` (prevents system reboots)

### Ring 4: POSIX Resource Limits (rlimits)
Prior to executing `execvp()`, the supervisor sets strict POSIX resource limits via `setrlimit()`:
- `RLIMIT_CPU`: Soft and hard CPU time limits.
- `RLIMIT_AS`: Maximum virtual address space ceiling.
- `RLIMIT_FSIZE`: Maximum file write size (prevents disk exhaustion).
- `RLIMIT_NPROC`: Maximum simultaneous process count.

### Ring 5: Privilege Dropping & No-New-Privs
1. **`PR_SET_NO_NEW_PRIVS = 1`:** Enforced via `prctl()`. Guarantees that neither the process nor any child can acquire higher privileges, even via `setuid` or `setgid` binaries.
2. **Credential Downgrade:** Drops root privileges to UID `65534` (`nobody`) and GID `65534` (`nogroup`).

### Ring 6: Bounded Logging & SHA-256 Manifests
- Output channels (`stdout`, `stderr`) are captured into bounded in-memory circular buffers (maximum 2 MB).
- Upon termination, an immutable JSON manifest is generated containing exit status, execution duration, peak memory usage, and SHA-256 digests of all produced artifacts.

---

## 4. Distributed Mesh Security & mTLS

The distributed mesh coordinates tasks across autonomous Go worker nodes and the Java control plane:
- **Mutual TLS (mTLS):** All gRPC connections on port `50051` require mutual TLS validation. Both coordinator and worker present x509 certificates signed by a trusted root Certificate Authority.
- **Hardware Fingerprinting:** During initial handshake (`WorkerRegistrationRequest`), workers report hardware UUIDs, CPUID topology, and machine identifiers.
- **Replay Protection:** Heartbeat frames carry monotonic sequence counters and millisecond timestamps; out-of-order or expired messages are dropped.
- **Partition Authorization:** Workers are cryptographically bound to specific logical partitions, preventing cross-tenant job theft.

---

## 5. BinaryLab Safety & Sandboxed Compiler Explorer

1. **Parser Bounds Validation:** The C++23 ELF and PE parsers validate all offsets against buffer length before reading header structs (`Elf64_Ehdr`, `IMAGE_DOS_HEADER`), preventing buffer over-reads and segmentation faults.
2. **Safe Disassembly:** The Capstone Engine is bounded by explicit buffer lengths; invalid instruction bytes are flagged without crashing the native daemon.
3. **Compiler Explorer Isolation:** Source compilation runs via an isolated `fork()` + `execvp()` wrapper with POSIX process timeouts (3000ms), output size caps (1MB), and restricted compiler flags to prevent arbitrary include loops.

---

## 6. Vulnerability Disclosure

If you discover a security vulnerability in GoGreen, please responsibly report it directly to the repository maintainer:

- **Maintainer:** Ayush (`ayushcmd`)
- **Security Contact:** `ayush_24a12res897@iitp.ac.in`

Please provide a detailed reproduction script or proof-of-concept (PoC). We commit to acknowledging receipt within 48 hours and providing a remediation timeline.
