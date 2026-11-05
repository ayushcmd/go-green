//! GoGreen Runtime Executor
//!
//! Provides the primary operational interface for running sandboxed workloads,
//! maintaining in-memory execution state, history lookup, and workload dispatching.

use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::config::policy::{ExecutionProfile, ExecutionRequest};
use crate::lifecycle::supervisor::{ExecutionResult, SandboxSupervisor};
use crate::telemetry::metrics::{SandboxMetricsSnapshot, SandboxTelemetry};
use crate::isolation::capabilities::HostCapabilitiesReport;

pub struct SandboxRuntime {
    supervisor: Arc<SandboxSupervisor>,
    telemetry: Arc<SandboxTelemetry>,
    history: Arc<RwLock<Vec<ExecutionResult>>>,
    capabilities: HostCapabilitiesReport,
}

impl SandboxRuntime {
    pub fn new<P: AsRef<Path>>(artifact_dir: P) -> Self {
        let telemetry = Arc::new(SandboxTelemetry::new());
        let supervisor = Arc::new(SandboxSupervisor::new(artifact_dir, telemetry.clone()));
        let capabilities = HostCapabilitiesReport::probe();

        Self {
            supervisor,
            telemetry,
            history: Arc::new(RwLock::new(Vec::new())),
            capabilities,
        }
    }

    /// Retrieve probed host kernel isolation capabilities.
    pub fn capabilities(&self) -> HostCapabilitiesReport {
        self.capabilities.clone()
    }

    /// Retrieve live sandbox telemetry snapshot.
    pub fn metrics(&self) -> SandboxMetricsSnapshot {
        self.telemetry.snapshot()
    }

    /// Retrieve execution history (up to recent 100 executions).
    pub async fn get_history(&self) -> Vec<ExecutionResult> {
        self.history.read().await.clone()
    }

    /// Get execution result by ID.
    pub async fn get_execution(&self, execution_id: &str) -> Option<ExecutionResult> {
        let history = self.history.read().await;
        history.iter().find(|e| e.execution_id == execution_id).cloned()
    }

    /// Execute a generic validated ExecutionRequest.
    pub async fn execute(&self, request: ExecutionRequest) -> Result<ExecutionResult, String> {
        let result = self.supervisor.execute(request).await?;

        // Append to history (bounded to 100 entries)
        let mut hist = self.history.write().await;
        if hist.len() >= 100 {
            hist.remove(0);
        }
        hist.push(result.clone());

        Ok(result)
    }

    /// Helper to execute a native microbenchmark under NativeBenchmarkProfile.
    pub async fn execute_benchmark(
        &self,
        command: &str,
        args: Vec<String>,
    ) -> Result<ExecutionResult, String> {
        let req = ExecutionRequest {
            workload_id: format!("bench-{}", args.first().cloned().unwrap_or_else(|| "default".into())),
            command: command.to_string(),
            args,
            env_vars: HashMap::new(),
            input_payload: None,
            profile: ExecutionProfile::native_benchmark(),
        };
        self.execute(req).await
    }

    /// Helper to execute static analysis under StaticAnalysisProfile.
    pub async fn execute_static_analysis(
        &self,
        command: &str,
        args: Vec<String>,
        input_file: Option<Vec<u8>>,
    ) -> Result<ExecutionResult, String> {
        let req = ExecutionRequest {
            workload_id: format!("analysis-{}", args.first().cloned().unwrap_or_else(|| "target".into())),
            command: command.to_string(),
            args,
            env_vars: HashMap::new(),
            input_payload: input_file,
            profile: ExecutionProfile::static_analysis(),
        };
        self.execute(req).await
    }

    /// Helper to execute a controlled test under ControlledTestProfile.
    pub async fn execute_controlled_test(
        &self,
        command: &str,
        args: Vec<String>,
    ) -> Result<ExecutionResult, String> {
        let req = ExecutionRequest {
            workload_id: "controlled-test".to_string(),
            command: command.to_string(),
            args,
            env_vars: HashMap::new(),
            input_payload: None,
            profile: ExecutionProfile::controlled_test(),
        };
        self.execute(req).await
    }
}
