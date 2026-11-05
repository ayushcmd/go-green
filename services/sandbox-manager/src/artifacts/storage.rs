//! GoGreen Sandbox Artifact Management
//!
//! Handles bounded stdout/stderr capture, disk persistence, cryptographic SHA-256
//! hashing, and execution manifest generation. Raw output streams are never stored
//! in databases or control plane memory; only references and digests are propagated.

use std::fs::{self, File};
use std::io::{Write, Read};
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use crate::resources::ResourceUsage;

/// Execution artifact manifest summarizing execution outputs and integrity digests.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionArtifactManifest {
    pub execution_id: String,
    pub workload_name: String,
    pub worker_id: String,
    pub created_at: String,
    pub stdout_path: String,
    pub stdout_bytes: usize,
    pub stdout_sha256: String,
    pub stdout_truncated: bool,
    pub stderr_path: String,
    pub stderr_bytes: usize,
    pub stderr_sha256: String,
    pub stderr_truncated: bool,
    pub binary_sha256: Option<String>,
    pub resource_usage: ResourceUsage,
    pub exit_code: i32,
    pub manifest_sha256: String,
}

/// Artifact manager managing storage on disk.
#[derive(Debug, Clone)]
pub struct ArtifactManager {
    base_dir: PathBuf,
}

impl ArtifactManager {
    /// Create a new ArtifactManager targeting the specified base directory.
    pub fn new<P: AsRef<Path>>(base_dir: P) -> Self {
        Self {
            base_dir: base_dir.as_ref().to_path_buf(),
        }
    }

    /// Compute SHA-256 digest of arbitrary bytes.
    pub fn compute_sha256(bytes: &[u8]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(bytes);
        hex::encode(hasher.finalize())
    }

    /// Compute SHA-256 digest of a file on disk if it exists.
    pub fn compute_file_sha256<P: AsRef<Path>>(path: P) -> Option<String> {
        let mut file = File::open(path).ok()?;
        let mut hasher = Sha256::new();
        let mut buffer = [0u8; 8192];
        while let Ok(n) = file.read(&mut buffer) {
            if n == 0 {
                break;
            }
            hasher.update(&buffer[..n]);
        }
        Some(hex::encode(hasher.finalize()))
    }

    /// Store stdout and stderr buffers to disk, enforcing max_output_bytes truncation,
    /// compute digests, and write manifest.json.
    pub fn persist_execution(
        &self,
        execution_id: &str,
        workload_name: &str,
        worker_id: &str,
        binary_path: Option<&str>,
        stdout_raw: &[u8],
        stderr_raw: &[u8],
        max_output_bytes: usize,
        resource_usage: ResourceUsage,
        exit_code: i32,
    ) -> Result<ExecutionArtifactManifest, String> {
        let execution_dir = self.base_dir.join(execution_id);
        fs::create_dir_all(&execution_dir)
            .map_err(|e| format!("Failed to create execution artifact dir: {}", e))?;

        // Process stdout with bounds
        let (stdout_bounded, stdout_truncated) = if stdout_raw.len() > max_output_bytes {
            let mut bounded = stdout_raw[..max_output_bytes].to_vec();
            let truncation_msg = format!("\n[GOGREEN WARN: stdout truncated at {} bytes]\n", max_output_bytes);
            bounded.extend_from_slice(truncation_msg.as_bytes());
            (bounded, true)
        } else {
            (stdout_raw.to_vec(), false)
        };

        // Process stderr with bounds
        let (stderr_bounded, stderr_truncated) = if stderr_raw.len() > max_output_bytes {
            let mut bounded = stderr_raw[..max_output_bytes].to_vec();
            let truncation_msg = format!("\n[GOGREEN WARN: stderr truncated at {} bytes]\n", max_output_bytes);
            bounded.extend_from_slice(truncation_msg.as_bytes());
            (bounded, true)
        } else {
            (stderr_raw.to_vec(), false)
        };

        // Hashes
        let stdout_sha256 = Self::compute_sha256(&stdout_bounded);
        let stderr_sha256 = Self::compute_sha256(&stderr_bounded);
        let binary_sha256 = binary_path.and_then(|p| Self::compute_file_sha256(p));

        // Write stdout
        let stdout_file_path = execution_dir.join("stdout.log");
        let mut stdout_file = File::create(&stdout_file_path)
            .map_err(|e| format!("Failed to create stdout.log: {}", e))?;
        stdout_file.write_all(&stdout_bounded)
            .map_err(|e| format!("Failed to write stdout.log: {}", e))?;

        // Write stderr
        let stderr_file_path = execution_dir.join("stderr.log");
        let mut stderr_file = File::create(&stderr_file_path)
            .map_err(|e| format!("Failed to create stderr.log: {}", e))?;
        stderr_file.write_all(&stderr_bounded)
            .map_err(|e| format!("Failed to write stderr.log: {}", e))?;

        let created_at = chrono::Utc::now().to_rfc3339();

        let mut manifest = ExecutionArtifactManifest {
            execution_id: execution_id.to_string(),
            workload_name: workload_name.to_string(),
            worker_id: worker_id.to_string(),
            created_at,
            stdout_path: stdout_file_path.to_string_lossy().to_string(),
            stdout_bytes: stdout_bounded.len(),
            stdout_sha256,
            stdout_truncated,
            stderr_path: stderr_file_path.to_string_lossy().to_string(),
            stderr_bytes: stderr_bounded.len(),
            stderr_sha256,
            stderr_truncated,
            binary_sha256,
            resource_usage,
            exit_code,
            manifest_sha256: String::new(),
        };

        // Manifest JSON and hash
        let manifest_bytes = serde_json::to_vec_pretty(&manifest)
            .map_err(|e| format!("Failed to serialize manifest: {}", e))?;
        manifest.manifest_sha256 = Self::compute_sha256(&manifest_bytes);

        let manifest_file_path = execution_dir.join("manifest.json");
        let mut manifest_file = File::create(&manifest_file_path)
            .map_err(|e| format!("Failed to create manifest.json: {}", e))?;
        let final_manifest_bytes = serde_json::to_vec_pretty(&manifest)
            .map_err(|e| format!("Failed to serialize final manifest: {}", e))?;
        manifest_file.write_all(&final_manifest_bytes)
            .map_err(|e| format!("Failed to write manifest.json: {}", e))?;

        Ok(manifest)
    }

    /// Read execution manifest if it exists.
    pub fn read_manifest(&self, execution_id: &str) -> Option<ExecutionArtifactManifest> {
        let manifest_file_path = self.base_dir.join(execution_id).join("manifest.json");
        let content = fs::read_to_string(manifest_file_path).ok()?;
        serde_json::from_str(&content).ok()
    }
}
