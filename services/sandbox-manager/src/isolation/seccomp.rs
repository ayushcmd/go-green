// BPF opcodes and constants
const BPF_LD: u16 = 0x00;
const BPF_W: u16 = 0x00;
const BPF_ABS: u16 = 0x20;
const BPF_JMP: u16 = 0x05;
const BPF_JEQ: u16 = 0x10;
const BPF_K: u16 = 0x00;
const BPF_RET: u16 = 0x06;

const SECCOMP_RET_ALLOW: u32 = 0x7fff0000;
const SECCOMP_RET_ERRNO: u32 = 0x00050000;
const SECCOMP_RET_KILL_PROCESS: u32 = 0x80000000;

const AUDIT_ARCH_X86_64: u32 = 0xc000003e;

// Linux x86-64 syscall numbers for prohibited operations
const SYS_PTRACE: u32 = 101;
const SYS_BPF: u32 = 321;
const SYS_REBOOT: u32 = 169;
const SYS_INIT_MODULE: u32 = 175;
const SYS_DELETE_MODULE: u32 = 176;
const SYS_KEXEC_LOAD: u32 = 246;
const SYS_PIVOT_ROOT: u32 = 155;

#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct SockFilter {
    pub code: u16,
    pub jt: u8,
    pub jf: u8,
    pub k: u32,
}

#[repr(C)]
#[derive(Debug)]
pub struct SockFprog {
    pub len: u16,
    pub filter: *const SockFilter,
}

pub struct SeccompPolicy;

impl SeccompPolicy {
    /// Applies strict BPF syscall filter to the calling process.
    /// Blocks ptrace, bpf, reboot, kernel module, and kexec syscalls with EPERM.
    pub fn apply() -> Result<(), String> {
        // 1. Enforce PR_SET_NO_NEW_PRIVS (mandatory before seccomp filter)
        let ret = unsafe { libc::prctl(libc::PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) };
        if ret != 0 {
            return Err("Failed to set PR_SET_NO_NEW_PRIVS".to_string());
        }

        // 2. Build BPF filter instruction list
        let mut filter: Vec<SockFilter> = Vec::new();

        // [0] Load architecture: [offsetof(seccomp_data, arch)]
        filter.push(SockFilter {
            code: BPF_LD | BPF_W | BPF_ABS,
            jt: 0, jf: 0,
            k: 4, // arch offset in seccomp_data
        });

        // [1] Check x86-64: if arch == AUDIT_ARCH_X86_64 jump 1 (continue), else jump 0 (kill)
        filter.push(SockFilter {
            code: BPF_JMP | BPF_JEQ | BPF_K,
            jt: 1, jf: 0,
            k: AUDIT_ARCH_X86_64,
        });

        // [2] Kill if architecture mismatch
        filter.push(SockFilter {
            code: BPF_RET | BPF_K,
            jt: 0, jf: 0,
            k: SECCOMP_RET_KILL_PROCESS,
        });

        // [3] Load syscall number: [offsetof(seccomp_data, nr)]
        filter.push(SockFilter {
            code: BPF_LD | BPF_W | BPF_ABS,
            jt: 0, jf: 0,
            k: 0, // nr offset in seccomp_data
        });

        // Blocklist definitions: (syscall_nr, error_code)
        let blocked = [
            SYS_PTRACE,
            SYS_BPF,
            SYS_REBOOT,
            SYS_INIT_MODULE,
            SYS_DELETE_MODULE,
            SYS_KEXEC_LOAD,
            SYS_PIVOT_ROOT,
        ];

        for &sys in &blocked {
            // If syscall matches, jump to deny block, else continue to next check
            filter.push(SockFilter {
                code: BPF_JMP | BPF_JEQ | BPF_K,
                jt: 0, jf: 1,
                k: sys,
            });
            // Return EPERM (1)
            filter.push(SockFilter {
                code: BPF_RET | BPF_K,
                jt: 0, jf: 0,
                k: SECCOMP_RET_ERRNO | (libc::EPERM as u32),
            });
        }

        // Default: Allow
        filter.push(SockFilter {
            code: BPF_RET | BPF_K,
            jt: 0, jf: 0,
            k: SECCOMP_RET_ALLOW,
        });

        let prog = SockFprog {
            len: filter.len() as u16,
            filter: filter.as_ptr(),
        };

        let ret = unsafe {
            libc::prctl(
                libc::PR_SET_SECCOMP,
                libc::SECCOMP_MODE_FILTER,
                &prog as *const SockFprog as usize,
                0,
                0,
            )
        };

        if ret != 0 {
            return Err("Failed to install Seccomp-BPF filter via prctl".to_string());
        }

        Ok(())
    }
}
