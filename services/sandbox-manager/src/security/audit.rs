use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SecurityEventSeverity {
    Info,
    Warning,
    Alert,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityAuditEvent {
    pub timestamp: DateTime<Utc>,
    pub execution_id: String,
    pub workload_id: String,
    pub severity: SecurityEventSeverity,
    pub event_type: String,
    pub details: String,
    pub syscall_name: Option<String>,
}

impl SecurityAuditEvent {
    pub fn new(
        execution_id: &str,
        workload_id: &str,
        severity: SecurityEventSeverity,
        event_type: &str,
        details: &str,
    ) -> Self {
        Self {
            timestamp: Utc::now(),
            execution_id: execution_id.to_string(),
            workload_id: workload_id.to_string(),
            severity,
            event_type: event_type.to_string(),
            details: details.to_string(),
            syscall_name: None,
        }
    }

    pub fn with_syscall(mut self, syscall: &str) -> Self {
        self.syscall_name = Some(syscall.to_string());
        self
    }
}
