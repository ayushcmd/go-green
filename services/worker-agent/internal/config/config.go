package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	WorkerID              string
	Hostname              string
	CoordinatorEndpoint   string
	NativeDaemonURL       string
	HeartbeatInterval     time.Duration
	TLSEnabled            bool
	MTLSEnabled           bool
	TLSCertFile           string
	TLSKeyFile            string
	TLSCAFile             string
	MaxMessageSize        int
	ReconnectBackoffMin   time.Duration
	ReconnectBackoffMax   time.Duration
	WorkerVersion         string
	ProtocolVersion       string
}

func DefaultConfig() *Config {
	hostname, _ := os.Hostname()
	if hostname == "" {
		hostname = "gogreen-worker-local"
	}

	return &Config{
		WorkerID:            fmt.Sprintf("worker-%s-%d", hostname, time.Now().Unix()),
		Hostname:            hostname,
		CoordinatorEndpoint: "127.0.0.1:50051",
		NativeDaemonURL:     "http://127.0.0.1:8080",
		HeartbeatInterval:   3 * time.Second,
		TLSEnabled:          false,
		MTLSEnabled:         false,
		MaxMessageSize:      4 * 1024 * 1024, // 4MB
		ReconnectBackoffMin: 500 * time.Millisecond,
		ReconnectBackoffMax: 15 * time.Second,
		WorkerVersion:       "1.0.0-phase3",
		ProtocolVersion:     "1.0.0",
	}
}

func LoadFromEnv() *Config {
	cfg := DefaultConfig()

	if v := os.Getenv("GOGREEN_WORKER_ID"); v != "" {
		cfg.WorkerID = v
	}
	if v := os.Getenv("GOGREEN_COORDINATOR_ENDPOINT"); v != "" {
		cfg.CoordinatorEndpoint = v
	}
	if v := os.Getenv("GOGREEN_NATIVE_DAEMON_URL"); v != "" {
		cfg.NativeDaemonURL = v
	}
	if v := os.Getenv("GOGREEN_HEARTBEAT_INTERVAL"); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			cfg.HeartbeatInterval = d
		}
	}
	if v := os.Getenv("GOGREEN_TLS_ENABLED"); v != "" {
		cfg.TLSEnabled = (v == "true" || v == "1")
	}
	if v := os.Getenv("GOGREEN_MTLS_ENABLED"); v != "" {
		cfg.MTLSEnabled = (v == "true" || v == "1")
	}
	if v := os.Getenv("GOGREEN_TLS_CERT_FILE"); v != "" {
		cfg.TLSCertFile = v
	}
	if v := os.Getenv("GOGREEN_TLS_KEY_FILE"); v != "" {
		cfg.TLSKeyFile = v
	}
	if v := os.Getenv("GOGREEN_TLS_CA_FILE"); v != "" {
		cfg.TLSCAFile = v
	}
	if v := os.Getenv("GOGREEN_MAX_MESSAGE_SIZE"); v != "" {
		if size, err := strconv.Atoi(v); err == nil && size > 0 {
			cfg.MaxMessageSize = size
		}
	}

	return cfg
}
