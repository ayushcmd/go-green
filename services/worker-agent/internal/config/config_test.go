package config_test

import (
	"os"
	"testing"
	"time"

	"github.com/ayushcmd/go-green/services/worker-agent/internal/config"
)

func TestDefaultConfig(t *testing.T) {
	cfg := config.DefaultConfig()

	if cfg.WorkerID == "" {
		t.Errorf("Expected WorkerID to be generated, got empty")
	}
	if cfg.CoordinatorEndpoint != "127.0.0.1:50051" {
		t.Errorf("Expected CoordinatorEndpoint=127.0.0.1:50051, got %s", cfg.CoordinatorEndpoint)
	}
	if cfg.NativeDaemonURL != "http://127.0.0.1:8080" {
		t.Errorf("Expected NativeDaemonURL=http://127.0.0.1:8080, got %s", cfg.NativeDaemonURL)
	}
	if cfg.HeartbeatInterval != 3*time.Second {
		t.Errorf("Expected HeartbeatInterval=3s, got %v", cfg.HeartbeatInterval)
	}
	if cfg.TLSEnabled {
		t.Errorf("Expected TLSEnabled=false by default, got true")
	}
}

func TestLoadFromEnv(t *testing.T) {
	os.Setenv("GOGREEN_WORKER_ID", "custom-worker-42")
	os.Setenv("GOGREEN_COORDINATOR_ENDPOINT", "mesh-coord.internal:9000")
	os.Setenv("GOGREEN_NATIVE_DAEMON_URL", "http://127.0.0.1:8888")
	os.Setenv("GOGREEN_HEARTBEAT_INTERVAL", "5s")
	os.Setenv("GOGREEN_TLS_ENABLED", "true")
	os.Setenv("GOGREEN_MTLS_ENABLED", "true")
	os.Setenv("GOGREEN_MAX_MESSAGE_SIZE", "8388608")
	defer func() {
		os.Unsetenv("GOGREEN_WORKER_ID")
		os.Unsetenv("GOGREEN_COORDINATOR_ENDPOINT")
		os.Unsetenv("GOGREEN_NATIVE_DAEMON_URL")
		os.Unsetenv("GOGREEN_HEARTBEAT_INTERVAL")
		os.Unsetenv("GOGREEN_TLS_ENABLED")
		os.Unsetenv("GOGREEN_MTLS_ENABLED")
		os.Unsetenv("GOGREEN_MAX_MESSAGE_SIZE")
	}()

	cfg := config.LoadFromEnv()

	if cfg.WorkerID != "custom-worker-42" {
		t.Errorf("Expected WorkerID=custom-worker-42, got %s", cfg.WorkerID)
	}
	if cfg.CoordinatorEndpoint != "mesh-coord.internal:9000" {
		t.Errorf("Expected CoordinatorEndpoint=mesh-coord.internal:9000, got %s", cfg.CoordinatorEndpoint)
	}
	if cfg.NativeDaemonURL != "http://127.0.0.1:8888" {
		t.Errorf("Expected NativeDaemonURL=http://127.0.0.1:8888, got %s", cfg.NativeDaemonURL)
	}
	if cfg.HeartbeatInterval != 5*time.Second {
		t.Errorf("Expected HeartbeatInterval=5s, got %v", cfg.HeartbeatInterval)
	}
	if !cfg.TLSEnabled || !cfg.MTLSEnabled {
		t.Errorf("Expected TLS and mTLS to be enabled")
	}
	if cfg.MaxMessageSize != 8388608 {
		t.Errorf("Expected MaxMessageSize=8388608, got %d", cfg.MaxMessageSize)
	}
}
