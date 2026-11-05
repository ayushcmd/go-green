# GoGreen Worker Security & Zero-Trust Architecture

## 1. Threat Model & Security Posture

Distributed execution systems run the severe risk of arbitrary remote code execution (RCE) if workload contracts allow untrusted command execution. GoGreen enforces a strict multi-layer defense-in-depth model:

1. **No Arbitrary Command Execution**:
   - The worker agent rejects all free-form shell or process execution requests.
   - Only pre-compiled, statically typed workload categories defined in `gogreen.mesh.v1.WorkloadType` are accepted.
2. **Payload Size Hard Limits**:
   - Payloads exceeding `4 MB` (`MaxPayloadBytes`) are rejected immediately before parsing.
3. **Local Loopback Boundary**:
   - The Phase 2 C++ Native Core Engine binds strictly to `127.0.0.1:8080`. It is never exposed over public or routable network interfaces.
   - Only the local Go worker agent communicates with the C++ engine over localhost.

## 2. Mutual TLS (mTLS)

GoGreen requires or supports full mutual TLS (mTLS) for all control plane communication:
- **Server Identity**: The coordinator presents a server certificate containing valid SANs (`localhost`, cluster DNS names).
- **Client Identity**: The worker agent presents a client certificate signed by the mesh Root CA.
- **Strict Verification**: `InsecureSkipVerify` is permanently forbidden (`false`). All certificates must validate against the trusted root pool.
- **Modern Cipher Suites**: Enforces TLS 1.2 minimum version, defaulting to TLS 1.3.

## 3. Development PKI Generator

To streamline development and integration testing without requiring external OpenSSL scripts, the worker agent includes a built-in cryptographic PKI generator:

```bash
./bin/gogreen-worker.exe -generate-dev-pki ./certs
```

This generates:
- `ca.crt`, `ca.key`: 2048-bit RSA Root Certificate Authority (10-year validity).
- `server.crt`, `server.key`: Coordinator Server certificate with `ExtKeyUsageServerAuth` and SANs.
- `worker.crt`, `worker.key`: Worker Client certificate with `ExtKeyUsageClientAuth`.
