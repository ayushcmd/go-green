//! GoGreen Sandbox Execution Supervisor
//!
//! Orchestrates the complete execution lifecycle: isolation initialization,
//! process spawning, watchdog timeout monitoring, asynchronous IO capture,
//! resource accounting, artifact generation, and guaranteed resource cleanup.

use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Instant;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::artifacts::storage::{ArtifactManager, ExecutionArtifactManifest};
use crate::config::policy::ExecutionRequest;
use crate::isolation::cgroups::CgroupHandle;
use crate::lifecycle::process::ProcessLauncher;
use crate::resources::accounting::ResourceUsage;
use crate::telemetry::metrics::SandboxTelemetry;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ExecutionStatus {
    Pending,
    Running,
    Success,
    Failed,
    TimedOut,
    OomKilled,
    SecurityViolation,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub execution_id: String,
    pub workload_id: String,
    pub status: ExecutionStatus,
    pub exit_code: i32,
    pub wall_time_ms: u64,
    pub cpu_time_ms: u64,
    pub peak_rss_bytes: u64,
    pub stdout_truncated: bool,
    pub stderr_truncated: bool,
    pub stdout_summary: String,
    pub stderr_summary: String,
    pub artifact_manifest: Option<ExecutionArtifactManifest>,
    pub error_message: Option<String>,
}

pub struct SandboxSupervisor {
    base_artifact_dir: PathBuf,
    telemetry: Arc<SandboxTelemetry>,
    artifact_manager: ArtifactManager,
}

impl SandboxSupervisor {
    pub fn new<P: AsRef<Path>>(base_artifact_dir: P, telemetry: Arc<SandboxTelemetry>) -> Self {
        let base_dir = base_artifact_dir.as_ref().to_path_buf();
        let artifact_manager = ArtifactManager::new(&base_dir);

        Self {
            base_artifact_dir: base_dir,
            telemetry,
            artifact_manager,
        }
    }

    /// Supervise and execute an ExecutionRequest inside the isolated sandbox.
    pub async fn execute(&self, request: ExecutionRequest) -> Result<ExecutionResult, String> {
        request.validate()?;

        let execution_id = format!("exec-{}", Uuid::new_v4().simple());
        let start_time = Instant::now();

        self.telemetry.record_start();

        // 1. Setup isolated temporary execution workspace
        let temp_dir = std::env::temp_dir().join(format!("gogreen-sandbox-{}", execution_id));
        fs::create_dir_all(&temp_dir)
            .map_err(|e| format!("Failed to create temporary sandbox workspace: {}", e))?;

        // Write input payload if provided
        if let Some(payload) = &request.input_payload {
            let input_file = temp_dir.join("input.dat");
            let _ = fs::write(input_file, payload);
        }

        // 2. Configure cgroups v2 if available
        let cgroup_handle = CgroupHandle::create(&execution_id, &request.profile).ok();

        // 3. Build Command
        let mut cmd = ProcessLauncher::build_command(
            &request.command,
            &request.args,
            &request.env_vars,
            &temp_dir,
            &request.profile,
        );

        // 4. Spawn child process
        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                let _ = fs::remove_dir_all(&temp_dir);
                if let Some(mut cg) = cgroup_handle {
                    cg.cleanup();
                }
                self.telemetry.record_completion(0, 0, false, false, false);
                return Ok(ExecutionResult {
                    execution_id,
                    workload_id: request.workload_id,
                    status: ExecutionStatus::Failed,
                    exit_code: -1,
                    wall_time_ms: 0,
                    cpu_time_ms: 0,
                    peak_rss_bytes: 0,
                    stdout_truncated: false,
                    stderr_truncated: false,
                    stdout_summary: String::new(),
                    stderr_summary: String::new(),
                    artifact_manifest: None,
                    error_message: Some(format!("Failed to spawn process: {}", e)),
                });
            }
        };

        let child_pid = child.id() as i32;

        // Attach to cgroup
        if let Some(ref cg) = cgroup_handle {
            let _ = cg.attach_pid(child_pid as u32);
        }

        // Piped streams
        let stdout_pipe = child.stdout.take();
        let stderr_pipe = child.stderr.take();

        // Read stdout and stderr in background threads
        let stdout_handle = std::thread::spawn(move || {
            let mut buf = Vec::new();
            if let Some(mut stream) = stdout_pipe {
                let _ = stream.read_to_end(&mut buf);
            }
            buf
        });

        let stderr_handle = std::thread::spawn(move || {
            let mut buf = Vec::new();
            if let Some(mut stream) = stderr_pipe {
                let _ = stream.read_to_end(&mut buf);
            }
            buf
        });

        // 5. Watchdog timeout monitoring
        let timeout_duration = std::time::Duration::from_millis(request.profile.timeout_ms);
        let check_interval = std::time::Duration::from_millis(50);
        let mut timed_out = false;
        let mut oom_detected = false;

        let exit_status = loop {
            match child.try_wait() {
                Ok(Some(status)) => break Ok(status),
                Ok(None) => {
                    if start_time.elapsed() >= timeout_duration {
                        timed_out = true;
                        // Terminate process group: SIGTERM then SIGKILL
                        #[cfg(unix)]
                        unsafe {
                            libc::kill(-child_pid, libc::SIGTERM);
                        }
                        tokio::time::sleep(std::time::Duration::from_millis(300)).await;
                        match child.try_wait() {
                            Ok(Some(status)) => break Ok(status),
                            _ => {
                                #[cfg(unix)]
                                unsafe {
                                    libc::kill(-child_pid, libc::SIGKILL);
                                }
                                break child.wait();
                            }
                        }
                    }
                    tokio::time::sleep(check_interval).await;
                }
                Err(e) => break Err(e),
            }
        };

        let wall_time_ms = start_time.elapsed().as_millis() as u64;

        // Join IO streams
        let stdout_raw = stdout_handle.join().unwrap_or_default();
        let stderr_raw = stderr_handle.join().unwrap_or_default();

        // Check cgroup stats before cleanup
        let cgroup_stats = cgroup_handle.as_ref().map(|cg| cg.read_stats());

        if let Some(ref stats) = cgroup_stats {
            if stats.current_memory_bytes >= request.profile.max_memory_bytes {
                oom_detected = true;
            }
        }

        // Cleanup cgroup and temp directory
        if let Some(mut cg) = cgroup_handle {
            cg.cleanup();
        }
        let _ = fs::remove_dir_all(&temp_dir);

        // Determine exit code and status
        let (exit_code, status) = match exit_status {
            Ok(status) => {
                let code = status.code().unwrap_or_else(|| {
                    #[cfg(unix)]
                    {
                        use std::os::unix::process::ExitStatusExt;
                        status.signal().map(|s| -s).unwrap_or(-1)
                    }
                    #[cfg(not(unix))]
                    -1
                });

                if timed_out {
                    (code, ExecutionStatus::TimedOut)
                } else if oom_detected {
                    (code, ExecutionStatus::OomKilled)
                } else if code == 0 {
                    (code, ExecutionStatus::Success)
                } else {
                    (code, ExecutionStatus::Failed)
                }
            }
            Err(_) => (-1, ExecutionStatus::Failed),
        };

        // Capture resource usage
        let mut resource_usage = ResourceUsage::capture_children(wall_time_ms as f64);
        if let Some(stats) = cgroup_stats {
            if stats.peak_memory_bytes > resource_usage.peak_rss_bytes {
                resource_usage.peak_rss_bytes = stats.peak_memory_bytes;
            }
        }

        // 6. Persist execution artifacts and hashes
        let manifest = match self.artifact_manager.persist_execution(
            &execution_id,
            &request.workload_id,
            "worker-local",
            Some(&request.command),
            &stdout_raw,
            &stderr_raw,
            request.profile.max_output_bytes,
            resource_usage.clone(),
            exit_code,
        ) {
            Ok(m) => Some(m),
            Err(e) => {
                eprintln!("[GOGREEN WARN] Failed to persist execution manifest: {}", e);
                None
            }
        };

        let cpu_time_ms = (resource_usage.user_time_ms + resource_usage.system_time_ms) as u64;

        // Telemetry update
        self.telemetry.record_completion(
            wall_time_ms,
            cpu_time_ms,
            status == ExecutionStatus::Success,
            status == ExecutionStatus::TimedOut,
            status == ExecutionStatus::OomKilled,
        );

        // Summaries
        let stdout_summary = String::from_utf8_lossy(&stdout_raw[..std::cmp::min(stdout_raw.len(), 512)]).to_string();
        let stderr_summary = String::from_utf8_lossy(&stderr_raw[..std::cmp::min(stderr_raw.len(), 512)]).to_string();

        Ok(ExecutionResult {
            execution_id,
            workload_id: request.workload_id,
            status,
            exit_code,
            wall_time_ms,
            cpu_time_ms,
            peak_rss_bytes: resource_usage.peak_rss_bytes,
            stdout_truncated: manifest.as_ref().map(|m| m.stdout_truncated).unwrap_or(false),
            stderr_truncated: manifest.as_ref().map(|m| m.stderr_truncated).unwrap_or(false),
            stdout_summary,
            stderr_summary,
            artifact_manifest: manifest,
            error_message: if status == ExecutionStatus::TimedOut {
                Some(format!("Execution exceeded timeout of {}ms", request.profile.timeout_ms))
            } else if status == ExecutionStatus::OomKilled {
                Some("Execution killed due to memory limit violation (OOM)".to_string())
            } else {
                None
            },
        })
    }
}
