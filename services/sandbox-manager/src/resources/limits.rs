use crate::config::ExecutionProfile;

pub struct ResourceLimiter;

impl ResourceLimiter {
    /// Applies POSIX resource limits (`rlimit`) to the calling process prior to exec.
    pub fn apply_rlimits(profile: &ExecutionProfile) -> Result<(), String> {
        unsafe {
            // 1. Prohibit core dumps to prevent disk exhaustion and memory leaks
            let no_core = libc::rlimit {
                rlim_cur: 0,
                rlim_max: 0,
            };
            if libc::setrlimit(libc::RLIMIT_CORE, &no_core) != 0 {
                return Err("Failed to set RLIMIT_CORE to 0".to_string());
            }

            // 2. Virtual memory limit (RLIMIT_AS)
            let mem_limit = libc::rlimit {
                rlim_cur: profile.max_memory_bytes,
                rlim_max: profile.max_memory_bytes,
            };
            libc::setrlimit(libc::RLIMIT_AS, &mem_limit);

            // 3. Maximum process/thread count (RLIMIT_NPROC)
            let nproc_limit = libc::rlimit {
                rlim_cur: profile.max_pids as libc::rlim_t,
                rlim_max: profile.max_pids as libc::rlim_t,
            };
            libc::setrlimit(libc::RLIMIT_NPROC, &nproc_limit);

            // 4. Maximum file size output (RLIMIT_FSIZE)
            let fsize_limit = libc::rlimit {
                rlim_cur: (profile.max_output_bytes * 2) as libc::rlim_t,
                rlim_max: (profile.max_output_bytes * 2) as libc::rlim_t,
            };
            libc::setrlimit(libc::RLIMIT_FSIZE, &fsize_limit);
        }
        Ok(())
    }
}
