export type Architecture = 'x86_64' | 'aarch64' | 'riscv64' | 'unknown';

export type OperationalState = 
  | 'connected'
  | 'disconnected'
  | 'standby'
  | 'no_workers'
  | 'no_data'
  | 'degraded';

export interface SystemStatus {
  gatewayConnected: boolean;
  nativeEngineConnected: boolean;
  activeWorkers: number;
  runningJobs: number;
  cpuUtilization: number | null;
  memoryUtilization: number | null;
  hostArchitecture: Architecture;
  kernelVersion: string;
  uptimeSeconds: number;
}

export interface InstructionSetFeature {
  name: string;
  category: 'SIMD' | 'Vector' | 'Cryptography' | 'Virtualization' | 'Base';
  supported: boolean;
  os_supported?: boolean;
  active?: boolean;
  description: string;
}

export interface NativeCpuInfo {
  vendor: string;
  brand: string;
  architecture: Architecture;
  family: number;
  model: number;
  stepping: number;
  logical_cores: number;
  physical_cores: number;
  cache: {
    l1d_kb: number;
    l1i_kb: number;
    l2_kb: number;
    l3_kb: number;
  };
}

export interface NativeFeatureDetail {
  name: string;
  category: 'SIMD' | 'Vector' | 'Cryptography' | 'Virtualization' | 'Base';
  hw_supported: boolean;
  os_supported: boolean;
  active: boolean;
  description: string;
}

export interface NativeHostInfo {
  os_name: string;
  os_release: string;
  kernel_version: string;
  hostname: string;
  runtime_environment: string;
  uptime_seconds: number;
  load_avg: {
    '1m': number;
    '5m': number;
    '15m': number;
  };
  memory: {
    total_bytes: number;
    free_bytes: number;
    available_bytes: number;
    swap_total_bytes: number;
    swap_free_bytes: number;
  };
  perf_event_supported: boolean;
  perf_event_status: string;
}

export interface NativeBenchmarkMetric {
  id: string;
  name: string;
  category: string;
  implementation: string;
  input_size_bytes: number;
  iterations: number;
  duration_ms: number;
  throughput_ops_sec: number;
  throughput_mb_sec: number;
  min_ns: number;
  max_ns: number;
  median_ns: number;
  p90_ns: number;
  p99_ns: number;
  timestamp: string;
  verified_correct: boolean;
}

export interface NativeDaemonHealth {
  status: 'healthy' | 'unhealthy';
  initialized: boolean;
  uptime_seconds: number;
  engine_version: string;
  timestamp: string;
}

export interface NativeTelemetrySnapshot {
  timestamp: string;
  uptime_seconds: number;
  system: {
    load_1m: number;
    load_5m: number;
    load_15m: number;
    memory: {
      total_bytes: number;
      available_bytes: number;
      free_bytes: number;
      used_bytes: number;
      used_percent: number;
    };
    perf_event_supported: boolean;
  };
}

export interface AssemblyRoutine {
  id: string;
  name: string;
  targetArch: Architecture;
  isaRequirement: string;
  instructionCount: number;
  registerFootprint: string;
  verified: boolean;
  description: string;
  codeSnippet: string;
}

export interface BinarySection {
  name: string;
  virtualAddress: string;
  virtualSize: number;
  rawSize: number;
  entropy: number;
  flags: string;
  isExecutable: boolean;
  isWritable: boolean;
}

export interface BinarySymbol {
  name: string;
  address: string;
  size: number;
  type: 'FUNC' | 'OBJECT' | 'IMPORT' | 'EXPORT' | 'NOTYPE';
  binding: 'GLOBAL' | 'LOCAL' | 'WEAK';
  section: string;
}

export interface DisassemblyInstruction {
  address: string;
  bytes: string;
  mnemonic: string;
  operands: string;
  comment?: string;
}

export interface BinaryAnalysisResult {
  fileName: string;
  fileSize: number;
  format: 'ELF64' | 'ELF32' | 'PE32+' | 'PE32' | 'Mach-O' | 'RAW';
  architecture: Architecture;
  entryPoint: string;
  endianness: 'Little Endian' | 'Big Endian';
  sections: BinarySection[];
  symbols: BinarySymbol[];
  disassembly: DisassemblyInstruction[];
  sha256: string;
  magicBytes: string;
  rawBuffer?: ArrayBuffer;
}

export interface BenchmarkResult {
  id: string;
  name: string;
  category: 'CPU' | 'Memory' | 'IPC' | 'Throughput';
  targetRoutine: string;
  iterations: number;
  durationMs: number;
  throughputOpsSec: number;
  cyclesPerOp: number;
  l1MissRate: number;
  branchMissRate: number;
  timestamp: string;
}

export interface WorkerNode {
  id: string;
  hostname: string;
  ipAddress: string;
  architecture: Architecture;
  logicalCores: number;
  totalMemoryMb: number;
  status: 'ONLINE' | 'BUSY' | 'OFFLINE' | 'DEGRADED';
  heartbeatLatencyMs: number;
  assignedJobs: number;
  lastHeartbeat: string;
}

export interface MeshJob {
  id: string;
  name: string;
  submittedAt: string;
  workerId?: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  executionTimeMs?: number;
}

export interface SandboxProfile {
  id: string;
  name: string;
  maxCpuShares: number;
  maxMemoryMb: number;
  timeoutSeconds: number;
  networkEnabled: boolean;
  readOnlyRootFs: boolean;
  seccompProfile: 'strict' | 'default' | 'permissive';
  allowedSyscalls: string[];
}

export interface SystemProcess {
  pid: number;
  name: string;
  user: string;
  cpuPercent: number;
  memoryMb: number;
  threads: number;
  state: 'Running' | 'Sleeping' | 'Zombie' | 'Stopped';
}

export interface Experiment {
  id: string;
  title: string;
  category: string;
  compiler: string;
  optimizationLevel: '-O0' | '-O1' | '-O2' | '-O3' | '-Ofast';
  isaExtension: string;
  createdAt: string;
  sha256Hash: string;
  reproducible: boolean;
  notes: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'PANIC';
  service: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface AppSettings {
  general: {
    telemetryRefreshInterval: number;
    denseMode: boolean;
    terminalFontSize: number;
    showDisassemblyHex: boolean;
  };
  endpoints: {
    gatewayUrl: string;
    nativeDaemonRpc: string;
    meshCoordinatorRpc: string;
    autoReconnect: boolean;
  };
  security: {
    enforceMtls: boolean;
    sandboxStrictSeccomp: boolean;
    allowLocalBinaryAnalysis: boolean;
  };
}


export interface BinaryRelocation {
  offset: string;
  typeName: string;
  symbolName: string;
  addend: number;
  sectionName: string;
}

export interface ExtractedString {
  value: string;
  offset: number;
  length: number;
  category: 'URL' | 'Path' | 'Format' | 'Symbol' | 'Generic';
}

export interface EntropyAnalysisData {
  overall: number;
  chiSquare: number;
  meanByte: number;
  assessment: string;
  blocks: Array<{ offset: number; entropy: number }>;
  distribution: number[];
}

export interface CompilerResultData {
  success: boolean;
  compiler: string;
  compilerVersion: string;
  optimizationLevel: string;
  assemblyOutput: string;
  instructions: Array<{ sourceLine: number; text: string }>;
  errorOutput: string;
  compilationTimeMs: number;
}

export interface BinaryDiffData {
  fileAName: string;
  fileBName: string;
  sizeA: number;
  sizeB: number;
  sizeDelta: number;
  sha256A: string;
  sha256B: string;
  formatA: string;
  formatB: string;
  similarityPercent: number;
  identicalBytes: number;
  differentBytes: number;
  byteDifferences: Array<{ offset: number; length: number; hexA: string; hexB: string }>;
  sectionDifferences: Array<{ name: string; status: string; sizeA: number; sizeB: number; entropyA: number; entropyB: number }>;
  symbolDifferences: Array<{ name: string; changeType: string; addressA: number; addressB: number }>;
}
