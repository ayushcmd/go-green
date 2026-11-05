package executor

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/ayushcmd/go-green/services/worker-agent/internal/nativeclient"
	meshv1 "github.com/ayushcmd/go-green/services/worker-agent/proto/gogreen/mesh/v1"
	"google.golang.org/protobuf/types/known/timestamppb"
)

const MaxPayloadBytes = 4 * 1024 * 1024 // 4MB

type Executor struct {
	workerID     string
	nativeClient *nativeclient.Client
}

func NewExecutor(workerID string, nativeClient *nativeclient.Client) *Executor {
	return &Executor{
		workerID:     workerID,
		nativeClient: nativeClient,
	}
}

func (e *Executor) ValidateJob(assignment *meshv1.JobAssignment) error {
	if assignment == nil {
		return fmt.Errorf("assignment cannot be nil")
	}
	if assignment.JobId == "" {
		return fmt.Errorf("job_id cannot be empty")
	}
	if len(assignment.ValidatedPayload) > MaxPayloadBytes {
		return fmt.Errorf("payload exceeds maximum permitted size of %d bytes", MaxPayloadBytes)
	}

	switch assignment.WorkloadType {
	case meshv1.WorkloadType_WORKLOAD_TYPE_CPU_INFORMATION,
		meshv1.WorkloadType_WORKLOAD_TYPE_SYSTEM_TELEMETRY,
		meshv1.WorkloadType_WORKLOAD_TYPE_NATIVE_BENCHMARK_SUITE:
		return nil
	default:
		return fmt.Errorf("unsupported or unauthorized workload type: %v", assignment.WorkloadType)
	}
}

func (e *Executor) Execute(ctx context.Context, assignment *meshv1.JobAssignment) *meshv1.JobResult {
	startedAt := time.Now()
	res := &meshv1.JobResult{
		JobId:     assignment.JobId,
		WorkerId:  e.workerID,
		StartedAt: timestamppb.New(startedAt),
	}

	if err := e.ValidateJob(assignment); err != nil {
		res.ExecutionStatus = meshv1.ExecutionStatus_EXECUTION_STATUS_FAILED
		res.ErrorDetails = err.Error()
		res.CompletedAt = timestamppb.New(time.Now())
		res.ExecutionDurationMs = float64(time.Since(startedAt).Milliseconds())
		return res
	}

	// Apply deadline from assignment if provided
	execCtx := ctx
	if assignment.ExecutionDeadline != nil {
		deadline := assignment.ExecutionDeadline.AsTime()
		if time.Now().After(deadline) {
			res.ExecutionStatus = meshv1.ExecutionStatus_EXECUTION_STATUS_TIMEOUT
			res.ErrorDetails = "job assignment arrived past its execution deadline"
			res.CompletedAt = timestamppb.New(time.Now())
			res.ExecutionDurationMs = float64(time.Since(startedAt).Milliseconds())
			return res
		}
		var cancel context.CancelFunc
		execCtx, cancel = context.WithDeadline(ctx, deadline)
		defer cancel()
	}

	var payloadBytes []byte
	var execErr error

	switch assignment.WorkloadType {
	case meshv1.WorkloadType_WORKLOAD_TYPE_CPU_INFORMATION:
		payloadBytes, execErr = e.executeCpuInfo(execCtx)
	case meshv1.WorkloadType_WORKLOAD_TYPE_SYSTEM_TELEMETRY:
		payloadBytes, execErr = e.executeTelemetry(execCtx)
	case meshv1.WorkloadType_WORKLOAD_TYPE_NATIVE_BENCHMARK_SUITE:
		payloadBytes, execErr = e.executeBenchmarkSuite(execCtx, assignment.ValidatedPayload)
	default:
		execErr = fmt.Errorf("unhandled workload type")
	}

	completedAt := time.Now()
	res.CompletedAt = timestamppb.New(completedAt)
	res.ExecutionDurationMs = float64(time.Since(startedAt).Microseconds()) / 1000.0

	if execErr != nil {
		if execCtx.Err() == context.DeadlineExceeded {
			res.ExecutionStatus = meshv1.ExecutionStatus_EXECUTION_STATUS_TIMEOUT
			res.ErrorDetails = "workload execution timed out"
		} else if execCtx.Err() == context.Canceled {
			res.ExecutionStatus = meshv1.ExecutionStatus_EXECUTION_STATUS_CANCELLED
			res.ErrorDetails = "workload execution cancelled"
		} else {
			res.ExecutionStatus = meshv1.ExecutionStatus_EXECUTION_STATUS_FAILED
			res.ErrorDetails = execErr.Error()
		}
		return res
	}

	res.ExecutionStatus = meshv1.ExecutionStatus_EXECUTION_STATUS_COMPLETED
	res.ResultPayload = payloadBytes
	return res
}

func (e *Executor) executeCpuInfo(ctx context.Context) ([]byte, error) {
	if e.nativeClient == nil {
		return nil, fmt.Errorf("native daemon client not configured")
	}

	cpu, err := e.nativeClient.GetCpuInfo(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to query native daemon CPU info: %w", err)
	}

	features, err := e.nativeClient.GetCpuFeatures(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to query native daemon CPU features: %w", err)
	}

	payload := map[string]interface{}{
		"cpu":      cpu,
		"features": features,
	}
	return json.Marshal(payload)
}

func (e *Executor) executeTelemetry(ctx context.Context) ([]byte, error) {
	if e.nativeClient == nil {
		return nil, fmt.Errorf("native daemon client not configured")
	}

	telem, err := e.nativeClient.GetTelemetry(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to query native daemon telemetry: %w", err)
	}

	host, err := e.nativeClient.GetHostInfo(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to query native daemon host info: %w", err)
	}

	payload := map[string]interface{}{
		"telemetry": telem,
		"host":      host,
	}
	return json.Marshal(payload)
}

func (e *Executor) executeBenchmarkSuite(ctx context.Context, rawParams []byte) ([]byte, error) {
	if e.nativeClient == nil {
		return nil, fmt.Errorf("native daemon client not configured")
	}

	benchmarkType := "all"
	useAsm := true

	if len(rawParams) > 0 {
		var params struct {
			Type   string `json:"type"`
			UseAsm *bool  `json:"use_asm"`
		}
		if err := json.Unmarshal(rawParams, &params); err == nil {
			if params.Type != "" {
				benchmarkType = params.Type
			}
			if params.UseAsm != nil {
				useAsm = *params.UseAsm
			}
		}
	}

	results, err := e.nativeClient.RunBenchmark(ctx, benchmarkType, useAsm)
	if err != nil {
		return nil, fmt.Errorf("native benchmark execution error: %w", err)
	}

	return json.Marshal(results)
}
