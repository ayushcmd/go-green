use std::collections::HashMap;
use std::time::Duration;
use sandbox_manager::config::policy::{ExecutionProfile, ExecutionRequest, WorkloadCategory};
use sandbox_manager::lifecycle::supervisor::ExecutionStatus;
use sandbox_manager::runtime::executor::SandboxRuntime;
use sandbox_manager::isolation::capabilities::HostCapabilitiesReport;
use sandbox_manager::artifacts::storage::ArtifactManager;
use sandbox_manager::telemetry::metrics::SandboxTelemetry;

#[tokio::test]
async fn test_controlled_execution_echo() {
    let temp_dir = tempfile::tempdir().expect("Failed to create tempdir");
    let runtime = SandboxRuntime::new(temp_dir.path());

    let result = runtime.execute_controlled_test("echo", vec!["gogreen-sandbox-verified".to_string()]).await
        .expect("Execution failed");

    assert_eq!(result.status, ExecutionStatus::Success);
    assert_eq!(result.exit_code, 0);
    assert!(result.stdout_summary.contains("gogreen-sandbox-verified"));
    assert!(result.artifact_manifest.is_some());

    let manifest = result.artifact_manifest.unwrap();
    assert!(!manifest.stdout_sha256.is_empty());
    assert!(!manifest.manifest_sha256.is_empty());
}

#[tokio::test]
async fn test_process_timeout_enforcement() {
    let temp_dir = tempfile::tempdir().expect("Failed to create tempdir");
    let runtime = SandboxRuntime::new(temp_dir.path());

    let mut profile = ExecutionProfile::controlled_test();
    profile.timeout_ms = 300; // 300ms timeout

    let req = ExecutionRequest {
        workload_id: "test-timeout-workload".to_string(),
        command: "sleep".to_string(),
        args: vec!["2".to_string()], // sleeps for 2s
        env_vars: HashMap::new(),
        input_payload: None,
        profile,
    };

    let result = runtime.execute(req).await.expect("Execution failed");

    assert_eq!(result.status, ExecutionStatus::TimedOut);
    assert!(result.wall_time_ms >= 300);
    assert!(result.error_message.unwrap().contains("timeout"));
}

#[test]
fn test_profile_validation_rejects_illegal_requests() {
    // 1. Prohibit arbitrary shell interpreters
    let bad_sh_req = ExecutionRequest {
        workload_id: "sh-injection".to_string(),
        command: "sh".to_string(),
        args: vec!["-c".into(), "rm -rf /".into()],
        env_vars: HashMap::new(),
        input_payload: None,
        profile: ExecutionProfile::controlled_test(),
    };
    assert!(bad_sh_req.validate().is_err());

    let bad_bash_req = ExecutionRequest {
        workload_id: "bash-injection".to_string(),
        command: "/bin/bash".to_string(),
        args: vec![],
        env_vars: HashMap::new(),
        input_payload: None,
        profile: ExecutionProfile::controlled_test(),
    };
    assert!(bad_bash_req.validate().is_err());

    // 2. Reject empty command
    let empty_cmd_req = ExecutionRequest {
        workload_id: "empty".to_string(),
        command: "".to_string(),
        args: vec![],
        env_vars: HashMap::new(),
        input_payload: None,
        profile: ExecutionProfile::controlled_test(),
    };
    assert!(empty_cmd_req.validate().is_err());

    // 3. Reject excessive memory
    let mut bad_profile = ExecutionProfile::controlled_test();
    bad_profile.max_memory_bytes = 100 * 1024 * 1024 * 1024; // 100GB
    assert!(bad_profile.validate().is_err());
}

#[test]
fn test_artifact_generation_and_hashing() {
    let temp_dir = tempfile::tempdir().expect("Failed to create tempdir");
    let mgr = ArtifactManager::new(temp_dir.path());

    let raw_stdout = b"GoGreen Artifact Test Output Stream\n";
    let raw_stderr = b"";

    let manifest = mgr.persist_execution(
        "exec-test-sha",
        "workload-sha",
        "worker-test",
        None,
        raw_stdout,
        raw_stderr,
        1024,
        Default::default(),
        0,
    ).expect("Failed to persist execution");

    assert_eq!(manifest.stdout_bytes, raw_stdout.len());
    assert!(!manifest.stdout_sha256.is_empty());
    assert!(!manifest.manifest_sha256.is_empty());

    // Read back from disk
    let read_back = mgr.read_manifest("exec-test-sha").expect("Failed to read manifest");
    assert_eq!(read_back.execution_id, "exec-test-sha");
    assert_eq!(read_back.stdout_sha256, manifest.stdout_sha256);
}

#[test]
fn test_telemetry_metrics_tracking() {
    let telemetry = SandboxTelemetry::new();
    assert_eq!(telemetry.snapshot().total_executions, 0);

    telemetry.record_start();
    assert_eq!(telemetry.snapshot().active_sandboxes, 1);

    telemetry.record_completion(150, 45, true, false, false);
    let snap = telemetry.snapshot();
    assert_eq!(snap.total_executions, 1);
    assert_eq!(snap.successful_executions, 1);
    assert_eq!(snap.active_sandboxes, 0);
    assert_eq!(snap.cumulative_wall_time_ms, 150);
    assert_eq!(snap.cumulative_cpu_time_ms, 45);

    telemetry.record_security_violation();
    assert_eq!(telemetry.snapshot().security_violations, 1);
}

#[test]
fn test_host_capabilities_probing() {
    let report = HostCapabilitiesReport::probe();
    assert!(!report.kernel_version.is_empty());
    // Report does not panic and populates real namespace probes
}
