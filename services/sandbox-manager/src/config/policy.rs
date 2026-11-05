use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum WorkloadCategory {
    NativeBenchmark,
    StaticAnalysis,
    ControlledTest,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionProfile {
    pub name: String,
    pub category: WorkloadCategory,
    pub timeout_ms: u64,
    pub max_memory_bytes: u64,
    pub cpu_quota_us: u64,
    pub cpu_period_us: u64,
    pub max_pids: u32,
    pub max_output_bytes: usize,
    pub network_isolated: bool,
    pub read_only_rootfs: bool,
    pub allowed_syscalls: Vec<String>,
}

impl ExecutionProfile {
    pub fn native_benchmark() -> Self {
        Self {
            name: "NativeBenchmarkProfile".to_string(),
            category: WorkloadCategory::NativeBenchmark,
            timeout_ms: 10_000,
            max_memory_bytes: 512 * 1024 * 1024, // 512MB
            cpu_quota_us: 100_000,
            cpu_period_us: 100_000,
            max_pids: 8,
            max_output_bytes: 2 * 1024 * 1024,
            network_isolated: true,
            read_only_rootfs: true,
            allowed_syscalls: vec![
                "read".into(), "write".into(), "exit".into(), "exit_group".into(),
                "mmap".into(), "munmap".into(), "mprotect".into(), "brk".into(),
                "fstat".into(), "newfstatat".into(), "clock_gettime".into(), "nanosleep".into(),
                "futex".into(), "rt_sigaction".into(), "rt_sigprocmask".into(), "rt_sigreturn".into(),
                "getrandom".into(), "sched_yield".into(),
            ],
        }
    }

    pub fn static_analysis() -> Self {
        Self {
            name: "StaticAnalysisProfile".to_string(),
            category: WorkloadCategory::StaticAnalysis,
            timeout_ms: 5_000,
            max_memory_bytes: 256 * 1024 * 1024, // 256MB
            cpu_quota_us: 50_000,
            cpu_period_us: 100_000,
            max_pids: 4,
            max_output_bytes: 4 * 1024 * 1024,
            network_isolated: true,
            read_only_rootfs: true,
            allowed_syscalls: vec![
                "read".into(), "write".into(), "exit".into(), "exit_group".into(),
                "mmap".into(), "munmap".into(), "mprotect".into(), "brk".into(),
                "lseek".into(), "fstat".into(), "newfstatat".into(), "close".into(),
            ],
        }
    }

    pub fn controlled_test() -> Self {
        Self {
            name: "ControlledTestProfile".to_string(),
            category: WorkloadCategory::ControlledTest,
            timeout_ms: 3_000,
            max_memory_bytes: 128 * 1024 * 1024, // 128MB
            cpu_quota_us: 25_000,
            cpu_period_us: 100_000,
            max_pids: 4,
            max_output_bytes: 1024 * 1024,
            network_isolated: true,
            read_only_rootfs: true,
            allowed_syscalls: vec![
                "read".into(), "write".into(), "exit".into(), "exit_group".into(),
                "mmap".into(), "munmap".into(), "brk".into(), "fstat".into(),
            ],
        }
    }

    pub fn validate(&self) -> Result<(), String> {
        if self.timeout_ms < 50 || self.timeout_ms > 60_000 {
            return Err(format!("Invalid timeout_ms: {} (must be 50-60000ms)", self.timeout_ms));
        }
        if self.max_memory_bytes < 16 * 1024 * 1024 || self.max_memory_bytes > 4 * 1024 * 1024 * 1024 {
            return Err(format!("Invalid max_memory_bytes: {} (must be 16MB-4GB)", self.max_memory_bytes));
        }
        if self.max_pids == 0 || self.max_pids > 64 {
            return Err(format!("Invalid max_pids: {} (must be 1-64)", self.max_pids));
        }
        if self.max_output_bytes == 0 || self.max_output_bytes > 16 * 1024 * 1024 {
            return Err(format!("Invalid max_output_bytes: {} (must be 1-16MB)", self.max_output_bytes));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionRequest {
    pub workload_id: String,
    pub command: String,
    pub args: Vec<String>,
    pub env_vars: HashMap<String, String>,
    pub input_payload: Option<Vec<u8>>,
    pub profile: ExecutionProfile,
}

impl ExecutionRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.workload_id.is_empty() {
            return Err("workload_id cannot be empty".to_string());
        }
        if self.command.is_empty() {
            return Err("command cannot be empty".to_string());
        }
        // Reject shell interpreter injections
        if self.command == "sh" || self.command == "bash" || self.command == "/bin/sh" || self.command == "/bin/bash" {
            return Err("Arbitrary shell execution is forbidden in GoGreen sandbox".to_string());
        }
        self.profile.validate()?;
        Ok(())
    }
}
