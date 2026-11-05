# GoGreen Worker Agent Engineering Guide

## 1. Subsystem Architecture

The GoGreen Worker Agent (`services/worker-agent`) is built in pure Go with zero CGO runtime dependencies. It serves as the local edge agent on worker machines.

```
services/worker-agent/
├── cmd/
│   └── worker/
│       └── main.go                  # Entry point, flag parsing & signal handling
├── internal/
│   ├── config/                      # Configuration structures & env variable binding
│   ├── hardware/                    # Hardware discovery & native daemon query
│   ├── nativeclient/                # Typed HTTP client for Phase 2 C++ engine
│   ├── security/                    # TLS/mTLS configuration & dev PKI generator
│   ├── executor/                    # Workload validation, deadline enforcement & execution
│   ├── grpcclient/                  # Persistent streaming client with backoff reconnect
│   └── agent/                       # Core worker agent lifecycle & state management
├── proto/                           # Generated Go Protobuf & gRPC bindings
├── tests/                           # Unit & full integration test suite with mock coordinator
├── go.mod
└── README.md
```

## 2. Reconnection & Resilience Engine

The worker agent implements an exponential backoff loop with randomized jitter:
- Minimum backoff: 500ms (configurable)
- Maximum backoff: 15s (configurable)
- Backoff multiplier: 1.5x
- Jitter factor: $\text{rand}(0, \frac{\text{backoff}}{2})$

When connection loss occurs, the agent detects stream closure, safely flushes internal queues, initiates backoff sleeps, re-establishes the HTTP/2 transport channel, and automatically re-registers its current state with the coordinator.
