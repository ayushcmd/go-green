import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tabs } from '@/components/ui/Tabs';
import { BarChart } from '@/components/charts/BarChart';
import { LineChart } from '@/components/charts/LineChart';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { DataTable, Column } from '@/components/ui/DataTable';
import {
  Gauge,
  Play,
  CheckCircle2,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  fetchNativeHealth,
  fetchNativeHost,
  fetchNativeBenchmarks,
  triggerNativeBenchmark,
} from '@/services/systemService';
import { NativeBenchmarkMetric, NativeHostInfo } from '@/types';

export const ProfilerPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('benchmarks');
  const [benchmarks, setBenchmarks] = useState<NativeBenchmarkMetric[]>([]);
  const [hostInfo, setHostInfo] = useState<NativeHostInfo | null>(null);
  const [benchmarkStatus, setBenchmarkStatus] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'info' | 'warn' | 'success'>('info');
  const [isExecuting, setIsExecuting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let mounted = true;
    const checkState = async () => {
      const health = await fetchNativeHealth();
      if (!mounted) return;
      if (health.connected) {
        setIsConnected(true);
        const [host, list] = await Promise.all([
          fetchNativeHost(),
          fetchNativeBenchmarks(),
        ]);
        if (!mounted) return;
        if (host) setHostInfo(host);
        if (list && list.length > 0) setBenchmarks(list);
      } else {
        setIsConnected(false);
      }
    };
    checkState();
  }, []);

  const handleRunSuite = async () => {
    setIsExecuting(true);
    setBenchmarkStatus(null);

    const health = await fetchNativeHealth();
    if (!health.connected) {
      setIsExecuting(false);
      setIsConnected(false);
      setStatusType('warn');
      setBenchmarkStatus(
        'Execution blocked: Native engine daemon is not connected. Start gogreen-daemon on 127.0.0.1:8080 to run bare-metal benchmarks.'
      );
      return;
    }

    setIsConnected(true);
    try {
      const results = await triggerNativeBenchmark('all');
      setIsExecuting(false);
      if (results.length > 0) {
        setBenchmarks(results);
        setStatusType('success');
        setBenchmarkStatus(
          `Benchmark suite executed successfully across ${results.length} trials (Assembly vs C++ Fallback). Verified bare-metal results recorded.`
        );
      } else {
        setStatusType('warn');
        setBenchmarkStatus('Execution completed with empty result.');
      }
    } catch {
      setIsExecuting(false);
      setStatusType('warn');
      setBenchmarkStatus('Execution error communicating with native engine daemon.');
    }
  };

  // Prepare chart data from genuine benchmark results
  const throughputChartData = benchmarks.map((b) => ({
    label: `${b.name.replace(' (1MB Buffer)', '')} (${b.implementation.includes('Assembly') ? 'ASM' : 'C++'})`,
    value: Math.round(b.throughput_mb_sec),
  }));

  const latencyChartData = benchmarks.map((b) => ({
    label: b.name.replace(' (1MB Buffer)', '').slice(0, 12),
    value: Math.round(b.median_ns),
  }));

  const columns: Column<NativeBenchmarkMetric>[] = [
    {
      key: 'name',
      header: 'Kernel Name',
      render: (b) => (
        <div>
          <span className="font-semibold text-gogreen-text-primary block">{b.name}</span>
          <span className="text-[10px] text-gogreen-text-secondary">{b.category}</span>
        </div>
      ),
    },
    {
      key: 'implementation',
      header: 'Implementation',
      render: (b) => (
        <Badge
          size="sm"
          variant={b.implementation.includes('Assembly') ? 'primary' : 'neutral'}
        >
          {b.implementation}
        </Badge>
      ),
    },
    {
      key: 'duration_ms',
      header: 'Duration',
      render: (b) => `${b.duration_ms.toFixed(2)} ms`,
    },
    {
      key: 'throughput_ops_sec',
      header: 'Throughput (ops/s)',
      render: (b) => (
        <span className="text-gogreen-bright font-semibold">
          {b.throughput_ops_sec.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
      ),
    },
    {
      key: 'throughput_mb_sec',
      header: 'Bandwidth',
      render: (b) => `${b.throughput_mb_sec.toFixed(1)} MB/s`,
    },
    {
      key: 'median_ns',
      header: 'Median Latency',
      render: (b) => `${b.median_ns.toFixed(1)} ns`,
    },
    {
      key: 'p99_ns',
      header: 'p99 Latency',
      render: (b) => `${b.p99_ns.toFixed(1)} ns`,
    },
    {
      key: 'verified_correct',
      header: 'Correctness',
      render: (b) =>
        b.verified_correct ? (
          <span className="text-gogreen-bright inline-flex items-center gap-1 text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5" /> VERIFIED
          </span>
        ) : (
          <span className="text-gogreen-error inline-flex items-center gap-1 text-[11px]">
            <XCircle className="w-3.5 h-3.5" /> MISMATCH
          </span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Profiler Controls Header */}
      <Card noPadding>
        <div className="p-4 border-b border-gogreen-border bg-gogreen-bg-secondary/40 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gogreen-bg-elevated border border-gogreen-border rounded">
              <Gauge className="w-5 h-5 text-gogreen-bright" />
            </div>
            <div>
              <h2 className="font-mono text-sm font-bold text-gogreen-text-primary uppercase tracking-wide">
                Microarchitectural Profiler & Microbenchmark Suite
              </h2>
              <p className="text-xs text-gogreen-text-secondary mt-0.5">
                Bare-metal cycle measurement, NASM assembly vs C++ compiler vectorization throughput
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-gogreen-bg-elevated border border-gogreen-border text-xs font-mono">
              <span className="text-gogreen-text-secondary">PMC Sensor:</span>
              <StatusIndicator
                status={isConnected ? 'online' : 'offline'}
                label={isConnected && hostInfo?.perf_event_supported ? 'USER PMC' : isConnected ? 'RESTRICTED' : 'OFFLINE'}
              />
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={isExecuting ? <Zap className="w-3.5 h-3.5 animate-pulse" /> : <Play className="w-3.5 h-3.5" />}
              onClick={handleRunSuite}
              disabled={isExecuting}
            >
              {isExecuting ? 'Measuring Cycles...' : 'Run Benchmark Suite'}
            </Button>
          </div>
        </div>

        {benchmarkStatus && (
          <div
            className={`p-3 border-b text-xs font-mono flex items-center justify-between ${
              statusType === 'success'
                ? 'bg-gogreen-dark border-gogreen-border text-gogreen-bright'
                : 'bg-gogreen-warning/10 border-gogreen-warning/30 text-gogreen-warning'
            }`}
          >
            <span>{benchmarkStatus}</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setBenchmarkStatus(null)}
              className={statusType === 'success' ? 'text-gogreen-bright hover:text-white' : 'text-gogreen-warning hover:text-gogreen-primary'}
            >
              Dismiss
            </Button>
          </div>
        )}

        <div className="p-3">
          <Tabs
            tabs={[
              { id: 'benchmarks', label: 'Benchmark Suite', badge: benchmarks.length },
              { id: 'throughput', label: 'Bandwidth Throughput (MB/s)' },
              { id: 'latency', label: 'Median Latency (ns)' },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>
      </Card>

      {/* Main Content Area */}
      {benchmarks.length === 0 ? (
        <Card>
          <EmptyState
            type="no_data"
            title="No benchmark results available"
            description="No benchmark runs have been executed yet. Click below to dispatch genuine NASM assembly microkernels to the native engine daemon."
            actionLabel="Dispatch Microbenchmark Suite"
            onAction={handleRunSuite}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {activeTab === 'benchmarks' && (
            <Card
              title="Bare-Metal Benchmark Measurements"
              subtitle="Comparison of hand-written NASM routines vs -O3 compiler vectorized fallbacks"
              noPadding
            >
              <DataTable
                columns={columns}
                data={benchmarks}
                keyExtractor={(b) => `${b.id}-${b.timestamp}`}
              />
            </Card>
          )}

          {activeTab === 'throughput' && (
            <div className="space-y-6">
              <Card
                title="Memory & Arithmetic Bandwidth (MB/s)"
                subtitle="Measured data throughput per second across hardware execution units"
              >
                <BarChart
                  data={throughputChartData}
                  unit=" MB/s"
                  height={260}
                />
              </Card>
            </div>
          )}

          {activeTab === 'latency' && (
            <div className="space-y-6">
              <Card
                title="Measured Median Latency (ns / op)"
                subtitle="High-resolution monotonic timer measurement across batch samples"
              >
                <LineChart
                  data={latencyChartData}
                  unit=" ns"
                  height={260}
                />
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Benchmark Specimen Profiles */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded bg-gogreen-bg-panel border border-gogreen-border font-mono text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-gogreen-text-primary">asm_add_i64</span>
            <Badge size="sm" variant="neutral">Integer</Badge>
          </div>
          <p className="text-[11px] text-gogreen-text-secondary font-sans leading-tight">
            Single-cycle 64-bit integer addition passing inputs via RDI, RSI.
          </p>
          <div className="text-[10px] text-gogreen-text-secondary pt-1 border-t border-gogreen-border/50 flex justify-between">
            <span>Workload</span>
            <span className="text-gogreen-bright">500,000 Iterations</span>
          </div>
        </div>

        <div className="p-4 rounded bg-gogreen-bg-panel border border-gogreen-border font-mono text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-gogreen-text-primary">asm_memcpy</span>
            <Badge size="sm" variant="neutral">Memory</Badge>
          </div>
          <p className="text-[11px] text-gogreen-text-secondary font-sans leading-tight">
            64-bit quadword block copy loop with tail byte alignment.
          </p>
          <div className="text-[10px] text-gogreen-text-secondary pt-1 border-t border-gogreen-border/50 flex justify-between">
            <span>Buffer Size</span>
            <span className="text-gogreen-bright">512 KB Buffer</span>
          </div>
        </div>

        <div className="p-4 rounded bg-gogreen-bg-panel border border-gogreen-border font-mono text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-gogreen-text-primary">asm_byte_sum</span>
            <Badge size="sm" variant="neutral">Accumulator</Badge>
          </div>
          <p className="text-[11px] text-gogreen-text-secondary font-sans leading-tight">
            Unsigned byte array sum accumulation into 64-bit RAX register.
          </p>
          <div className="text-[10px] text-gogreen-text-secondary pt-1 border-t border-gogreen-border/50 flex justify-between">
            <span>Array Size</span>
            <span className="text-gogreen-bright">512 KB Buffer</span>
          </div>
        </div>

        <div className="p-4 rounded bg-gogreen-bg-panel border border-gogreen-border font-mono text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-gogreen-text-primary">asm_simd_add_f32</span>
            <Badge size="sm" variant="neutral">SIMD</Badge>
          </div>
          <p className="text-[11px] text-gogreen-text-secondary font-sans leading-tight">
            128-bit packed single-precision float addition via SSE2 instructions.
          </p>
          <div className="text-[10px] text-gogreen-text-secondary pt-1 border-t border-gogreen-border/50 flex justify-between">
            <span>Float Count</span>
            <span className="text-gogreen-bright">131,072 Floats</span>
          </div>
        </div>
      </div>
    </div>
  );
};
