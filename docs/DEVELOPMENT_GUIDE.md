# GoGreen Development & Engineering Guide

## 1. Prerequisites
- **Frontend Studio:** Node.js >= 20.x, npm >= 10.x
- **Native Subsystem:** Linux / WSL2 environment with GCC >= 14 (with C++23 support), NASM >= 2.16, CMake >= 3.20, Make

## 2. Quickstart

### Frontend Studio
```bash
# Clone the repository
git clone https://github.com/ayushcmd/go-green.git
cd go-green

# Install dependencies
npm install

# Start development server
npm run dev

# Run unit tests
npm test

# Run TypeScript checks
npm run typecheck

# Run linting
npm run lint

# Build for production
npm run build

# Run Playwright end-to-end tests
npx playwright test
```

### Native Core Engine & Assembly Kernels (Linux / WSL2)
```bash
# Enter native subsystem directory
cd native

# Create build directory and run CMake
mkdir -p build && cd build
cmake ..
make -j4

# Run native test suites
ctest --output-on-failure

# Launch the GoGreen Native Daemon on port 8080
./core-engine/gogreen-daemon --port 8080
```

## 3. Directory Layout
```
go-green/
├── native/                    # C++23 & NASM native engineering subsystem
│   ├── asm-kernels/           # Hand-crafted x86-64 assembly routines & fallbacks
│   ├── core-engine/           # CPUID, XCR0, hardware telemetry, benchmark engine & daemon
│   └── CMakeLists.txt         # Subsystem build manifest
├── docs/                      # Technical architecture and design docs
├── src/
│   ├── app/                   # Root App, Router, and Providers
│   ├── components/
│   │   ├── charts/            # Recharts analytical components
│   │   ├── layout/            # AppShell, Sidebar, Topbar, Breadcrumbs
│   │   ├── terminal/          # Terminal, CodeViewer, HexViewer
│   │   └── ui/                # Core UI design primitives
│   ├── pages/                 # All 10 studio modules (Overview, Core Engine, Profiler, etc.)
│   ├── services/              # Native daemon client, binary parser, local storage
│   ├── styles/                # Global CSS and Tailwind directives
│   └── types/                 # Strict TypeScript domain interfaces
├── public/                    # Static assets, favicon, logo
├── index.html                 # Main entry HTML
├── tailwind.config.js         # NVIDIA green color palette & font configuration
├── vite.config.ts             # Vite build & Vitest test configuration
└── tsconfig.json              # Strict TypeScript compiler options
```

## 4. Architectural Rules
1. **Never fabricate operational data:** If a subsystem is offline, display `Not connected` or `Waiting for connection`. When connected, display genuine measured values.
2. **Strict prohibition of temporary prototype labels:** Prohibited words ("Demo", "Dummy", "Demo Mode", "Prototype", "Foundation", "Foundation Phase", "Development Stage", "Under Development", "Coming Soon", "Placeholder", "Mock Dashboard", "Sample Data", "Test Dashboard") are strictly forbidden anywhere in user-facing views.
3. **OS environment honesty:** When the native daemon runs inside Linux (including WSL2), report the OS as `Linux (WSL2)` with the actual Linux kernel release. Never report Windows as the native daemon's operating system.
4. **Local network isolation:** Bind native daemons strictly to `127.0.0.1`. Never expose raw interfaces without authentication.
