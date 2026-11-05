package agent

import (
	"context"
	"crypto/tls"
	"fmt"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"github.com/ayushcmd/go-green/services/worker-agent/internal/config"
	"github.com/ayushcmd/go-green/services/worker-agent/internal/executor"
	"github.com/ayushcmd/go-green/services/worker-agent/internal/grpcclient"
	"github.com/ayushcmd/go-green/services/worker-agent/internal/hardware"
	"github.com/ayushcmd/go-green/services/worker-agent/internal/nativeclient"
	"github.com/ayushcmd/go-green/services/worker-agent/internal/security"
	meshv1 "github.com/ayushcmd/go-green/services/worker-agent/proto/gogreen/mesh/v1"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type Agent struct {
	cfg          *config.Config
	nativeClient *nativeclient.Client
	executor     *executor.Executor
	hwInfo       *hardware.HardwareDiscovery
	grpcClient   *grpcclient.Client

	startTime        time.Time
	heartbeatSeq     uint64
	registered       atomic.Bool
	assignedPart     string
	heartbeatInter   time.Duration
	activeJobsCount  atomic.Int32
	workerStatus     meshv1.WorkerStatus
	statusMu         sync.RWMutex

	activeCancelsMu sync.Mutex
	activeCancels   map[string]context.CancelFunc
}

func NewAgent(cfg *config.Config, tlsConfig *tls.Config) (*Agent, error) {
	if cfg == nil {
		cfg = config.DefaultConfig()
	}

	nativeCli := nativeclient.NewClient(cfg.NativeDaemonURL, 3*time.Second)
	exec := executor.NewExecutor(cfg.WorkerID, nativeCli)

	a := &Agent{
		cfg:             cfg,
		nativeClient:    nativeCli,
		executor:        exec,
		startTime:       time.Now(),
		heartbeatInter:  cfg.HeartbeatInterval,
		workerStatus:    meshv1.WorkerStatus_WORKER_STATUS_IDLE,
		activeCancels:   make(map[string]context.CancelFunc),
	}

	// Prepare TLS if configured and not explicitly provided
	if tlsConfig == nil && (cfg.TLSEnabled || cfg.MTLSEnabled) {
		var err error
		tlsConfig, err = security.BuildClientTLSConfig(
			cfg.TLSCAFile,
			cfg.TLSCertFile,
			cfg.TLSKeyFile,
			"localhost",
		)
		if err != nil {
			return nil, fmt.Errorf("failed to initialize TLS configuration: %w", err)
		}
	}

	opts := grpcclient.Options{
		Target:         cfg.CoordinatorEndpoint,
		TLSConfig:      tlsConfig,
		MaxMessageSize: cfg.MaxMessageSize,
		BackoffMin:     cfg.ReconnectBackoffMin,
		BackoffMax:     cfg.ReconnectBackoffMax,
	}

	a.grpcClient = grpcclient.NewClient(opts, a)
	return a, nil
}

func (a *Agent) Start(ctx context.Context) error {
	log.Printf("[INFO] Initializing GoGreen Worker Agent: ID=%s, Endpoint=%s", a.cfg.WorkerID, a.cfg.CoordinatorEndpoint)

	// 1. Discover local hardware and native daemon
	a.hwInfo = hardware.Discover(ctx, a.nativeClient)
	log.Printf("[INFO] Hardware discovered: OS=%s, Arch=%s, LogicalCores=%d, NativeDaemonAvailable=%v",
		a.hwInfo.OperatingSystem, a.hwInfo.Architecture, a.hwInfo.LogicalCores, a.hwInfo.NativeDaemonAvailable)

	// 2. Start heartbeat worker in background
	heartbeatCtx, cancelHeartbeat := context.WithCancel(ctx)
	defer cancelHeartbeat()
	go a.runHeartbeatLoop(heartbeatCtx)

	// 3. Connect to coordinator and maintain connection
	return a.grpcClient.Run(ctx, func() error {
		log.Printf("[INFO] gRPC connection established. Dispatching WorkerRegistration...")
		return a.SendRegistration()
	})
}

func (a *Agent) SendRegistration() error {
	reg := &meshv1.WorkerRegistration{
		WorkerId:                 a.cfg.WorkerID,
		Hostname:                 a.hwInfo.Hostname,
		OperatingSystem:          a.hwInfo.OperatingSystem,
		Architecture:             a.hwInfo.Architecture,
		CpuVendor:                a.hwInfo.CPUVendor,
		CpuModel:                 a.hwInfo.CPUModel,
		PhysicalCores:            a.hwInfo.PhysicalCores,
		LogicalCores:             a.hwInfo.LogicalCores,
		SupportedInstructionSets: a.hwInfo.SupportedInstructionSets,
		MemoryTotalBytes:         a.hwInfo.MemoryTotalBytes,
		NativeEngineVersion:      a.hwInfo.NativeEngineVersion,
		WorkerVersion:            a.cfg.WorkerVersion,
		ProtocolVersion:          a.cfg.ProtocolVersion,
		Labels: map[string]string{
			"agent.runtime": "go",
			"subsystem":     "mesh-worker",
		},
	}

	msg := &meshv1.WorkerMessage{
		Payload: &meshv1.WorkerMessage_Registration{
			Registration: reg,
		},
	}
	return a.grpcClient.Send(msg)
}

func (a *Agent) runHeartbeatLoop(ctx context.Context) {
	ticker := time.NewTicker(a.heartbeatInter)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if !a.grpcClient.IsConnected() || !a.registered.Load() {
				continue
			}

			if err := a.sendHeartbeat(ctx); err != nil {
				log.Printf("[WARN] Failed to send heartbeat: %v", err)
			}
		}
	}
}

func (a *Agent) sendHeartbeat(ctx context.Context) error {
	seq := atomic.AddUint64(&a.heartbeatSeq, 1)
	uptime := uint64(time.Since(a.startTime).Seconds())

	// Query telemetry from native daemon if available
	daemonStatus := "OFFLINE"
	var load1m float64
	var memUsedBytes uint64

	if a.nativeClient != nil {
		probeCtx, cancel := context.WithTimeout(ctx, 1*time.Second)
		defer cancel()

		if telem, err := a.nativeClient.GetTelemetry(probeCtx); err == nil {
			daemonStatus = "ONLINE"
			load1m = telem.System.Load1m
			memUsedBytes = telem.System.Memory.UsedBytes
		}
	}

	a.statusMu.RLock()
	st := a.workerStatus
	a.statusMu.RUnlock()

	hb := &meshv1.WorkerHeartbeat{
		WorkerId:           a.cfg.WorkerID,
		Timestamp:          timestamppb.New(time.Now()),
		UptimeSeconds:      uptime,
		WorkerStatus:       st,
		CpuUsagePercent:    load1m * 10.0, // load-derived percentage
		MemoryUsedBytes:    memUsedBytes,
		ActiveJobs:         uint32(a.activeJobsCount.Load()),
		NativeDaemonStatus: daemonStatus,
		SystemLoad_1M:      load1m,
		SequenceNumber:     seq,
	}

	msg := &meshv1.WorkerMessage{
		Payload: &meshv1.WorkerMessage_Heartbeat{
			Heartbeat: hb,
		},
	}
	return a.grpcClient.Send(msg)
}

// -----------------------------------------------------------------------------
// MessageHandler implementation
// -----------------------------------------------------------------------------

func (a *Agent) HandleRegistrationAck(ack *meshv1.WorkerRegistrationAck) error {
	if ack == nil {
		return nil
	}

	if ack.Accepted {
		a.registered.Store(true)
		a.assignedPart = ack.AssignedPartition
		if ack.HeartbeatIntervalSeconds > 0 {
			a.heartbeatInter = time.Duration(ack.HeartbeatIntervalSeconds) * time.Second
		}
		log.Printf("[INFO] Registration ACCEPTED by coordinator: Partition=%s, HeartbeatInterval=%v",
			a.assignedPart, a.heartbeatInter)
	} else {
		a.registered.Store(false)
		log.Printf("[ERROR] Registration REJECTED by coordinator: %s", ack.Message)
	}
	return nil
}

func (a *Agent) HandleHeartbeatAck(ack *meshv1.HeartbeatAck) error {
	if ack == nil {
		return nil
	}
	// Successfully acknowledged
	return nil
}

func (a *Agent) HandleJobAssignment(assignment *meshv1.JobAssignment) error {
	if assignment == nil {
		return nil
	}
	log.Printf("[INFO] Received JobAssignment: ID=%s, Type=%v", assignment.JobId, assignment.WorkloadType)

	// 1. Send acknowledgement
	ack := &meshv1.JobAcknowledgement{
		JobId:          assignment.JobId,
		WorkerId:       a.cfg.WorkerID,
		Accepted:       true,
		AcknowledgedAt: timestamppb.New(time.Now()),
	}
	_ = a.grpcClient.Send(&meshv1.WorkerMessage{
		Payload: &meshv1.WorkerMessage_JobAck{JobAck: ack},
	})

	// Send initial progress
	_ = a.grpcClient.Send(&meshv1.WorkerMessage{
		Payload: &meshv1.WorkerMessage_JobProgress{
			JobProgress: &meshv1.JobProgress{
				JobId:           assignment.JobId,
				WorkerId:        a.cfg.WorkerID,
				ProgressPercent: 10.0,
				StatusMessage:   "Starting execution",
				UpdatedAt:       timestamppb.New(time.Now()),
			},
		},
	})

	// 2. Track cancellation context
	jobCtx, cancel := context.WithCancel(context.Background())
	a.activeCancelsMu.Lock()
	a.activeCancels[assignment.JobId] = cancel
	a.activeCancelsMu.Unlock()

	a.activeJobsCount.Add(1)
	a.setStatus(meshv1.WorkerStatus_WORKER_STATUS_BUSY)

	// 3. Execute in background goroutine
	go func() {
		defer func() {
			cancel()
			a.activeCancelsMu.Lock()
			delete(a.activeCancels, assignment.JobId)
			a.activeCancelsMu.Unlock()

			if a.activeJobsCount.Add(-1) == 0 {
				a.setStatus(meshv1.WorkerStatus_WORKER_STATUS_IDLE)
			}
		}()

		result := a.executor.Execute(jobCtx, assignment)
		log.Printf("[INFO] Job completed: ID=%s, Status=%v, Duration=%.2fms",
			result.JobId, result.ExecutionStatus, result.ExecutionDurationMs)

		_ = a.grpcClient.Send(&meshv1.WorkerMessage{
			Payload: &meshv1.WorkerMessage_JobResult{JobResult: result},
		})
	}()

	return nil
}

func (a *Agent) HandleJobCancellation(cancellation *meshv1.JobCancellation) error {
	if cancellation == nil {
		return nil
	}
	log.Printf("[WARN] Received JobCancellation for JobId=%s, Reason=%s", cancellation.JobId, cancellation.Reason)

	a.activeCancelsMu.Lock()
	cancel, found := a.activeCancels[cancellation.JobId]
	a.activeCancelsMu.Unlock()

	if found && cancel != nil {
		cancel()
	}
	return nil
}

func (a *Agent) HandleCoordinatorCommand(command *meshv1.CoordinatorCommand) error {
	if command == nil {
		return nil
	}
	log.Printf("[INFO] Received CoordinatorCommand: Action=%v, ID=%s", command.Action, command.CommandId)

	switch command.Action {
	case meshv1.CoordinatorCommand_ACTION_DRAIN:
		a.setStatus(meshv1.WorkerStatus_WORKER_STATUS_DRAINING)
	case meshv1.CoordinatorCommand_ACTION_RESUME:
		a.setStatus(meshv1.WorkerStatus_WORKER_STATUS_IDLE)
	case meshv1.CoordinatorCommand_ACTION_SHUTDOWN:
		a.setStatus(meshv1.WorkerStatus_WORKER_STATUS_TERMINATING)
		_ = a.Shutdown(context.Background(), "Coordinator instructed shutdown")
	}
	return nil
}

func (a *Agent) setStatus(s meshv1.WorkerStatus) {
	a.statusMu.Lock()
	defer a.statusMu.Unlock()
	a.workerStatus = s
}

func (a *Agent) Shutdown(ctx context.Context, reason string) error {
	log.Printf("[INFO] Shutting down Worker Agent: Reason=%s", reason)

	if a.grpcClient != nil && a.grpcClient.IsConnected() {
		msg := &meshv1.WorkerMessage{
			Payload: &meshv1.WorkerMessage_Shutdown{
				Shutdown: &meshv1.WorkerShutdownNotification{
					WorkerId:  a.cfg.WorkerID,
					Reason:    reason,
					Timestamp: timestamppb.New(time.Now()),
				},
			},
		}
		_ = a.grpcClient.Send(msg)
		time.Sleep(100 * time.Millisecond) // Allow message to flush
	}

	if a.grpcClient != nil {
		a.grpcClient.Close()
	}
	return nil
}
