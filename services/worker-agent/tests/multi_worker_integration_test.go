package tests

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/ayushcmd/go-green/services/worker-agent/internal/agent"
	"github.com/ayushcmd/go-green/services/worker-agent/internal/config"
	meshv1 "github.com/ayushcmd/go-green/services/worker-agent/proto/gogreen/mesh/v1"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func TestMultiWorkerConcurrentExecution(t *testing.T) {
	nativeDaemon := createMockNativeDaemon()
	defer nativeDaemon.Close()

	// 1. Start Mock Coordinator
	runner, err := StartTestServer()
	if err != nil {
		t.Fatalf("Failed to start test coordinator server: %v", err)
	}
	defer runner.Stop()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	coord := runner.Coordinator

	// 2. Setup Worker 1 (Worker Alpha)
	cfg1 := config.DefaultConfig()
	cfg1.WorkerID = "worker-alpha-01"
	cfg1.CoordinatorEndpoint = runner.Endpoint
	cfg1.NativeDaemonURL = nativeDaemon.URL
	cfg1.HeartbeatInterval = 100 * time.Millisecond

	ag1, err := agent.NewAgent(cfg1, nil)
	if err != nil {
		t.Fatalf("Failed to construct agent 1: %v", err)
	}

	// 3. Setup Worker 2 (Worker Beta)
	cfg2 := config.DefaultConfig()
	cfg2.WorkerID = "worker-beta-02"
	cfg2.CoordinatorEndpoint = runner.Endpoint
	cfg2.NativeDaemonURL = nativeDaemon.URL
	cfg2.HeartbeatInterval = 100 * time.Millisecond

	ag2, err := agent.NewAgent(cfg2, nil)
	if err != nil {
		t.Fatalf("Failed to construct agent 2: %v", err)
	}

	// Start both agents concurrently
	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		_ = ag1.Start(ctx)
	}()

	go func() {
		defer wg.Done()
		_ = ag2.Start(ctx)
	}()

	// 4. Verify Both Workers Registered
	t.Log("Verifying concurrent worker registrations...")
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		coord.mu.Lock()
		count := len(coord.registeredWorkers)
		coord.mu.Unlock()
		if count >= 2 {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}

	coord.mu.Lock()
	if len(coord.registeredWorkers) < 2 {
		t.Fatalf("Expected 2 registered workers, got %d", len(coord.registeredWorkers))
	}
	w1Reg := coord.registeredWorkers["worker-alpha-01"]
	w2Reg := coord.registeredWorkers["worker-beta-02"]
	coord.mu.Unlock()

	if w1Reg == nil || w2Reg == nil {
		t.Fatalf("Missing registrations for workers: w1=%v, w2=%v", w1Reg, w2Reg)
	}
	t.Logf("Worker 1 registered: ID=%s, Arch=%s", w1Reg.WorkerId, w1Reg.Architecture)
	t.Logf("Worker 2 registered: ID=%s, Arch=%s", w2Reg.WorkerId, w2Reg.Architecture)

	// 5. Verify Concurrent Heartbeat Streams
	t.Log("Verifying concurrent heartbeats from both workers...")
	time.Sleep(1000 * time.Millisecond)

	coord.mu.Lock()
	hbCount := len(coord.receivedHeartbeats)
	hbWorkers := make(map[string]int)
	for _, hb := range coord.receivedHeartbeats {
		hbWorkers[hb.WorkerId]++
	}
	coord.mu.Unlock()

	t.Logf("Received %d total heartbeats across %d workers", hbCount, len(hbWorkers))
	if hbWorkers["worker-alpha-01"] == 0 || hbWorkers["worker-beta-02"] == 0 {
		t.Fatalf("Both workers must stream heartbeats concurrently: map=%v", hbWorkers)
	}

	// 6. Test Job Assignment, Ack, Progress, and Result to Worker 1
	t.Log("Testing job lifecycle dispatch to Worker 1...")
	job1 := &meshv1.JobAssignment{
		JobId:        "job-multi-alpha-1",
		WorkloadType: meshv1.WorkloadType_WORKLOAD_TYPE_CPU_INFORMATION,
		ExecutionDeadline: timestamppb.New(time.Now().Add(10 * time.Second)),
	}

	err = ag1.HandleJobAssignment(job1)
	if err != nil {
		t.Fatalf("Failed to handle job assignment on worker 1: %v", err)
	}

	// Wait for Ack and Result
	resultDeadline := time.Now().Add(5 * time.Second)
	var foundResult *meshv1.JobResult
	for time.Now().Before(resultDeadline) {
		coord.mu.Lock()
		for _, res := range coord.receivedResults {
			if res.JobId == "job-multi-alpha-1" {
				foundResult = res
				break
			}
		}
		coord.mu.Unlock()
		if foundResult != nil {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}

	if foundResult == nil {
		t.Fatalf("Worker 1 did not deliver result for job-multi-alpha-1 within deadline")
	}

	t.Logf("Job completed by worker: ID=%s, Status=%v, Duration=%.2fms",
		foundResult.JobId, foundResult.ExecutionStatus, foundResult.ExecutionDurationMs)

	if foundResult.ExecutionStatus != meshv1.ExecutionStatus_EXECUTION_STATUS_COMPLETED {
		t.Fatalf("Expected job status COMPLETED, got %v", foundResult.ExecutionStatus)
	}

	// Verify JobAck was received
	coord.mu.Lock()
	var ackReceived bool
	for _, ack := range coord.receivedAcks {
		if ack.JobId == "job-multi-alpha-1" && ack.WorkerId == "worker-alpha-01" && ack.Accepted {
			ackReceived = true
			break
		}
	}
	var progressReceived bool
	for _, prog := range coord.receivedProgress {
		if prog.JobId == "job-multi-alpha-1" {
			progressReceived = true
			break
		}
	}
	coord.mu.Unlock()

	if !ackReceived {
		t.Errorf("Coordinator did not receive JobAcknowledgement for job-multi-alpha-1")
	}
	if !progressReceived {
		t.Errorf("Coordinator did not receive JobProgress for job-multi-alpha-1")
	}

	// 7. Verify Idempotency: Duplicate assignment handled safely
	t.Log("Verifying idempotency...")
	err = ag1.HandleJobAssignment(job1)
	if err != nil {
		t.Fatalf("Worker failed handling idempotent assignment: %v", err)
	}

	// 8. Graceful Worker Shutdown
	t.Log("Testing graceful shutdown of Worker 2...")
	err = ag2.Shutdown(context.Background(), "Planned maintenance shutdown")
	if err != nil {
		t.Fatalf("Worker 2 shutdown failed: %v", err)
	}

	time.Sleep(300 * time.Millisecond)
	coord.mu.Lock()
	var shutdownReceived bool
	for _, s := range coord.receivedShutdowns {
		if s.WorkerId == "worker-beta-02" {
			shutdownReceived = true
			break
		}
	}
	coord.mu.Unlock()

	if !shutdownReceived {
		t.Errorf("Coordinator did not receive WorkerShutdownNotification for Worker 2")
	}

	// Stop all
	cancel()
	_ = ag1.Shutdown(context.Background(), "Test complete")
	t.Log("Multi-worker execution integration test passed successfully!")
}
