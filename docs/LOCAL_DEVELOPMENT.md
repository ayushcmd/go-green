# GoGreen Local Development Guide

This guide details the prerequisites, toolchain installation, build procedures, local runtime modes, test execution, and troubleshooting steps for the GoGreen polyglot workspace.

---

## 1. Environment & Prerequisites

GoGreen is a polyglot systems project combining low-level Linux systems programming with high-level distributed services and a modern web dashboard.

### 1.1 Operating Systems & Kernel Requirements
- **Host OS:** Windows 11 (build 22621+ recommended) or Ubuntu 24.04+ LTS.
- **Linux Environment (for Windows):** WSL2 with Linux kernel version `6.6.x` or later.
  ```powershell
  # Check WSL kernel version
  wsl --status
  wsl uname -r
  ```
- **cgroups v2 Support:** Linux kernel must mount cgroups v2 at `/sys/fs/cgroup`.

### 1.2 Required Toolchains

| Toolchain | Minimum Version | Verification Command | Purpose |
| :--- | :--- | :--- | :--- |
| **C++ Compiler** | `clang++-18` or `g++-14` | `clang++ --version` / `g++ --version` | C++23 native core & BinaryLab |
| **NASM** | `2.16.x` | `nasm -v` | x86-64 assembly kernels |
| **CMake** | `3.28+` | `cmake --version` | Native subsystem builds |
| **Capstone** | `5.0.x` | `pkg-config --modversion capstone` | Disassembly engine |
| **Go** | `1.23+` | `go version` | Worker agent daemon |
| **OpenJDK** | `25-ea` or `21 LTS` | `java -version` | Control plane coordinator |
| **Apache Maven** | `3.9+` | `mvn -v` | Control plane build system |
| **Rust & Cargo** | `1.84+` (2021 edition) | `rustc --version` | Hardened sandbox supervisor |
| **Node.js & npm** | Node `20.x+`, npm `10.x+` | `node -v` / `npm -v` | Studio React dashboard |

---

## 2. Repository Layout

```
go-green/
├── contracts/protobuf/        # Protobuf v1 contracts (coordinator, worker, job, etc.)
├── docs/                      # Architectural specs, API references, security models
│   ├── assets/                # Genuine Studio UI screenshots
│   ├── ARCHITECTURE.md        # Deep system architecture & dataflows
│   ├── API_REFERENCE.md       # Complete HTTP & gRPC API reference
│   ├── LOCAL_DEVELOPMENT.md   # This setup and run guide
│   └── SECURITY.md            # Threat model, sandbox isolation & mTLS
├── native/                    # C++23 & NASM native subsystems
│   ├── asm-kernels/           # Hand-crafted x86-64 NASM SIMD kernels
│   ├── core-engine/           # CPUID, load monitor, micro-benchmark daemon
│   └── binary-lab/            # ELF/PE parser, Capstone disassembler, compiler explorer
├── services/                  # Distributed microservices
│   ├── control-plane/         # Java 25 / Spring Boot 3.4 gRPC coordinator
│   ├── worker-agent/          # Go 1.23 distributed worker daemon
│   └── sandbox-manager/       # Rust Tokio hardened Linux sandbox supervisor
├── src/                       # React 18 + TypeScript + Tailwind Studio UI
├── package.json               # Frontend dependencies & scripts
├── vite.config.ts             # Vite bundler configuration
└── .env.example               # Environment variables template
```

---

## 3. Subsystem Build Instructions

### 3.1 Studio Frontend (React 18 + TypeScript)
```bash
# In repository root
npm install

# Run type checker
npm run type-check

# Run production build
npm run build
```

### 3.2 Native Subsystems (C++23 & NASM)
Run within your Linux environment (WSL2 or native Linux):
```bash
# Navigate to native build directory
cd native
mkdir -p build && cd build

# Configure with CMake (enabling C++23 standard)
cmake -DCMAKE_BUILD_TYPE=Release ..

# Compile all native targets:
# - asm_kernels (static library)
# - test_asm_kernels (GoogleTest binary)
# - gogreen-core-engine (static library)
# - gogreen-daemon (HTTP micro-daemon executable)
# - test_core_engine (GoogleTest binary)
# - gogreen_binary_lab (static library)
# - test_binary_lab (GoogleTest binary)
cmake --build . -j$(nproc)
```

### 3.3 Go Worker Agent (`services/worker-agent`)
```bash
cd services/worker-agent

# Download Go module dependencies
go mod download

# Build worker agent executable
go build -v -o bin/worker-agent ./cmd/worker-agent

# Execute unit tests
go test -v ./...
```

### 3.4 Java Control Plane (`services/control-plane`)
```bash
cd services/control-plane

# Compile and package Spring Boot executable jar
mvn clean package -DskipTests=false

# Run unit tests
mvn test
```

### 3.5 Rust Sandbox Supervisor (`services/sandbox-manager`)
Run within Linux (WSL2 or native Linux):
```bash
cd services/sandbox-manager

# Build in debug or release mode
cargo build --release

# Run Rust unit tests
cargo test
```

---

## 4. Local Execution Modes

### Mode 1: Quickstart Studio UI (Mock / Offline Mode)
Ideal for UI/UX inspection and frontend development:
```bash
# In repository root
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser. The Studio automatically connects to live services if running, or gracefully surfaces offline fallbacks.

---

### Mode 2: Hybrid Native Development (WSL2 + Windows Studio)
Enables the live Native Core Engine daemon to serve hardware CPUID, memory telemetry, and micro-benchmarks to the Studio UI:

1. **Start C++23 Native Daemon (in WSL2):**
   ```bash
   cd native/build/core-engine
   ./gogreen-daemon --port 8080
   ```
   *Verify it responds:*
   ```bash
   curl http://127.0.0.1:8080/api/v1/health
   curl http://127.0.0.1:8080/api/v1/cpu
   ```

2. **Start Studio UI (in Windows or Linux):**
   ```bash
   npm run dev
   ```
   Navigate to the **Core Engine** page in Studio. It will display live CPUID data, instruction sets, and live benchmark timings directly from the native daemon.

---

### Mode 3: Full Distributed Mesh & Hardened Sandbox
Runs all five tiers of the polyglot laboratory:

1. **Start C++ Native Daemon:**
   ```bash
   native/build/core-engine/gogreen-daemon --port 8080
   ```

2. **Start Rust Sandbox Supervisor (requires Linux root or cap_sys_admin for namespaces):**
   ```bash
   cd services/sandbox-manager
   cargo run --release
   ```
   *Listens on `127.0.0.1:8081`.*

3. **Start Java Control Plane:**
   ```bash
   cd services/control-plane
   mvn spring-boot:run
   ```
   *Listens on REST `0.0.0.0:8082` and gRPC `0.0.0.0:50051`.*

4. **Start Go Worker Agent:**
   ```bash
   cd services/worker-agent
   GOGREEN_COORDINATOR_ENDPOINT=127.0.0.1:50051 GOGREEN_NATIVE_DAEMON_URL=http://127.0.0.1:8080 ./bin/worker-agent
   ```
   *The worker registers its hardware with the coordinator and begins sending heartbeats.*

5. **Start Studio UI:**
   ```bash
   npm run dev
   ```

---

## 5. Running Test Suites

Verify all subsystems across the polyglot stack:

```bash
# 1. Frontend Test Suite (Vitest)
npm test -- --run

# 2. Worker Agent Test Suite (Go)
cd services/worker-agent && go test -v ./... && cd ../..

# 3. Control Plane Test Suite (Java / Maven)
cd services/control-plane && mvn test && cd ../..

# 4. Native Subsystems Test Suite (GoogleTest)
cd native/build && ctest --output-on-failure && cd ../..

# 5. Sandbox Supervisor Test Suite (Rust / Cargo)
cd services/sandbox-manager && cargo test && cd ../..
```

---

## 6. Troubleshooting Common Issues

### 6.1 Port Conflict (`Address in use :8080` or `:8081`)
- **Symptom:** Native daemon fails to bind to port 8080 or control plane fails on 8081/8082.
- **Cause:** A previous instance or Docker container (e.g., cAdvisor) is holding the port.
- **Resolution:**
  ```powershell
  # On Windows: Find process on port 8080
  netstat -ano | findstr :8080
  # Stop conflicting process or container
  docker stop <conflicting_container>
  ```

### 6.2 WSL2 Filesystem Mount (`No such file or directory`)
- **Symptom:** In Alpine chroot or custom container under WSL2, Windows `/mnt/c` paths are not visible.
- **Resolution:** Bind mount the Windows drive into the root filesystem:
  ```bash
  mount --bind /mnt/c /mnt/c/wsl-alpine/c
  ```

### 6.3 cgroups v2 Delegation
- **Symptom:** Sandbox supervisor reports `Failed to write to /sys/fs/cgroup/gogreen`.
- **Cause:** User does not have write access to the root cgroup hierarchy.
- **Resolution:** Ensure the supervisor runs as root or grant delegated control over `/sys/fs/cgroup/gogreen` to the executing user:
  ```bash
  sudo mkdir -p /sys/fs/cgroup/gogreen
  sudo chown -R $USER:$USER /sys/fs/cgroup/gogreen
  ```
