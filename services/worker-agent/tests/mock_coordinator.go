package tests

import (
	"fmt"
	"io"
	"net"
	"sync"
	"time"

	meshv1 "github.com/ayushcmd/go-green/services/worker-agent/proto/gogreen/mesh/v1"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type MockCoordinator struct {
	meshv1.UnimplementedMeshCoordinatorServer

	mu                   sync.Mutex
	registeredWorkers    map[string]*meshv1.WorkerRegistration
	receivedHeartbeats   []*meshv1.WorkerHeartbeat
	receivedResults      []*meshv1.JobResult
	receivedShutdowns    []*meshv1.WorkerShutdownNotification
	receivedAcks         []*meshv1.JobAcknowledgement
	receivedProgress     []*meshv1.JobProgress
	jobsToDispatch       []*meshv1.JobAssignment

	onRegisterCb         func(*meshv1.WorkerRegistration)
	onHeartbeatCb        func(*meshv1.WorkerHeartbeat)
	onResultCb           func(*meshv1.JobResult)
	onAckCb              func(*meshv1.JobAcknowledgement)
	onProgressCb         func(*meshv1.JobProgress)
	onShutdownCb         func(*meshv1.WorkerShutdownNotification)

	activeStreams        []grpc.BidiStreamingServer[meshv1.WorkerMessage, meshv1.CoordinatorMessage]
}

func NewMockCoordinator() *MockCoordinator {
	return &MockCoordinator{
		registeredWorkers:  make(map[string]*meshv1.WorkerRegistration),
		receivedHeartbeats: make([]*meshv1.WorkerHeartbeat, 0),
		receivedResults:    make([]*meshv1.JobResult, 0),
		receivedShutdowns:  make([]*meshv1.WorkerShutdownNotification, 0),
		jobsToDispatch:     make([]*meshv1.JobAssignment, 0),
	}
}

func (m *MockCoordinator) QueueJob(job *meshv1.JobAssignment) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.jobsToDispatch = append(m.jobsToDispatch, job)
}

func (m *MockCoordinator) Connect(stream grpc.BidiStreamingServer[meshv1.WorkerMessage, meshv1.CoordinatorMessage]) error {
	m.mu.Lock()
	m.activeStreams = append(m.activeStreams, stream)
	m.mu.Unlock()

	for {
		msg, err := stream.Recv()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}

		if reg := msg.GetRegistration(); reg != nil {
			m.mu.Lock()
			m.registeredWorkers[reg.WorkerId] = reg
			cb := m.onRegisterCb
			var jobsToSend []*meshv1.JobAssignment
			if len(m.jobsToDispatch) > 0 {
				jobsToSend = append(jobsToSend, m.jobsToDispatch...)
				m.jobsToDispatch = nil
			}
			m.mu.Unlock()

			if cb != nil {
				cb(reg)
			}

			// Send Registration ACK
			ack := &meshv1.CoordinatorMessage{
				Payload: &meshv1.CoordinatorMessage_RegistrationAck{
					RegistrationAck: &meshv1.WorkerRegistrationAck{
						Accepted:                 true,
						WorkerId:                 reg.WorkerId,
						AssignedPartition:        "us-west-partition-1",
						HeartbeatIntervalSeconds: 1, // fast heartbeat for tests
						RegisteredAt:             timestamppb.New(time.Now()),
					},
				},
			}
			if err := stream.Send(ack); err != nil {
				return err
			}

			// If any jobs were queued, dispatch them
			for _, job := range jobsToSend {
				jobMsg := &meshv1.CoordinatorMessage{
					Payload: &meshv1.CoordinatorMessage_JobAssignment{
						JobAssignment: job,
					},
				}
				if err := stream.Send(jobMsg); err != nil {
					return err
				}
			}
		}

		if hb := msg.GetHeartbeat(); hb != nil {
			m.mu.Lock()
			m.receivedHeartbeats = append(m.receivedHeartbeats, hb)
			cb := m.onHeartbeatCb
			m.mu.Unlock()

			if cb != nil {
				cb(hb)
			}

			// Send Heartbeat ACK
			hbAck := &meshv1.CoordinatorMessage{
				Payload: &meshv1.CoordinatorMessage_HeartbeatAck{
					HeartbeatAck: &meshv1.HeartbeatAck{
						WorkerId:             hb.WorkerId,
						AcknowledgedSequence: hb.SequenceNumber,
						Timestamp:            timestamppb.New(time.Now()),
					},
				},
			}
			if err := stream.Send(hbAck); err != nil {
				return err
			}
		}

		if ack := msg.GetJobAck(); ack != nil {
			m.mu.Lock()
			m.receivedAcks = append(m.receivedAcks, ack)
			cb := m.onAckCb
			m.mu.Unlock()

			if cb != nil {
				cb(ack)
			}
		}

		if prog := msg.GetJobProgress(); prog != nil {
			m.mu.Lock()
			m.receivedProgress = append(m.receivedProgress, prog)
			cb := m.onProgressCb
			m.mu.Unlock()

			if cb != nil {
				cb(prog)
			}
		}

		if res := msg.GetJobResult(); res != nil {
			m.mu.Lock()
			m.receivedResults = append(m.receivedResults, res)
			cb := m.onResultCb
			m.mu.Unlock()

			if cb != nil {
				cb(res)
			}
		}

		if sht := msg.GetShutdown(); sht != nil {
			m.mu.Lock()
			m.receivedShutdowns = append(m.receivedShutdowns, sht)
			cb := m.onShutdownCb
			m.mu.Unlock()

			if cb != nil {
				cb(sht)
			}
		}
	}
}

type TestServerRunner struct {
	Coordinator *MockCoordinator
	Server      *grpc.Server
	Listener    net.Listener
	Endpoint    string
}

func StartTestServer(opts ...grpc.ServerOption) (*TestServerRunner, error) {
	coord := NewMockCoordinator()
	srv := grpc.NewServer(opts...)
	meshv1.RegisterMeshCoordinatorServer(srv, coord)

	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return nil, fmt.Errorf("failed to listen: %w", err)
	}

	endpoint := lis.Addr().String()
	go func() {
		_ = srv.Serve(lis)
	}()

	return &TestServerRunner{
		Coordinator: coord,
		Server:      srv,
		Listener:    lis,
		Endpoint:    endpoint,
	}, nil
}

func (r *TestServerRunner) Stop() {
	r.Server.Stop()
	_ = r.Listener.Close()
}
