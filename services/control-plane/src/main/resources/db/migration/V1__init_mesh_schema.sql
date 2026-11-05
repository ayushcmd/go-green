-- GoGreen Distributed Mesh Database Schema Migration V1
-- Supports PostgreSQL and H2

CREATE TABLE IF NOT EXISTS mesh_workers (
    worker_id VARCHAR(64) PRIMARY KEY,
    hostname VARCHAR(128),
    operating_system VARCHAR(64),
    architecture VARCHAR(32),
    cpu_vendor VARCHAR(64),
    cpu_model VARCHAR(128),
    physical_cores INT,
    logical_cores INT,
    supported_instruction_sets VARCHAR(512),
    memory_total_bytes BIGINT,
    native_engine_version VARCHAR(32),
    worker_version VARCHAR(32),
    protocol_version VARCHAR(32),
    assigned_partition VARCHAR(64),
    status VARCHAR(32) NOT NULL,
    registered_at TIMESTAMP NOT NULL,
    last_heartbeat_at TIMESTAMP,
    last_heartbeat_sequence BIGINT,
    cpu_usage_percent DOUBLE PRECISION,
    memory_used_bytes BIGINT,
    active_jobs_count INT,
    native_daemon_status VARCHAR(32),
    uptime_seconds BIGINT
);

CREATE TABLE IF NOT EXISTS mesh_worker_sessions (
    session_id VARCHAR(64) PRIMARY KEY,
    worker_id VARCHAR(64) NOT NULL,
    connected_at TIMESTAMP NOT NULL,
    disconnected_at TIMESTAMP,
    disconnect_reason VARCHAR(256),
    heartbeats_received BIGINT DEFAULT 0,
    jobs_completed INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS mesh_jobs (
    job_id VARCHAR(64) PRIMARY KEY,
    workload_type VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL,
    assigned_worker_id VARCHAR(64),
    required_architecture VARCHAR(32),
    required_instruction_sets VARCHAR(256),
    required_memory_bytes BIGINT,
    required_cpu_shares INT,
    priority INT NOT NULL DEFAULT 0,
    timeout_seconds INT,
    idempotency_key VARCHAR(128),
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    payload BLOB,
    result_payload BLOB,
    error_details VARCHAR(1024),
    execution_duration_ms DOUBLE PRECISION,
    created_at TIMESTAMP NOT NULL,
    assigned_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    deadline_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mesh_job_attempts (
    attempt_id VARCHAR(64) PRIMARY KEY,
    job_id VARCHAR(64) NOT NULL,
    worker_id VARCHAR(64) NOT NULL,
    attempt_number INT NOT NULL,
    status VARCHAR(32) NOT NULL,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    duration_ms DOUBLE PRECISION,
    error_details VARCHAR(1024)
);

CREATE TABLE IF NOT EXISTS mesh_scheduling_decisions (
    decision_id VARCHAR(64) PRIMARY KEY,
    job_id VARCHAR(64) NOT NULL,
    selected_worker_id VARCHAR(64) NOT NULL,
    decision_reason VARCHAR(512),
    candidate_workers_count INT,
    timestamp TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS mesh_worker_transitions (
    transition_id VARCHAR(64) PRIMARY KEY,
    worker_id VARCHAR(64) NOT NULL,
    from_status VARCHAR(32) NOT NULL,
    to_status VARCHAR(32) NOT NULL,
    reason VARCHAR(256),
    timestamp TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mesh_workers_status ON mesh_workers(status);
CREATE INDEX IF NOT EXISTS idx_mesh_jobs_status ON mesh_jobs(status);
CREATE INDEX IF NOT EXISTS idx_mesh_jobs_idempotency ON mesh_jobs(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_mesh_job_attempts_job ON mesh_job_attempts(job_id);
