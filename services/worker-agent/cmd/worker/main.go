package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/ayushcmd/go-green/services/worker-agent/internal/agent"
	"github.com/ayushcmd/go-green/services/worker-agent/internal/config"
	"github.com/ayushcmd/go-green/services/worker-agent/internal/security"
)

func main() {
	cfg := config.LoadFromEnv()

	var (
		flagWorkerID       = flag.String("worker-id", cfg.WorkerID, "Unique identifier for this worker agent")
		flagCoordinator    = flag.String("coordinator", cfg.CoordinatorEndpoint, "Host:port of the gRPC coordinator")
		flagNativeURL      = flag.String("native-url", cfg.NativeDaemonURL, "URL of the local Phase 2 native daemon")
		flagHeartbeat      = flag.Duration("heartbeat", cfg.HeartbeatInterval, "Heartbeat reporting interval")
		flagTLS            = flag.Bool("tls", cfg.TLSEnabled, "Enable TLS connection to coordinator")
		flagMTLS           = flag.Bool("mtls", cfg.MTLSEnabled, "Enable mutual TLS (client cert authentication)")
		flagCACert         = flag.String("ca-file", cfg.TLSCAFile, "Path to CA root certificate")
		flagCertFile       = flag.String("cert-file", cfg.TLSCertFile, "Path to worker client certificate")
		flagKeyFile        = flag.String("key-file", cfg.TLSKeyFile, "Path to worker client private key")
		flagGenerateDevPKI = flag.String("generate-dev-pki", "", "Generate local self-signed dev PKI in target folder and exit")
	)
	flag.Parse()

	if *flagGenerateDevPKI != "" {
		log.Printf("[SECURITY] Generating development PKI certificates into: %s", *flagGenerateDevPKI)
		if _, err := security.GenerateDevCertificates(*flagGenerateDevPKI); err != nil {
			log.Fatalf("[FATAL] Failed to generate development PKI: %v", err)
		}
		log.Println("[SECURITY] Development PKI successfully generated (Root CA, Coordinator Server Cert, Worker Client Cert).")
		return
	}

	cfg.WorkerID = *flagWorkerID
	cfg.CoordinatorEndpoint = *flagCoordinator
	cfg.NativeDaemonURL = *flagNativeURL
	cfg.HeartbeatInterval = *flagHeartbeat
	cfg.TLSEnabled = *flagTLS || *flagMTLS
	cfg.MTLSEnabled = *flagMTLS
	cfg.TLSCAFile = *flagCACert
	cfg.TLSCertFile = *flagCertFile
	cfg.TLSKeyFile = *flagKeyFile

	log.Println("================================================================================")
	log.Println("             GoGreen Mesh Worker Agent — Phase 3 Distributed Engine             ")
	log.Println("================================================================================")
	log.Printf("Worker ID           : %s", cfg.WorkerID)
	log.Printf("Coordinator Target  : %s", cfg.CoordinatorEndpoint)
	log.Printf("Native Daemon URL   : %s", cfg.NativeDaemonURL)
	log.Printf("Heartbeat Interval  : %v", cfg.HeartbeatInterval)
	log.Printf("TLS / mTLS Enabled  : %v / %v", cfg.TLSEnabled, cfg.MTLSEnabled)
	log.Println("--------------------------------------------------------------------------------")

	workerAgent, err := agent.NewAgent(cfg, nil)
	if err != nil {
		log.Fatalf("[FATAL] Failed to initialize worker agent: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	errChan := make(chan error, 1)
	go func() {
		if err := workerAgent.Start(ctx); err != nil {
			errChan <- err
		}
	}()

	select {
	case sig := <-sigChan:
		log.Printf("[INFO] Received termination signal (%v), commencing graceful shutdown...", sig)
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer shutdownCancel()
		_ = workerAgent.Shutdown(shutdownCtx, fmt.Sprintf("OS Signal: %v", sig))
		cancel()
		log.Println("[INFO] GoGreen Worker Agent cleanly stopped.")

	case err := <-errChan:
		log.Printf("[ERROR] Worker agent stopped with error: %v", err)
	}
}
