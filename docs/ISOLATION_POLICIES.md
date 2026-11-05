# GoGreen Sandbox Isolation Policies

## 1. Predefined Execution Profiles

GoGreen defines three standardized, hardened profiles tailored for low-level systems engineering:

### 1.1 `NativeBenchmarkProfile`
- **Purpose:** Secure execution of C++23 / NASM assembly benchmark kernels.
- **CPU Quota:** 100% of single core (100,000us / 100,000us).
- **Memory Cap:** 512 MiB physical RAM (`memory.max`), zero swap (`memory.swap.max = 0`).
- **PIDs Cap:** 8 (prevents thread floods).
- **Timeout:** 10,000 ms.
- **Network:** Strictly isolated (`CLONE_NEWNET`, no interfaces up).
- **Filesystem:** Read-only system root (`/`), private memory-backed `tmpfs` workspace (64MB).
- **Syscall Policy:** Compute-intensive allowlist (memory allocation, timing, futex, signal handling).

### 1.2 `StaticAnalysisProfile`
- **Purpose:** Execution of binary extractors and Capstone disassemblers on untrusted specimens.
- **CPU Quota:** 50% of single core (50,000us / 100,000us).
- **Memory Cap:** 256 MiB physical RAM, zero swap.
- **PIDs Cap:** 4.
- **Timeout:** 5,000 ms.
- **Network:** Strictly isolated (`CLONE_NEWNET`).
- **Filesystem:** Read-only system root, read-only input binary payload.
- **Syscall Policy:** Read-only execution policy (prohibits file writes outside isolated stdout).

### 1.3 `ControlledTestProfile`
- **Purpose:** Executing student/laboratory unit tests or user-submitted algorithm routines.
- **CPU Quota:** 25% of single core (25,000us / 100,000us).
- **Memory Cap:** 128 MiB physical RAM, zero swap.
- **PIDs Cap:** 4.
- **Timeout:** 3,000 ms.
- **Network:** Strictly isolated (`CLONE_NEWNET`).
- **Filesystem:** Read-only system root, private isolated `tmpfs` workspace.
- **Syscall Policy:** Minimal compute allowlist.

---

## 2. Syscall Allowlist and Blocklist Specification

### Allowed Syscalls (Compute & Memory Management)
- `read`, `write`, `close`, `lseek`, `fstat`, `newfstatat`
- `mmap`, `munmap`, `mprotect`, `brk`, `madvise`
- `rt_sigaction`, `rt_sigprocmask`, `rt_sigreturn`
- `clock_gettime`, `clock_getres`, `nanosleep`
- `getrandom`, `getpid`, `gettid`, `getuid`, `getgid`
- `futex`, `exit`, `exit_group`

### Explicitly Trapped / Blocked Syscalls
- **Process & Kernel Tampering:** `ptrace`, `bpf`, `kexec_load`, `kexec_file_load`, `process_vm_readv`, `process_vm_writev`
- **Privilege & System Management:** `reboot`, `settimeofday`, `clock_settime`, `init_module`, `finit_module`, `delete_module`, `syslog`
- **Namespace & Mount Manipulation:** `mount`, `umount2`, `pivot_root`, `chroot` (post-setup), `setns`
- **Network Sockets:** `socket`, `bind`, `connect`, `listen`, `accept`, `sendto`, `recvfrom` (when network is isolated)
- **Arbitrary Execution Spawning:** `execve`, `execveat` (blocked after initial target launch)
