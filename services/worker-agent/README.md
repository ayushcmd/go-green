# GoGreen Mesh Worker Agent

The GoGreen Worker Agent is the native edge execution daemon in the GoGreen Polyglot Systems Engineering Laboratory. Built in Go, it connects edge hardware nodes to the Java Control Plane Coordinator via persistent gRPC bidirectional streaming, executes native compute kernels via the Phase 2 C++ engine, and streams real-time hardware telemetry.

## Responsibilities

1. **Host & CPU Discovery**:
   - Queries the local Phase 2 native daemon (`http://127.0.0.1:8080`) for genuine CPU vendor, model, physical/logical core counts, and verified SIMD instruction sets (`AVX`, `AVX2`, `AVX-512`, `FMA`, `BMI1`, `BMI2`).
   - Fallback to Go runtime discovery if the native engine is temporarily unreachable.
2. **Registration & Persistent Heartbeats**:
   - Transmits hardware capabilities to the coordinator on startup.
   - Streams sequence-numbered heartbeats with CPU usage, memory utilization, and native daemon health status.
3. **Strict Sandboxed Execution**:
   - Dispatches only authorized workload types (`WORKLOAD_TYPE_CPU_INFORMATION`, `WORKLOAD_TYPE_SYSTEM_TELEMETRY`, `WORKLOAD_TYPE_NATIVE_BENCHMARK_SUITE`).
   - Forbids arbitrary shell command execution.
   - Forwards execution tasks directly to the local C++ engine.
4. **Resilience & Fault Tolerance**:
   - Automatic reconnect loop with exponential backoff and randomized jitter.
   - Thread-safe outbound message queue.
   - Graceful shutdown propagation (`WorkerShutdownNotification`).
5. **Mutual TLS (mTLS)**:
   - Complete TLS 1.3/1.2 authentication with self-signed development PKI generator.

## CLI Usage

```bash
# Run worker agent with default configuration (connects to coordinator on 127.0.0.1:50051)
./bin/gogreen-worker.exe

# Run with custom parameters
./bin/gogreen-worker.exe \
  -worker-id "worker-node-alpha" \
  -coordinator "coordinator.internal:50051" \
  -native-url "http://127.0.0.1:8080" \
  -heartbeat 3s

# Generate local self-signed development PKI (Root CA, server cert, worker cert)
./bin/gogreen-worker.exe -generate-dev-pki ./certs

# Run with Mutual TLS enabled
./bin/gogreen-worker.exe \
  -mtls \
  -ca-file ./certs/ca.crt \
  -cert-file ./certs/worker.crt \
  -key-file ./certs/worker.key
```

## Testing

```bash
cd services/worker-agent
go test -v ./...
```
