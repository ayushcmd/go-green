# GoGreen Sandbox Threat Model

## 1. System Context & Trust Boundaries

GoGreen executes polyglot systems engineering tasks, including microbenchmarks, binary analysis, and user-supplied algorithms. In Phase 5, the execution environment separates trust domains to prevent hostile or defective code from compromising the host, stealing secrets, or causing denial of service.

```
+--------------------------------------------------------------------------------+
|                             TRUST DOMAIN 1: CONTROL PLANE                      |
|                  Java 25 Spring Boot Coordinator + PostgreSQL                  |
+--------------------------------------------------------------------------------+
                                       |
                                       | Mutual TLS (mTLS)
                                       v
+--------------------------------------------------------------------------------+
|                             TRUST DOMAIN 2: WORKER HOST                        |
|                                                                                |
|  +---------------------------+             +--------------------------------+  |
|  |     Go Worker Agent       |             |   Native Core Daemon (C++23)   |  |
|  |  (Validated Workloads)    |             |      (Microbenchmarks / Labs)  |  |
|  +---------------------------+             +--------------------------------+  |
|                |                                                               |
|                | Local IPC / Socket                                            |
|                v                                                               |
|  +--------------------------------------------------------------------------+  |
|  |                  Rust Sandbox Supervisor (Privilege Separator)           |  |
|  |       (Policy Validator | Namespace Manager | cgroup v2 | Seccomp)        |  |
|  +--------------------------------------------------------------------------+  |
+--------------------------------------|-----------------------------------------+
                                       | Linux Clone / Unshare
                                       v
+--------------------------------------------------------------------------------+
|                         TRUST DOMAIN 3: ISOLATED WORKLOAD                      |
|                                                                                |
|  [Namespaces: PID, Mount, Network, IPC, UTS, User]                             |
|  [cgroups v2: memory.max, cpu.max, pids.max]                                   |
|  [Seccomp-BPF: Restrictive Syscall Filter]                                     |
|  [Landlock LSM: Filesystem Read-Only Sandboxing]                               |
|  [POSIX rlimit: RLIMIT_AS, RLIMIT_CPU, RLIMIT_CORE=0, RLIMIT_NPROC]            |
|                                                                                |
|             Untrusted Process Execution (Unprivileged UID 65534)                |
+--------------------------------------------------------------------------------+
```

---

## 2. Identified Threat Actors & Attack Vectors

| Attack Vector | Threat Scenario | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Fork Bomb (Process Exhaustion)** | Workload spawns thousands of threads/processes in an infinite loop. | Host PID exhaustion, supervisor crash, node unresponsiveness. | `cgroups v2 pids.max` (strict limit, e.g. 16 or 32) + `RLIMIT_NPROC` + `CLONE_NEWPID`. |
| **Memory Exhaustion (OOM DoS)** | Workload dynamically allocates gigabytes of RAM to trigger host OOM killer. | Host system instability, critical services killed. | `cgroups v2 memory.max` + `memory.swap.max = 0` + `RLIMIT_AS`. OOM killer triggered inside sandbox only without touching host processes. |
| **CPU Runaway / Spinlock** | Workload spins on all CPU cores indefinitely. | Starvation of host scheduler, coordinator, and native daemon. | `cgroups v2 cpu.max` (quota and period enforcement, e.g. 50,000us/100,000us) + Tokio watchdog timeout with `SIGKILL`. |
| **Filesystem Tampering / Traversal** | Workload attempts `../../etc/shadow`, overwriting `/bin`, or corrupting host files. | Credential theft, arbitrary binary trojaning, data destruction. | Mount namespace with private pivot/chroot, read-only system mounts, isolated `tmpfs` workspace, and Landlock LSM filesystem sandboxing. |
| **Network Exfiltration / C2** | Workload attempts to open TCP/UDP sockets to external botnets or intranet targets. | Data exfiltration, credential leak, lateral port scanning. | Network namespace (`CLONE_NEWNET`) with loopback-only or down state. Zero external socket connectivity. |
| **Kernel Privilege Escalation** | Workload invokes dangerous syscalls (`ptrace`, `bpf`, `mount`, `reboot`, `kexec_load`). | Host kernel exploit, container escape, root takeover. | Strict Seccomp-BPF filter blocking dangerous syscalls; `PR_SET_NO_NEW_PRIVS`; unprivileged UID mapping. |
| **Unbounded Output DoS** | Workload prints billions of lines to stdout/stderr. | Disk fill-up, out-of-memory crash in log aggregators. | Pipe reading with hard memory cap (`max_output_bytes`, default 1MB). Stream truncated with warning when limit reached. |

---

## 3. Defense-in-Depth Invariants

1. **Non-Root Execution:** Workload child process always drops privileges or operates in an unprivileged user namespace mapped to unprivileged user `nobody` (UID 65534).
2. **No Arbitrary Commands:** Supervisor accepts only approved workload types (`WORKLOAD_BENCHMARK`, `WORKLOAD_STATIC_ANALYSIS`, `WORKLOAD_CONTROLLED_TEST`). Arbitrary shell strings (e.g. `sh -c ...`) are rejected.
3. **Deterministic Cleanup:** Every spawned sandbox creates a uniquely tagged cgroup and ephemeral temporary workspace. Regardless of whether the process exits cleanly, times out, is killed by OOM, or crashes, the supervisor's cleanup hook guarantees removal of cgroups and temporary files.
4. **Honest Capability Probing:** The supervisor inspects real host kernel interfaces at boot (`/sys/fs/cgroup/cgroup.controllers`, Seccomp prctl, Landlock ABI). If an isolation primitive is unsupported by the host kernel (e.g. Landlock on older kernels), it is explicitly audited in the execution report rather than falsifying operational state.
