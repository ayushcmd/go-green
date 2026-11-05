package grpcclient

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"math/rand"
	"sync"
	"time"

	meshv1 "github.com/ayushcmd/go-green/services/worker-agent/proto/gogreen/mesh/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
)

type MessageHandler interface {
	HandleRegistrationAck(ack *meshv1.WorkerRegistrationAck) error
	HandleHeartbeatAck(ack *meshv1.HeartbeatAck) error
	HandleJobAssignment(assignment *meshv1.JobAssignment) error
	HandleJobCancellation(cancellation *meshv1.JobCancellation) error
	HandleCoordinatorCommand(command *meshv1.CoordinatorCommand) error
}

type Options struct {
	Target             string
	TLSConfig          *tls.Config
	MaxMessageSize     int
	BackoffMin         time.Duration
	BackoffMax         time.Duration
	MaxConnectAttempts int // 0 means bounded loop governed by context
}

type Client struct {
	opts    Options
	handler MessageHandler

	mu        sync.Mutex
	conn      *grpc.ClientConn
	stream    meshv1.MeshCoordinator_ConnectClient
	outbound  chan *meshv1.WorkerMessage
	connected bool
	closing   bool
}

func NewClient(opts Options, handler MessageHandler) *Client {
	if opts.BackoffMin <= 0 {
		opts.BackoffMin = 500 * time.Millisecond
	}
	if opts.BackoffMax <= 0 {
		opts.BackoffMax = 15 * time.Second
	}
	if opts.MaxMessageSize <= 0 {
		opts.MaxMessageSize = 4 * 1024 * 1024
	}

	return &Client{
		opts:     opts,
		handler:  handler,
		outbound: make(chan *meshv1.WorkerMessage, 128),
	}
}

func (c *Client) Send(msg *meshv1.WorkerMessage) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closing {
		return fmt.Errorf("client is closing")
	}

	select {
	case c.outbound <- msg:
		return nil
	default:
		return fmt.Errorf("outbound message queue is full")
	}
}

func (c *Client) IsConnected() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.connected
}

// Run manages the persistent connection loop until ctx is cancelled
func (c *Client) isClosing() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.closing
}

func (c *Client) Run(ctx context.Context, onConnected func() error) error {
	backoff := c.opts.BackoffMin
	attempts := 0

	for {
		if c.isClosing() {
			return nil
		}
		select {
		case <-ctx.Done():
			c.Close()
			return ctx.Err()
		default:
		}

		attempts++
		if c.opts.MaxConnectAttempts > 0 && attempts > c.opts.MaxConnectAttempts {
			return fmt.Errorf("exhausted maximum connection attempts (%d)", c.opts.MaxConnectAttempts)
		}

		err := c.connectAndStream(ctx, onConnected)
		if ctx.Err() != nil || c.isClosing() {
			c.Close()
			if c.isClosing() {
				return nil
			}
			return ctx.Err()
		}

		c.mu.Lock()
		c.connected = false
		c.mu.Unlock()

		if c.isClosing() {
			return nil
		}

		// Exponential backoff with jitter
		jitter := time.Duration(rand.Int63n(int64(backoff / 2)))
		sleepDuration := backoff + jitter
		if sleepDuration > c.opts.BackoffMax {
			sleepDuration = c.opts.BackoffMax
		}

		select {
		case <-ctx.Done():
			c.Close()
			return ctx.Err()
		case <-time.After(sleepDuration):
		}

		// Increase backoff for next retry
		backoff = time.Duration(float64(backoff) * 1.5)
		if backoff > c.opts.BackoffMax {
			backoff = c.opts.BackoffMax
		}
		_ = err
	}
}

func (c *Client) connectAndStream(ctx context.Context, onConnected func() error) error {
	var dialOpt grpc.DialOption
	if c.opts.TLSConfig != nil {
		dialOpt = grpc.WithTransportCredentials(credentials.NewTLS(c.opts.TLSConfig))
	} else {
		dialOpt = grpc.WithTransportCredentials(insecure.NewCredentials())
	}

	conn, err := grpc.NewClient(
		c.opts.Target,
		dialOpt,
		grpc.WithDefaultCallOptions(
			grpc.MaxCallRecvMsgSize(c.opts.MaxMessageSize),
			grpc.MaxCallSendMsgSize(c.opts.MaxMessageSize),
		),
	)
	if err != nil {
		return fmt.Errorf("failed to dial coordinator at %s: %w", c.opts.Target, err)
	}
	defer conn.Close()

	coordinatorClient := meshv1.NewMeshCoordinatorClient(conn)
	stream, err := coordinatorClient.Connect(ctx)
	if err != nil {
		return fmt.Errorf("failed to open stream to coordinator: %w", err)
	}

	c.mu.Lock()
	c.conn = conn
	c.stream = stream
	c.connected = true
	c.mu.Unlock()

	// Notify caller that stream is open (e.g. to send registration message)
	if onConnected != nil {
		if err := onConnected(); err != nil {
			return fmt.Errorf("post-connection hook failed: %w", err)
		}
	}

	// Run sender and receiver goroutines concurrently
	errChan := make(chan error, 2)
	streamCtx, cancelStream := context.WithCancel(ctx)
	defer cancelStream()

	// 1. Outbound sender
	go func() {
		for {
			select {
			case <-streamCtx.Done():
				return
			case msg := <-c.outbound:
				if err := stream.Send(msg); err != nil {
					errChan <- fmt.Errorf("stream send failed: %w", err)
					return
				}
			}
		}
	}()

	// 2. Inbound receiver
	go func() {
		for {
			in, err := stream.Recv()
			if err != nil {
				if err == io.EOF || streamCtx.Err() != nil {
					errChan <- nil
				} else {
					errChan <- fmt.Errorf("stream recv failed: %w", err)
				}
				return
			}
			c.dispatchIncomingMessage(in)
		}
	}()

	// Wait for stream error or context cancellation
	select {
	case <-ctx.Done():
		return ctx.Err()
	case err := <-errChan:
		return err
	}
}

func (c *Client) dispatchIncomingMessage(msg *meshv1.CoordinatorMessage) {
	if msg == nil || c.handler == nil {
		return
	}

	switch p := msg.Payload.(type) {
	case *meshv1.CoordinatorMessage_RegistrationAck:
		_ = c.handler.HandleRegistrationAck(p.RegistrationAck)
	case *meshv1.CoordinatorMessage_HeartbeatAck:
		_ = c.handler.HandleHeartbeatAck(p.HeartbeatAck)
	case *meshv1.CoordinatorMessage_JobAssignment:
		_ = c.handler.HandleJobAssignment(p.JobAssignment)
	case *meshv1.CoordinatorMessage_JobCancellation:
		_ = c.handler.HandleJobCancellation(p.JobCancellation)
	case *meshv1.CoordinatorMessage_Command:
		_ = c.handler.HandleCoordinatorCommand(p.Command)
	}
}

func (c *Client) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.closing = true
	c.connected = false
	if c.conn != nil {
		_ = c.conn.Close()
	}
}
