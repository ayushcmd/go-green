import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CodeViewer } from '@/components/terminal/CodeViewer';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import {
  Cpu,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import {
  getHostHardwareInfo,
  getInstructionSetFeatures,
  standardAssemblyRoutines,
  fetchNativeHealth,
  fetchNativeCpu,
  fetchNativeFeatures,
  triggerNativeBenchmark,
} from '@/services/systemService';
import {
  AssemblyRoutine,
  InstructionSetFeature,
  NativeCpuInfo,
  NativeFeatureDetail,
  NativeDaemonHealth,
  NativeBenchmarkMetric,
} from '@/types';

export const CoreEnginePage: React.FC = () => {
  const host = getHostHardwareInfo();
  const fallbackFeatures = getInstructionSetFeatures(host.arch);

  const [daemonHealth, setDaemonHealth] = useState<NativeDaemonHealth | null>(null);
  const [nativeCpu, setNativeCpu] = useState<NativeCpuInfo | null>(null);
  const [nativeFeatures, setNativeFeatures] = useState<NativeFeatureDetail[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const [selectedRoutine, setSelectedRoutine] = useState<AssemblyRoutine>(standardAssemblyRoutines[0]!);
  const [isExecuting, setIsExecuting] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState<NativeBenchmarkMetric | null>(null);
  const [executionMessage, setExecutionMessage] = useState<{ type: 'success' | 'warn'; text: string } | null>(null);

  useEffect(() => {
    let mounted = true;

    const pollDaemon = async () => {
      const health = await fetchNativeHealth();
      if (!mounted) return;

      if (health.connected && health.data) {
        setIsConnected(true);
        setDaemonHealth(health.data);

        const [cpuData, featsData] = await Promise.all([
          fetchNativeCpu(),
          fetchNativeFeatures(),
        ]);

        if (!mounted) return;
        if (cpuData) setNativeCpu(cpuData);
        if (featsData && featsData.length > 0) setNativeFeatures(featsData);
      } else {
        setIsConnected(false);
        setDaemonHealth(null);
        setNativeCpu(null);
        setNativeFeatures([]);
      }
    };

    pollDaemon();
    const interval = setInterval(pollDaemon, 3000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleExecuteBenchmark = async () => {
    setIsExecuting(true);
    setExecutionMessage(null);
    setBenchmarkResult(null);

    if (!isConnected) {
      setTimeout(() => {
        setIsExecuting(false);
        setExecutionMessage({
          type: 'warn',
          text: 'Execution halted: Native engine daemon is not connected. Start gogreen-daemon on 127.0.0.1:8080 to run bare-metal assembly kernels.',
        });
      }, 500);
      return;
    }

    try {
      // Map routine id to benchmark type
      let type = 'int-add';
      if (selectedRoutine.id === 'asm_memcpy') type = 'memcpy';
      else if (selectedRoutine.id === 'asm_byte_sum') type = 'byte-sum';
      else if (selectedRoutine.id === 'asm_simd_add_f32') type = 'simd-add';

      const results = await triggerNativeBenchmark(type, true);
      setIsExecuting(false);

      if (results.length > 0 && results[0]) {
        const metric = results[0];
        setBenchmarkResult(metric);
        setExecutionMessage({
          type: 'success',
          text: `Executed ${metric.name} via ${metric.implementation}: Verified ${metric.verified_correct ? 'CORRECT' : 'FAILED'} in ${metric.duration_ms.toFixed(2)}ms (${metric.throughput_ops_sec.toLocaleString(undefined, { maximumFractionDigits: 0 })} ops/sec, ${metric.throughput_mb_sec.toFixed(1)} MB/s, median ${metric.median_ns.toFixed(1)} ns).`,
        });
      } else {
        setExecutionMessage({
          type: 'warn',
          text: 'Benchmark completed with empty result from native daemon.',
        });
      }
    } catch {
      setIsExecuting(false);
      setExecutionMessage({
        type: 'warn',
        text: 'Failed to communicate with native daemon during benchmark execution.',
      });
    }
  };

  // Harmonized feature list: prefer genuine native features if available
  const displayFeatures: InstructionSetFeature[] = nativeFeatures.length > 0
    ? nativeFeatures.map((f) => ({
        name: f.name,
        category: f.category,
        supported: f.active,
        os_supported: f.os_supported,
        active: f.active,
        description: f.description,
      }))
    : fallbackFeatures;

  return (
    <div className="space-y-6">
      {/* Top Banner: CPU Architecture & Silicon Characteristics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card noPadding>
          <div className="p-4">
            <div className="text-[11px] font-mono text-gogreen-text-secondary uppercase">
              Host Architecture & Model
            </div>
            <div className="text-xl font-mono font-bold text-gogreen-bright mt-1 uppercase flex items-center gap-2">
              <Cpu className="w-5 h-5 text-gogreen-primary" />
              {nativeCpu?.architecture || host.arch}
            </div>
            <div className="text-[11px] text-gogreen-text-secondary mt-1 truncate">
              {nativeCpu ? `${nativeCpu.vendor} — ${nativeCpu.brand}` : host.platform}
            </div>
          </div>
          <div className="px-4 py-2 bg-gogreen-bg-secondary/40 border-t border-gogreen-border/60 text-[11px] font-mono flex justify-between">
            <span className="text-gogreen-text-secondary">Execution Model</span>
            <span className="text-gogreen-text-primary">
              {nativeCpu ? `Family ${nativeCpu.family} Model ${nativeCpu.model} Stepping ${nativeCpu.stepping}` : 'Out-of-Order Speculative'}
            </span>
          </div>
        </Card>

        <Card noPadding>
          <div className="p-4">
            <div className="text-[11px] font-mono text-gogreen-text-secondary uppercase">
              Hardware Cores & Cache
            </div>
            <div className="text-xl font-mono font-bold text-gogreen-text-primary mt-1">
              {nativeCpu ? `${nativeCpu.physical_cores}P / ${nativeCpu.logical_cores}L Cores` : `${host.cores} Threads`}
            </div>
            <div className="text-[11px] text-gogreen-text-secondary mt-1">
              {nativeCpu
                ? `L1: ${nativeCpu.cache.l1d_kb}K / L2: ${nativeCpu.cache.l2_kb}K / L3: ${nativeCpu.cache.l3_kb / 1024}MB`
                : 'Hardware concurrency level'}
            </div>
          </div>
          <div className="px-4 py-2 bg-gogreen-bg-secondary/40 border-t border-gogreen-border/60 text-[11px] font-mono flex justify-between">
            <span className="text-gogreen-text-secondary">Active SIMD Width</span>
            <span className="text-gogreen-bright font-semibold">
              {nativeFeatures.some((f) => f.name === 'AVX2' && f.active)
                ? '256-bit (AVX2)'
                : nativeFeatures.some((f) => f.name === 'AVX-512F' && f.active)
                ? '512-bit (AVX-512)'
                : '128-bit (SSE2/NEON)'}
            </span>
          </div>
        </Card>

        <Card noPadding>
          <div className="p-4">
            <div className="text-[11px] font-mono text-gogreen-text-secondary uppercase">
              Native Daemon State
            </div>
            <div className={`text-xl font-mono font-bold mt-1 flex items-center gap-2 ${isConnected ? 'text-gogreen-bright' : 'text-gogreen-text-secondary'}`}>
              <StatusIndicator status={isConnected ? 'online' : 'offline'} />
              {isConnected ? 'ONLINE' : 'NOT CONNECTED'}
            </div>
            <div className="text-[11px] text-gogreen-text-secondary mt-1">
              {isConnected
                ? `Uptime: ${daemonHealth?.uptime_seconds || 0}s (v${daemonHealth?.engine_version || '2.0.0'})`
                : 'Daemon offline on 127.0.0.1:8080'}
            </div>
          </div>
          <div className="px-4 py-2 bg-gogreen-bg-secondary/40 border-t border-gogreen-border/60 text-[11px] font-mono flex justify-between">
            <span className="text-gogreen-text-secondary">HTTP API Endpoint</span>
            <span className={isConnected ? 'text-gogreen-bright font-semibold' : 'text-gogreen-text-primary'}>
              http://127.0.0.1:8080
            </span>
          </div>
        </Card>
      </div>

      {/* Main Split: Supported Instruction Sets & Assembly Routine Inventory */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Supported SIMD / Hardware Instruction Matrix */}
        <div className="space-y-4">
          <Card
            title="Instruction Set Architecture (ISA)"
            subtitle={isConnected ? 'CPUID leaf 1/7 & XCR0 extended register state verification' : 'Detected microarchitectural vector & crypto capabilities'}
            headerAction={
              isConnected ? (
                <Badge variant="primary" size="sm">
                  {nativeFeatures.filter((f) => f.active).length} Active
                </Badge>
              ) : undefined
            }
          >
            <div className="space-y-2.5 font-mono text-xs">
              {displayFeatures.map((feat) => (
                <div
                  key={feat.name}
                  className="p-2.5 rounded bg-gogreen-bg-main border border-gogreen-border/60 flex items-start justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gogreen-text-primary">{feat.name}</span>
                      <Badge size="sm" variant="neutral">
                        {feat.category}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-gogreen-text-secondary mt-1 font-sans leading-tight">
                      {feat.description}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {feat.supported ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-gogreen-bright font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        ACTIVE
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-gogreen-text-secondary">
                        <XCircle className="w-3.5 h-3.5" />
                        ABSENT
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Assembly Routine Inventory & Code Inspection */}
        <div className="lg:col-span-2 space-y-4">
          <Card
            title="Assembly Routine Inventory (NASM x86-64)"
            subtitle="Native optimized microkernels targeting deep hardware execution via System V AMD64 ABI"
            headerAction={
              <Badge variant="primary" dot>
                {standardAssemblyRoutines.length} Routines
              </Badge>
            }
          >
            {/* Selector list */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pb-4 border-b border-gogreen-border/60">
              {standardAssemblyRoutines.map((routine) => {
                const isSelected = routine.id === selectedRoutine.id;
                return (
                  <button
                    key={routine.id}
                    onClick={() => {
                      setSelectedRoutine(routine);
                      setExecutionMessage(null);
                      setBenchmarkResult(null);
                    }}
                    className={`p-3 rounded border text-left transition-all font-mono ${
                      isSelected
                        ? 'bg-gogreen-bg-elevated border-gogreen-primary text-gogreen-bright shadow-glow-sm'
                        : 'bg-gogreen-bg-main border-gogreen-border text-gogreen-text-secondary hover:text-gogreen-text-primary hover:border-gogreen-border/80'
                    }`}
                  >
                    <div className="text-xs font-semibold truncate">{routine.name}</div>
                    <div className="text-[10px] text-gogreen-text-secondary mt-0.5 uppercase">
                      {routine.targetArch} • {routine.isaRequirement}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Routine Details */}
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-mono text-sm font-bold text-gogreen-text-primary">
                    {selectedRoutine.name}
                  </h4>
                  <p className="text-xs text-gogreen-text-secondary mt-0.5">
                    {selectedRoutine.description}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Play className="w-3 h-3" />}
                    onClick={handleExecuteBenchmark}
                    disabled={isExecuting}
                  >
                    {isExecuting ? 'Dispatching...' : 'Dispatch to Daemon'}
                  </Button>
                </div>
              </div>

              {/* Technical Footprint Badges */}
              <div className="flex flex-wrap gap-2 text-xs font-mono">
                <span className="px-2 py-1 bg-gogreen-bg-elevated border border-gogreen-border rounded text-gogreen-text-secondary">
                  Instruction Count: <strong className="text-gogreen-text-primary">{selectedRoutine.instructionCount}</strong>
                </span>
                <span className="px-2 py-1 bg-gogreen-bg-elevated border border-gogreen-border rounded text-gogreen-text-secondary">
                  Register Pressure: <strong className="text-gogreen-text-primary">{selectedRoutine.registerFootprint}</strong>
                </span>
                <span className="px-2 py-1 bg-gogreen-bg-elevated border border-gogreen-border rounded text-gogreen-text-secondary">
                  Target ISA: <strong className="text-gogreen-bright">{selectedRoutine.isaRequirement}</strong>
                </span>
              </div>

              {/* Execution Feedback Banner if Attempted */}
              {executionMessage && (
                <div
                  className={`p-3 rounded text-xs font-mono flex items-start gap-2 ${
                    executionMessage.type === 'success'
                      ? 'bg-gogreen-dark border border-gogreen-border text-gogreen-bright'
                      : 'bg-gogreen-warning/10 border border-gogreen-warning/30 text-gogreen-warning'
                  }`}
                >
                  {executionMessage.type === 'success' ? (
                    <Zap className="w-4 h-4 shrink-0 mt-0.5 text-gogreen-bright" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span>{executionMessage.text}</span>
                </div>
              )}

              {/* Benchmark Result Detail Card if Available */}
              {benchmarkResult && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-gogreen-bg-panel border border-gogreen-border rounded font-mono text-xs">
                  <div>
                    <span className="text-[10px] text-gogreen-text-secondary block">DURATION</span>
                    <strong className="text-gogreen-text-primary">{benchmarkResult.duration_ms.toFixed(3)} ms</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-gogreen-text-secondary block">THROUGHPUT</span>
                    <strong className="text-gogreen-bright">{benchmarkResult.throughput_ops_sec.toLocaleString(undefined, { maximumFractionDigits: 0 })} ops/s</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-gogreen-text-secondary block">BANDWIDTH</span>
                    <strong className="text-gogreen-text-primary">{benchmarkResult.throughput_mb_sec.toFixed(1)} MB/s</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-gogreen-text-secondary block">MEDIAN LATENCY</span>
                    <strong className="text-gogreen-bright">{benchmarkResult.median_ns.toFixed(1)} ns</strong>
                  </div>
                </div>
              )}

              {/* Code Viewer */}
              <CodeViewer
                code={selectedRoutine.codeSnippet}
                language="assembly"
                title={`${selectedRoutine.name}.asm`}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
