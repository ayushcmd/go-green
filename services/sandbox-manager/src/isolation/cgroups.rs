use crate::config::ExecutionProfile;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct CgroupStats {
    pub current_memory_bytes: u64,
    pub peak_memory_bytes: u64,
    pub cpu_usage_usec: u64,
    pub current_pids: u32,
}

pub struct CgroupHandle {
    pub path: PathBuf,
    pub active: bool,
}

impl CgroupHandle {
    pub fn create(id: &str, profile: &ExecutionProfile) -> Result<Self, String> {
        let base_cgroup = Path::new("/sys/fs/cgroup");
        if !base_cgroup.exists() {
            return Ok(Self {
                path: PathBuf::new(),
                active: false,
            });
        }

        let gogreen_dir = base_cgroup.join("gogreen");
        let sandbox_dir = gogreen_dir.join(format!("sandbox_{}", id));

        // Attempt creation; if permission denied (e.g. unprivileged user), report and return inactive handle
        if let Err(e) = fs::create_dir_all(&sandbox_dir) {
            return Ok(Self {
                path: PathBuf::new(),
                active: false,
            });
        }

        // 1. Write memory limits
        let _ = fs::write(sandbox_dir.join("memory.max"), profile.max_memory_bytes.to_string());
        let _ = fs::write(sandbox_dir.join("memory.swap.max"), "0");

        // 2. Write CPU quota and period
        let cpu_limit = format!("{} {}", profile.cpu_quota_us, profile.cpu_period_us);
        let _ = fs::write(sandbox_dir.join("cpu.max"), cpu_limit);

        // 3. Write PIDs limit
        let _ = fs::write(sandbox_dir.join("pids.max"), profile.max_pids.to_string());

        Ok(Self {
            path: sandbox_dir,
            active: true,
        })
    }

    pub fn attach_pid(&self, pid: u32) -> Result<(), String> {
        if !self.active || self.path.as_os_str().is_empty() {
            return Ok(());
        }
        let procs_path = self.path.join("cgroup.procs");
        fs::write(&procs_path, pid.to_string())
            .map_err(|e| format!("Failed to attach PID {} to cgroup: {}", pid, e))
    }

    pub fn read_stats(&self) -> CgroupStats {
        if !self.active || self.path.as_os_str().is_empty() {
            return CgroupStats {
                current_memory_bytes: 0,
                peak_memory_bytes: 0,
                cpu_usage_usec: 0,
                current_pids: 0,
            };
        }

        let cur_mem = fs::read_to_string(self.path.join("memory.current"))
            .ok()
            .and_then(|s| s.trim().parse::<u64>().ok())
            .unwrap_or(0);

        let peak_mem = fs::read_to_string(self.path.join("memory.peak"))
            .ok()
            .and_then(|s| s.trim().parse::<u64>().ok())
            .unwrap_or(cur_mem);

        let cur_pids = fs::read_to_string(self.path.join("pids.current"))
            .ok()
            .and_then(|s| s.trim().parse::<u32>().ok())
            .unwrap_or(0);

        let mut cpu_usec = 0;
        if let Ok(content) = fs::read_to_string(self.path.join("cpu.stat")) {
            for line in content.lines() {
                if let Some(val) = line.strip_prefix("usage_usec ") {
                    cpu_usec = val.trim().parse::<u64>().unwrap_or(0);
                    break;
                }
            }
        }

        CgroupStats {
            current_memory_bytes: cur_mem,
            peak_memory_bytes: peak_mem,
            cpu_usage_usec: cpu_usec,
            current_pids: cur_pids,
        }
    }

    pub fn cleanup(&mut self) {
        if self.active && !self.path.as_os_str().is_empty() && self.path.exists() {
            let _ = fs::remove_dir(&self.path);
            self.active = false;
        }
    }
}

impl Drop for CgroupHandle {
    fn drop(&mut self) {
        self.cleanup();
    }
}
