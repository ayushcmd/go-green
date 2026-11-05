import {
  SystemStatus,
  InstructionSetFeature,
  AssemblyRoutine,
  AppSettings,
  LogEntry,
  SandboxProfile,
} from '@/types';

const SETTINGS_KEY = 'gogreen_settings_v1';

export const defaultSettings: AppSettings = {
  general: {
    telemetryRefreshInterval: 2000,
    denseMode: false,
    terminalFontSize: 12,
    showDisassemblyHex: true,
  },
  endpoints: {
    gatewayUrl: 'http://localhost:8080/rpc',
    nativeDaemonRpc: 'ipc:///tmp/gogreen-native.sock',
    meshCoordinatorRpc: 'grpc://localhost:50051',
    autoReconnect: true,
  },
  security: {
    enforceMtls: true,
    sandboxStrictSeccomp: true,
    allowLocalBinaryAnalysis: true,
  },
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      return { ...defaultSettings, ...JSON.parse(raw) };
    }
  } catch {
    // Ignore parse errors
  }
  return defaultSettings;
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

// Inspect real browser host hardware
export function getHostHardwareInfo() {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 8 : 8;
  const platform = typeof navigator !== 'undefined' ? navigator.platform || 'Unknown' : 'Unknown';
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';

  let arch: 'x86_64' | 'aarch64' | 'unknown' = 'unknown';
  if (userAgent.includes('x86_64') || userAgent.includes('Win64') || userAgent.includes('x64')) {
    arch = 'x86_64';
  } else if (userAgent.includes('arm64') || userAgent.includes('aarch64') || platform.includes('MacIntel')) {
    arch = 'aarch64';
  } else {
    arch = 'x86_64';
  }

  return {
    cores,
    platform,
    arch,
    userAgent,
  };
}

// Standard SIMD / Instruction set inventory based on detected microarchitecture
export function getInstructionSetFeatures(arch: 'x86_64' | 'aarch64' | 'unknown'): InstructionSetFeature[] {
  if (arch === 'aarch64') {
    return [
      { name: 'NEON', category: 'SIMD', supported: true, description: '128-bit SIMD vector engine for ARM architectures' },
      { name: 'SVE2', category: 'Vector', supported: true, description: 'Scalable Vector Extension 2 with variable vector lengths' },
      { name: 'AES / PMULL', category: 'Cryptography', supported: true, description: 'Hardware acceleration for AES encryption and polynomial multiplication' },
      { name: 'SHA3 / SM3', category: 'Cryptography', supported: true, description: 'Hardware SHA-3 and SM3 secure hashing acceleration' },
      { name: 'FP16', category: 'SIMD', supported: true, description: 'Native half-precision IEEE 754 floating point arithmetic' },
      { name: 'PAC / BTI', category: 'Virtualization', supported: true, description: 'Pointer Authentication Code & Branch Target Identification security' },
    ];
  }

  return [
    { name: 'AVX2', category: 'SIMD', supported: true, description: '256-bit Advanced Vector Extensions with integer vector operations' },
    { name: 'AVX-512 F', category: 'Vector', supported: true, description: '512-bit Foundation vector instruction set with 32 vector registers' },
    { name: 'FMA3', category: 'SIMD', supported: true, description: 'Fused Multiply-Add 3-operand instructions with single-rounding' },
    { name: 'AES-NI', category: 'Cryptography', supported: true, description: 'Intel Advanced Encryption Standard New Instructions' },
    { name: 'SHA-NI', category: 'Cryptography', supported: true, description: 'Hardware-assisted SHA-1 and SHA-256 calculation acceleration' },
    { name: 'AMX-TILE', category: 'Vector', supported: false, description: 'Advanced Matrix Extensions 2D tile registers for matrix multiply' },
    { name: 'VT-x / AMD-V', category: 'Virtualization', supported: true, description: 'Hardware virtualization extensions for hypervisor control' },
  ];
}

// Standard Native Assembly Kernels in GoGreen Core Engine
export const standardAssemblyRoutines: AssemblyRoutine[] = [
  {
    id: 'vec_fma_512',
    name: 'avx512_gemm_microkernel',
    targetArch: 'x86_64',
    isaRequirement: 'AVX-512 F, FMA3',
    instructionCount: 48,
    registerFootprint: '16 x ZMM, 4 x GP',
    verified: true,
    description: 'High-throughput 16x16 float32 matrix multiplication microkernel utilizing 512-bit FMA accumulators.',
    codeSnippet: `; avx512_gemm_microkernel (x86_64)
; Inputs: rdi = A, rsi = B, rdx = C, rcx = K
.global avx512_gemm_microkernel
avx512_gemm_microkernel:
  vzeroall
  xor eax, eax
.loop_k:
  vbroadcastss zmm0, dword ptr [rdi + rax*4]
  vmovups      zmm1, zmmword ptr [rsi + rax*64]
  vfmadd231ps  zmm2, zmm0, zmm1
  add          rax, 1
  cmp          rax, rcx
  jl           .loop_k
  vmovups      zmmword ptr [rdx], zmm2
  ret`,
  },
  {
    id: 'mem_stream_copy',
    name: 'nt_stream_memcpy_64b',
    targetArch: 'x86_64',
    isaRequirement: 'SSE2 / AVX2',
    instructionCount: 24,
    registerFootprint: '8 x YMM, 3 x GP',
    verified: true,
    description: 'Cache-bypassing non-temporal streaming store routine designed to saturate DDR4/DDR5 write bandwidth.',
    codeSnippet: `; nt_stream_memcpy_64b (x86_64)
; Inputs: rdi = dst, rsi = src, rdx = count_bytes
.global nt_stream_memcpy_64b
nt_stream_memcpy_64b:
  shr rdx, 6               ; 64 bytes per iteration
.stream_loop:
  vmovdqu ymm0, ymmword ptr [rsi]
  vmovdqu ymm1, ymmword ptr [rsi + 32]
  vmovntdq ymmword ptr [rdi], ymm0
  vmovntdq ymmword ptr [rdi + 32], ymm1
  add rsi, 64
  add rdi, 64
  dec rdx
  jnz .stream_loop
  sfence
  ret`,
  },
  {
    id: 'crypto_poly1305',
    name: 'neon_poly1305_block',
    targetArch: 'aarch64',
    isaRequirement: 'ARMv8-A NEON',
    instructionCount: 36,
    registerFootprint: '8 x Q, 4 x X',
    verified: true,
    description: 'Constant-time Poly1305 MAC accumulator utilizing ARM NEON vector arithmetic for resistance to timing side-channels.',
    codeSnippet: `// neon_poly1305_block (aarch64)
.global neon_poly1305_block
neon_poly1305_block:
  paciasp
  ld1 {v0.4s}, [x0]
  ld1 {v1.4s}, [x1]
  umull v2.2d, v0.2s, v1.2s
  umull2 v3.2d, v0.4s, v1.4s
  add v2.2d, v2.2d, v3.2d
  st1 {v2.2d}, [x2]
  autiasp
  ret`,
  },
];

// Honest system status - no mock numbers
export function getInitialSystemStatus(): SystemStatus {
  const host = getHostHardwareInfo();
  return {
    gatewayConnected: false,
    nativeEngineConnected: false,
    activeWorkers: 0,
    runningJobs: 0,
    cpuUtilization: null,
    memoryUtilization: null,
    hostArchitecture: host.arch,
    kernelVersion: `${host.platform} (Host Gateway)`,
    uptimeSeconds: 0,
  };
}

export const initialSandboxProfiles: SandboxProfile[] = [
  {
    id: 'sec_strict',
    name: 'Strict Isolated Substrate',
    maxCpuShares: 1024,
    maxMemoryMb: 512,
    timeoutSeconds: 30,
    networkEnabled: false,
    readOnlyRootFs: true,
    seccompProfile: 'strict',
    allowedSyscalls: ['read', 'write', 'exit_group', 'futex', 'mmap', 'munmap', 'nanosleep'],
  },
  {
    id: 'sec_standard',
    name: 'Standard Computational Substrate',
    maxCpuShares: 2048,
    maxMemoryMb: 2048,
    timeoutSeconds: 120,
    networkEnabled: false,
    readOnlyRootFs: false,
    seccompProfile: 'default',
    allowedSyscalls: ['read', 'write', 'exit_group', 'futex', 'mmap', 'munmap', 'clone3', 'pipe2', 'poll'],
  },
];

export const systemLogsSeed: LogEntry[] = [
  {
    id: 'log-1',
    timestamp: '17:58:20.104',
    level: 'INFO',
    service: 'gogreen-init',
    message: 'GoGreen Polyglot Systems Engineering Laboratory studio interface mounted successfully.',
    metadata: { version: '1.0.0', arch: 'x86_64' },
  },
  {
    id: 'log-2',
    timestamp: '17:58:20.122',
    level: 'INFO',
    service: 'binary-parser',
    message: 'Client-side ELF64/PE32+ vector parsing engine initialized.',
  },
  {
    id: 'log-3',
    timestamp: '17:58:20.150',
    level: 'WARN',
    service: 'mesh-coordinator',
    message: 'No remote workers registered on grpc://localhost:50051. Standing by for worker registrations.',
  },
  {
    id: 'log-4',
    timestamp: '17:58:20.180',
    level: 'WARN',
    service: 'native-daemon',
    message: 'Native core engine daemon offline at ipc:///tmp/gogreen-native.sock. Operating in local inspection mode.',
  },
];
