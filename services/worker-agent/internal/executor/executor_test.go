package executor_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/ayushcmd/go-green/services/worker-agent/internal/executor"
	"github.com/ayushcmd/go-green/services/worker-agent/internal/nativeclient"
	meshv1 "github.com/ayushcmd/go-green/services/worker-agent/proto/gogreen/mesh/v1"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func setupMockNativeServer() *httptest.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/cpu", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"vendor": "GenuineIntel",
			"brand":  "Intel Core i7",
			"arch":   "x86_64",
		})
	})
	mux.HandleFunc("/api/v1/cpu/features", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode([]map[string]interface{}{
			{"name": "SSE2", "active": true},
			{"name": "AVX2", "active": true},
		})
	})
	mux.HandleFunc("/api/v1/host", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"os_name":        "Linux",
			"uptime_seconds": 3600,
			"memory": map[string]interface{}{
				"total_bytes": 16000000000,
			},
		})
	})
	mux.HandleFunc("/api/v1/telemetry", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"cpu_usage_percent": 14.5,
			"memory_used_mb":    4096,
			"memory_total_mb":   16384,
			"thread_count":      8,
			"active_tasks":      1,
		})
	})
	mux.HandleFunc("/api/v1/benchmarks/run", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode([]map[string]interface{}{
			{
				"id":                    "metric-exec-1",
				"name":                  "asm_memcpy",
				"iterations":            5000,
				"duration_ms":           0.125,
				"throughput_ops_sec":    40000000.0,
				"throughput_mb_sec":     25000.0,
				"verified_correct":      true,
			},
		})
	})
	return httptest.NewServer(mux)
}

func TestExecutor_RejectInvalidWorkload(t *testing.T) {
	nativeCli := nativeclient.NewClient("http://127.0.0.1:9999", time.Second)
	exec := executor.NewExecutor("test-worker-1", nativeCli)

	assignment := &meshv1.JobAssignment{
		JobId:        "job-bad-type",
		WorkloadType: meshv1.WorkloadType_WORKLOAD_TYPE_UNSPECIFIED,
	}

	result := exec.Execute(context.Background(), assignment)
	if result.ExecutionStatus != meshv1.ExecutionStatus_EXECUTION_STATUS_FAILED {
		t.Errorf("Expected failure for unspecified workload type, got %v", result.ExecutionStatus)
	}
	if result.ErrorDetails == "" {
		t.Errorf("Expected error details to be populated")
	}
}

func TestExecutor_ExecuteCpuInformation(t *testing.T) {
	server := setupMockNativeServer()
	defer server.Close()

	nativeCli := nativeclient.NewClient(server.URL, time.Second)
	exec := executor.NewExecutor("test-worker-1", nativeCli)

	assignment := &meshv1.JobAssignment{
		JobId:        "job-cpu-info",
		WorkloadType: meshv1.WorkloadType_WORKLOAD_TYPE_CPU_INFORMATION,
	}

	result := exec.Execute(context.Background(), assignment)
	if result.ExecutionStatus != meshv1.ExecutionStatus_EXECUTION_STATUS_COMPLETED {
		t.Fatalf("Expected completed for CPU_INFORMATION, got: %v (err: %s)", result.ExecutionStatus, result.ErrorDetails)
	}
	if len(result.ResultPayload) == 0 {
		t.Errorf("Expected non-empty ResultPayload")
	}
}

func TestExecutor_ExecuteTelemetry(t *testing.T) {
	server := setupMockNativeServer()
	defer server.Close()

	nativeCli := nativeclient.NewClient(server.URL, time.Second)
	exec := executor.NewExecutor("test-worker-1", nativeCli)

	assignment := &meshv1.JobAssignment{
		JobId:        "job-telemetry",
		WorkloadType: meshv1.WorkloadType_WORKLOAD_TYPE_SYSTEM_TELEMETRY,
	}

	result := exec.Execute(context.Background(), assignment)
	if result.ExecutionStatus != meshv1.ExecutionStatus_EXECUTION_STATUS_COMPLETED {
		t.Fatalf("Expected completed for SYSTEM_TELEMETRY, got: %v (err: %s)", result.ExecutionStatus, result.ErrorDetails)
	}
	if len(result.ResultPayload) == 0 {
		t.Errorf("Expected non-empty ResultPayload")
	}
}

func TestExecutor_ExecuteBenchmarkSuite(t *testing.T) {
	server := setupMockNativeServer()
	defer server.Close()

	nativeCli := nativeclient.NewClient(server.URL, time.Second)
	exec := executor.NewExecutor("test-worker-1", nativeCli)

	payload, _ := json.Marshal(map[string]interface{}{
		"benchmark":  "asm_memcpy",
		"iterations": 5000,
	})

	assignment := &meshv1.JobAssignment{
		JobId:            "job-bench-1",
		WorkloadType:     meshv1.WorkloadType_WORKLOAD_TYPE_NATIVE_BENCHMARK_SUITE,
		ValidatedPayload: payload,
	}

	result := exec.Execute(context.Background(), assignment)
	if result.ExecutionStatus != meshv1.ExecutionStatus_EXECUTION_STATUS_COMPLETED {
		t.Fatalf("Expected completed for NATIVE_BENCHMARK_SUITE, got: %v (err: %s)", result.ExecutionStatus, result.ErrorDetails)
	}
	if len(result.ResultPayload) == 0 {
		t.Errorf("Expected non-empty ResultPayload")
	}
}

func TestExecutor_PastDeadline(t *testing.T) {
	nativeCli := nativeclient.NewClient("http://127.0.0.1:9999", time.Second)
	exec := executor.NewExecutor("test-worker-1", nativeCli)

	assignment := &meshv1.JobAssignment{
		JobId:             "job-timeout",
		WorkloadType:      meshv1.WorkloadType_WORKLOAD_TYPE_CPU_INFORMATION,
		ExecutionDeadline: timestamppb.New(time.Now().Add(-10 * time.Minute)), // expired
	}

	result := exec.Execute(context.Background(), assignment)
	if result.ExecutionStatus != meshv1.ExecutionStatus_EXECUTION_STATUS_TIMEOUT {
		t.Errorf("Expected TIMEOUT for expired deadline, got: %v", result.ExecutionStatus)
	}
}

func TestExecutor_ExecuteSandbox(t *testing.T) {
	exec := executor.NewExecutor("test-worker-1", nil)

	assignment := &meshv1.JobAssignment{
		JobId:        "job-sandbox-exec-1",
		WorkloadType: meshv1.WorkloadType_WORKLOAD_TYPE_SANDBOX_EXECUTION,
	}

	result := exec.Execute(context.Background(), assignment)
	if result.ExecutionStatus != meshv1.ExecutionStatus_EXECUTION_STATUS_COMPLETED {
		t.Fatalf("Expected completed for SANDBOX_EXECUTION, got: %v (err: %s)", result.ExecutionStatus, result.ErrorDetails)
	}
	if len(result.ResultPayload) == 0 {
		t.Errorf("Expected non-empty ResultPayload for sandbox execution")
	}
}
