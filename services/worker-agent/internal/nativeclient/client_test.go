package nativeclient_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/ayushcmd/go-green/services/worker-agent/internal/nativeclient"
)

func TestNativeClient(t *testing.T) {
	mux := http.NewServeMux()

	mux.HandleFunc("/api/v1/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status":         "healthy",
			"initialized":    true,
			"uptime_seconds": 120,
			"engine_version": "2.0.0-phase2",
			"timestamp":      "2026-11-05T00:00:00Z",
		})
	})

	mux.HandleFunc("/api/v1/cpu", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"vendor":         "GenuineIntel",
			"brand":          "12th Gen Intel(R) Core(TM) i7-12700H",
			"family":         6,
			"model":          154,
			"stepping":       3,
			"logical_cores":  20,
			"physical_cores": 14,
			"architecture":   "x86_64",
		})
	})

	mux.HandleFunc("/api/v1/cpu/features", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode([]map[string]interface{}{
			{"name": "SSE2", "active": true, "category": "SIMD"},
			{"name": "AVX2", "active": true, "category": "SIMD"},
			{"name": "AVX512F", "active": false, "category": "SIMD"},
		})
	})

	mux.HandleFunc("/api/v1/benchmarks/run", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode([]map[string]interface{}{
			{
				"id":                    "metric-1",
				"name":                  "asm_memcmp",
				"iterations":            1000,
				"duration_ms":           0.05,
				"throughput_ops_sec":    20000000.0,
				"throughput_mb_sec":     12000.5,
				"verified_correct":      true,
			},
		})
	})

	server := httptest.NewServer(mux)
	defer server.Close()

	client := nativeclient.NewClient(server.URL, 2*time.Second)
	ctx := context.Background()

	// 1. Health check
	health, err := client.GetHealth(ctx)
	if err != nil {
		t.Fatalf("GetHealth failed: %v", err)
	}
	if health.Status != "healthy" || health.EngineVersion != "2.0.0-phase2" {
		t.Errorf("Unexpected health data: %+v", health)
	}

	// 2. CPU info
	cpu, err := client.GetCpuInfo(ctx)
	if err != nil {
		t.Fatalf("GetCpuInfo failed: %v", err)
	}
	if cpu.Vendor != "GenuineIntel" || cpu.LogicalCores != 20 {
		t.Errorf("Unexpected CPU info: %+v", cpu)
	}

	// 3. CPU features
	features, err := client.GetCpuFeatures(ctx)
	if err != nil {
		t.Fatalf("GetCpuFeatures failed: %v", err)
	}
	if len(features) != 3 || features[0].Name != "SSE2" || !features[0].Active {
		t.Errorf("Unexpected CPU features: %+v", features)
	}

	// 4. Benchmark run
	bench, err := client.RunBenchmark(ctx, "asm_memcmp", true)
	if err != nil {
		t.Fatalf("RunBenchmark failed: %v", err)
	}
	if len(bench) != 1 || bench[0].Name != "asm_memcmp" {
		t.Errorf("Unexpected benchmark response: %+v", bench)
	}
}
