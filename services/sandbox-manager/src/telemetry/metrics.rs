//! GoGreen Sandbox Telemetry & Metrics
//!
//! Tracks operational statistics, active sandbox counts, resource aggregates,
//! and security violation events in real time.

use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::Arc;
use serde::{Deserialize, Serialize};

/// Serializable snapshot of sandbox operational metrics.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxMetricsSnapshot {
    pub total_executions: u64,
    pub successful_executions: u64,
    pub failed_executions: u64,
    pub timed_out_executions: u64,
    pub oom_killed_executions: u64,
    pub security_violations: u64,
    pub active_sandboxes: usize,
    pub cumulative_wall_time_ms: u64,
    pub cumulative_cpu_time_ms: u64,
}

/// Thread-safe sandbox telemetry tracker.
#[derive(Debug, Clone, Default)]
pub struct SandboxTelemetry {
    total_executions: Arc<AtomicU64>,
    successful_executions: Arc<AtomicU64>,
    failed_executions: Arc<AtomicU64>,
    timed_out_executions: Arc<AtomicU64>,
    oom_killed_executions: Arc<AtomicU64>,
    security_violations: Arc<AtomicU64>,
    active_sandboxes: Arc<AtomicUsize>,
    cumulative_wall_time_ms: Arc<AtomicU64>,
    cumulative_cpu_time_ms: Arc<AtomicU64>,
}

impl SandboxTelemetry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn record_start(&self) {
        self.total_executions.fetch_add(1, Ordering::Relaxed);
        self.active_sandboxes.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_completion(&self, wall_time_ms: u64, cpu_time_ms: u64, success: bool, timed_out: bool, oom_killed: bool) {
        self.active_sandboxes.fetch_sub(1, Ordering::Relaxed);
        self.cumulative_wall_time_ms.fetch_add(wall_time_ms, Ordering::Relaxed);
        self.cumulative_cpu_time_ms.fetch_add(cpu_time_ms, Ordering::Relaxed);

        if timed_out {
            self.timed_out_executions.fetch_add(1, Ordering::Relaxed);
        } else if oom_killed {
            self.oom_killed_executions.fetch_add(1, Ordering::Relaxed);
        } else if success {
            self.successful_executions.fetch_add(1, Ordering::Relaxed);
        } else {
            self.failed_executions.fetch_add(1, Ordering::Relaxed);
        }
    }

    pub fn record_security_violation(&self) {
        self.security_violations.fetch_add(1, Ordering::Relaxed);
    }

    pub fn snapshot(&self) -> SandboxMetricsSnapshot {
        SandboxMetricsSnapshot {
            total_executions: self.total_executions.load(Ordering::Relaxed),
            successful_executions: self.successful_executions.load(Ordering::Relaxed),
            failed_executions: self.failed_executions.load(Ordering::Relaxed),
            timed_out_executions: self.timed_out_executions.load(Ordering::Relaxed),
            oom_killed_executions: self.oom_killed_executions.load(Ordering::Relaxed),
            security_violations: self.security_violations.load(Ordering::Relaxed),
            active_sandboxes: self.active_sandboxes.load(Ordering::Relaxed),
            cumulative_wall_time_ms: self.cumulative_wall_time_ms.load(Ordering::Relaxed),
            cumulative_cpu_time_ms: self.cumulative_cpu_time_ms.load(Ordering::Relaxed),
        }
    }
}
