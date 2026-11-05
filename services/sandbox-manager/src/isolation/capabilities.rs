use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HostCapabilitiesReport {
    pub cgroups_v2_available: bool,
    pub cgroup_controllers: Vec<String>,
    pub pid_namespace: bool,
    pub mount_namespace: bool,
    pub network_namespace: bool,
    pub ipc_namespace: bool,
    pub uts_namespace: bool,
    pub user_namespace: bool,
    pub seccomp_available: bool,
    pub landlock_available: bool,
    pub unprivileged_userns_enabled: bool,
    pub kernel_version: String,
}

impl HostCapabilitiesReport {
    pub fn probe() -> Self {
        let cgroups_v2 = Path::new("/sys/fs/cgroup/cgroup.controllers").exists();
        let mut controllers = Vec::new();
        if cgroups_v2 {
            if let Ok(content) = fs::read_to_string("/sys/fs/cgroup/cgroup.controllers") {
                controllers = content.split_whitespace().map(|s| s.to_string()).collect();
            }
        }

        let pid_ns = Path::new("/proc/self/ns/pid").exists();
        let mnt_ns = Path::new("/proc/self/ns/mnt").exists();
        let net_ns = Path::new("/proc/self/ns/net").exists();
        let ipc_ns = Path::new("/proc/self/ns/ipc").exists();
        let uts_ns = Path::new("/proc/self/ns/uts").exists();
        let user_ns = Path::new("/proc/self/ns/user").exists();

        // Check unprivileged user namespaces
        let unprivileged_userns = fs::read_to_string("/proc/sys/kernel/unprivileged_userns_clone")
            .map(|s| s.trim() == "1")
            .unwrap_or(user_ns);

        // Check Seccomp support
        let seccomp_available = Path::new("/proc/sys/kernel/seccomp").exists() || unsafe {
            libc::prctl(libc::PR_GET_SECCOMP, 0, 0, 0, 0) >= 0 || *libc::__errno_location() != libc::EINVAL
        };

        // Check Landlock
        let landlock_available = fs::read_to_string("/sys/kernel/security/lsm")
            .map(|s| s.contains("landlock"))
            .unwrap_or(false);

        // Read kernel version from /proc/version
        let kernel_version = fs::read_to_string("/proc/version")
            .map(|v| v.lines().next().unwrap_or("unknown").to_string())
            .unwrap_or_else(|_| "unknown".to_string());

        Self {
            cgroups_v2_available: cgroups_v2,
            cgroup_controllers: controllers,
            pid_namespace: pid_ns,
            mount_namespace: mnt_ns,
            network_namespace: net_ns,
            ipc_namespace: ipc_ns,
            uts_namespace: uts_ns,
            user_namespace: user_ns,
            seccomp_available,
            landlock_available,
            unprivileged_userns_enabled: unprivileged_userns,
            kernel_version,
        }
    }
}
