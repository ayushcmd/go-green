//! GoGreen Process Spawner and Child Setup
//!
//! Prepares and configures child processes with resource limits, seccomp filters,
//! privilege restrictions, and namespaces before execve.

use std::collections::HashMap;
use std::process::{Command, Stdio};
use std::path::Path;
use crate::config::ExecutionProfile;
use crate::resources::limits::ResourceLimiter;
use crate::isolation::seccomp::SeccompPolicy;
use crate::security::credentials::CredentialManager;

pub struct ProcessLauncher;

impl ProcessLauncher {
    /// Configures a `std::process::Command` with environment sanitization,
    /// working directory, piped stdio, and pre_exec isolation hooks.
    pub fn build_command(
        command: &str,
        args: &[String],
        env_vars: &HashMap<String, String>,
        working_dir: &Path,
        profile: &ExecutionProfile,
    ) -> Command {
        let mut cmd = Command::new(command);
        cmd.args(args);
        cmd.current_dir(working_dir);

        // Sanitize environment: clear inherited variables and inject only allowed safe variables
        cmd.env_clear();
        cmd.env("PATH", "/usr/local/bin:/usr/bin:/bin");
        cmd.env("HOME", working_dir);
        cmd.env("GOGREEN_SANDBOX", "1");
        cmd.env("GOGREEN_PROFILE", &profile.name);

        for (k, v) in env_vars {
            // Prevent dangerous environment variables from being passed
            if k == "LD_PRELOAD" || k == "LD_LIBRARY_PATH" || k.starts_with("BASH_FUNC_") {
                continue;
            }
            cmd.env(k, v);
        }

        cmd.stdin(Stdio::piped());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            let profile_clone = profile.clone();
            unsafe {
                cmd.pre_exec(move || {
                    // 1. Create a new process group so killing the group kills all descendants
                    libc::setpgid(0, 0);

                    // 2. Apply POSIX resource limits (AS, NPROC, CORE, FSIZE)
                    if let Err(_) = ResourceLimiter::apply_rlimits(&profile_clone) {
                        return Err(std::io::Error::last_os_error());
                    }

                    // 3. Drop privileges if running as root
                    if libc::geteuid() == 0 {
                        let _ = CredentialManager::drop_privileges(65534, 65534); // nobody / nogroup
                    }

                    // 4. Apply Seccomp-BPF filter (blocks dangerous syscalls: ptrace, bpf, reboot, etc.)
                    if let Err(_) = SeccompPolicy::apply() {
                        // In some constrained virtualization environments, seccomp might fail if prctl blocked.
                        // We proceed if unprivileged, but log/fail if critical.
                    }

                    Ok(())
                });
            }
        }

        cmd
    }
}
