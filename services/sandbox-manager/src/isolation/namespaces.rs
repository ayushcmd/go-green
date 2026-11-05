use std::ffi::CString;

pub struct NamespaceConfig {
    pub new_pid: bool,
    pub new_mount: bool,
    pub new_net: bool,
    pub new_ipc: bool,
    pub new_uts: bool,
    pub hostname: String,
}

impl Default for NamespaceConfig {
    fn default() -> Self {
        Self {
            new_pid: true,
            new_mount: true,
            new_net: true,
            new_ipc: true,
            new_uts: true,
            hostname: "gogreen-sandbox".to_string(),
        }
    }
}

impl NamespaceConfig {
    /// Applies namespace isolation in the child process prior to execve.
    /// Returns true if unshare succeeded, false if unshare was unavailable.
    pub fn apply_in_child(&self) -> bool {
        let mut flags = 0;
        if self.new_pid { flags |= libc::CLONE_NEWPID; }
        if self.new_mount { flags |= libc::CLONE_NEWNS; }
        if self.new_net { flags |= libc::CLONE_NEWNET; }
        if self.new_ipc { flags |= libc::CLONE_NEWIPC; }
        if self.new_uts { flags |= libc::CLONE_NEWUTS; }

        let ret = unsafe { libc::unshare(flags) };
        if ret != 0 {
            // Unshare failed (likely insufficient privileges in container/WSL)
            return false;
        }

        // Set UTS hostname
        if self.new_uts {
            if let Ok(c_host) = CString::new(self.hostname.as_str()) {
                unsafe {
                    libc::sethostname(c_host.as_ptr(), self.hostname.len());
                }
            }
        }

        true
    }
}
