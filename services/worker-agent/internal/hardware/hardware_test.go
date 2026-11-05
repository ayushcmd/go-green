package hardware_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/ayushcmd/go-green/services/worker-agent/internal/hardware"
	"github.com/ayushcmd/go-green/services/worker-agent/internal/nativeclient"
)

func TestHardwareDiscovery_Fallback(t *testing.T) {
	// Native daemon is nil (offline/unreachable)
	info := hardware.Discover(context.Background(), nil)

	if info == nil {
		t.Fatalf("Expected non-nil hardware info")
	}
	if info.OperatingSystem == "" {
		t.Errorf("Expected OperatingSystem to be detected")
	}
	if info.Architecture == "" {
		t.Errorf("Expected Architecture to be detected")
	}
	if info.LogicalCores == 0 {
		t.Errorf("Expected LogicalCores > 0")
	}
	if info.NativeDaemonAvailable {
		t.Errorf("Expected NativeDaemonAvailable=false when client is nil")
	}
}

func TestHardwareDiscovery_WithLiveDaemon(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/health", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status":         "healthy",
			"initialized":    true,
			"uptime_seconds": 3600,
			"engine_version": "2.0.0-phase2",
		})
	})
	mux.HandleFunc("/api/v1/cpu", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"vendor":         "AuthenticAMD",
			"brand":          "AMD Ryzen 9 5900X",
			"family":         25,
			"model":          33,
			"stepping":       0,
			"logical_cores":  24,
			"physical_cores": 12,
			"architecture":   "x86_64",
		})
	})
	mux.HandleFunc("/api/v1/host", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"os_name":             "Linux",
			"os_release":          "5.15.153.1-microsoft-standard-WSL2",
			"runtime_environment": "wsl2-linux",
			"uptime_seconds":      7200,
			"memory": map[string]interface{}{
				"total_bytes": 17179869184,
			},
		})
	})
	mux.HandleFunc("/api/v1/cpu/features", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode([]map[string]interface{}{
			{"name": "AVX2", "active": true},
			{"name": "AVX512F", "active": false},
			{"name": "BMI2", "active": true},
		})
	})

	server := httptest.NewServer(mux)
	defer server.Close()

	client := nativeclient.NewClient(server.URL, 2*time.Second)
	info := hardware.Discover(context.Background(), client)

	if !info.NativeDaemonAvailable {
		t.Errorf("Expected NativeDaemonAvailable=true")
	}
	if info.NativeEngineVersion != "2.0.0-phase2" {
		t.Errorf("Expected NativeEngineVersion=2.0.0-phase2, got %s", info.NativeEngineVersion)
	}
	if info.CPUVendor != "AuthenticAMD" {
		t.Errorf("Expected CPUVendor=AuthenticAMD, got %s", info.CPUVendor)
	}
	if info.LogicalCores != 24 || info.PhysicalCores != 12 {
		t.Errorf("Unexpected cores: %d logical, %d physical", info.LogicalCores, info.PhysicalCores)
	}
	if info.OperatingSystem != "wsl2-linux" {
		t.Errorf("Expected OperatingSystem=wsl2-linux, got %s", info.OperatingSystem)
	}
	if len(info.SupportedInstructionSets) != 2 {
		t.Errorf("Expected 2 active instruction sets, got %v", info.SupportedInstructionSets)
	}
}
